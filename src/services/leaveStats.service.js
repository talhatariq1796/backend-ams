import LeaveStats from "../models/leaveStats.model.js";
import User from "../models/user.model.js";
import Teams from "../models/team.model.js";
import OfficeConfigs from "../models/config.model.js";
import dayjs from "dayjs";
import mongoose from "mongoose";
import AppError from "../middlewares/error.middleware.js";
import {
  InitializeLeaveStatsForUser,
  AdjustLeaveStatsForUser,
} from "../utils/leaveStats.util.js";
import OfficeConfig from "../models/config.model.js";
import { leaveSyncQueue } from "../jobs/leaveSync.queue.js";

/**
 * Get leave stats for a user. Initialize if not found.
 */
export const GetLeaveStatsService = async (
  userInfo,
  user_id = null,
  year = null,
) => {
  try {
    const targetYear = year || dayjs().year();

    // ✅ Determine which user's stats to fetch
    let targetUser;
    if (user_id && user_id.toString() !== userInfo._id.toString()) {
      // Allow only admins, HR, and team leads to view others’ stats
      if (!["admin", "hr", "teamLead", "manager"].includes(userInfo.role)) {
        throw new AppError(
          "Unauthorized to view other users' leave stats",
          403,
        );
      }
      targetUser = await User.findById(user_id);
    } else {
      targetUser = await User.findById(userInfo._id);
    }

    if (!targetUser) throw new AppError("User not found", 404);

    // ✅ Try to get existing stats
    let stats = await LeaveStats.findOne({
      user: targetUser._id,
      year: targetYear,
    });

    // ✅ Initialize stats if not found
    if (!stats) {
      stats = await InitializeLeaveStatsForUser(targetUser._id, targetYear);
    }

    // ✅ Convert to plain object
    stats = stats.toObject();

    // ✅ Gender-based filtering
    if (targetUser.gender?.toLowerCase() === "male") {
      delete stats.leave_breakdown?.maternity;
    } else if (targetUser.gender?.toLowerCase() === "female") {
      delete stats.leave_breakdown?.paternity;
    }

    // ✅ Employment status-based adjustment
    const employmentStatus = targetUser.employment_status?.toLowerCase();

    if (employmentStatus === "internship" || employmentStatus === "probation") {
      const probationStats = stats.leave_breakdown?.probation || {
        allowed: 0,
        taken: 0,
        remaining: 0,
      };

      // Override totals based on probation stats
      stats.total_taken_leaves = probationStats.taken;
      stats.remaining_leaves = probationStats.remaining;

      // Only keep probation stats in breakdown
      stats.leave_breakdown = {
        probation: probationStats,
      };
    }

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error("Error in GetLeaveStatsService:", error);
    throw new AppError(error.message, error.statusCode || 500);
  }
};

/**
 * Get paginated leave stats for all users (optionally by department).
 */
export const GetAllLeaveStatsService = async (
  year = null,
  department_id = null,
  page = 1,
  limit = 10,
) => {
  try {
    const targetYear = year || dayjs().year();
    let filter = { year: targetYear };

    if (department_id && mongoose.Types.ObjectId.isValid(department_id)) {
      const teamsInDept = await Teams.find({
        department: department_id,
      }).select("members");
      const userIdsInDept = teamsInDept.flatMap((team) =>
        team.members.map((member) => member.toString()),
      );
      filter.user = { $in: userIdsInDept };
    }

    const skip = (page - 1) * limit;

    const [stats, total] = await Promise.all([
      LeaveStats.find(filter)
        .populate(
          "user",
          "first_name last_name employee_id department employment_status",
        )
        .skip(skip)
        .limit(limit)
        .lean(),
      LeaveStats.countDocuments(filter),
    ]);

    return {
      stats,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      hasMorePages: page * limit < total,
    };
  } catch (error) {
    throw new AppError(error.message, error.statusCode || 500);
  }
};

/**
 * Sync all users' leave stats for a given year (reinitialize).
 */
export const SyncAllLeaveStatsService = async (
  year = null,
  updatedTypes = ["all"],
) => {
  try {
    const targetYear = year || dayjs().year();

    let filter = {};
    if (
      updatedTypes.includes("general") &&
      !updatedTypes.includes("business")
    ) {
      // Non-business employees
      filter = { designation: { $not: /business/i } };
    } else if (
      updatedTypes.includes("business") &&
      !updatedTypes.includes("general")
    ) {
      // Only business developers
      filter = { designation: { $regex: /business/i } };
    } // else both → no filter (all employees)

    const users = await User.find(filter).select("_id");

    const results = await Promise.all(
      users.map((user) => RecalculateLeaveStatsForUser(user._id, targetYear)),
    );

    return { success: true, updatedCount: results.length, scope: updatedTypes };
  } catch (error) {
    throw new AppError(error.message, error.statusCode || 500);
  }
};

export const EditLeaveStatsService = async (user_id, year, updates) => {
  try {
    const targetYear = year || dayjs().year();

    // ✅ CASE 1: Update individual user's leave stats
    if (user_id) {
      const leaveStats = await LeaveStats.findOne({
        user: user_id,
        year: targetYear,
      });

      if (!leaveStats) {
        throw new AppError("Leave stats not found for this user and year", 404);
      }

      if (typeof updates.prorated_leave_entitlement === "number") {
        leaveStats.prorated_leave_entitlement =
          updates.prorated_leave_entitlement;
      }

      if (typeof updates.remaining_leaves === "number") {
        leaveStats.remaining_leaves = updates.remaining_leaves;
      }

      // ✅ FIX: Update total_taken_leaves
      if (typeof updates.total_taken_leaves === "number") {
        leaveStats.total_taken_leaves = updates.total_taken_leaves;
      }

      if (updates.leave_breakdown) {
        for (const type in updates.leave_breakdown) {
          if (leaveStats.leave_breakdown[type]) {
            const breakdown = updates.leave_breakdown[type];
            if (typeof breakdown.allowed === "number")
              leaveStats.leave_breakdown[type].allowed = breakdown.allowed;
            if (typeof breakdown.taken === "number")
              leaveStats.leave_breakdown[type].taken = breakdown.taken;
            if (typeof breakdown.remaining === "number")
              leaveStats.leave_breakdown[type].remaining = breakdown.remaining;
          }
        }
      }

      leaveStats.last_updated = new Date();
      await leaveStats.save();
      return leaveStats;
    }

    // ✅ CASE 2: Update company-wide leave types (general and/or business)
    const config = await OfficeConfig.findOne();
    if (!config) throw new AppError("Office configuration not found", 404);

    const updateFields = [];

    if (updates.general_leave_types) {
      for (const type in updates.general_leave_types) {
        if (typeof updates.general_leave_types[type] === "number") {
          config.general_leave_types[type] = updates.general_leave_types[type];
          updateFields.push("general");
        }
      }
    }

    if (updates.business_leave_types) {
      for (const type in updates.business_leave_types) {
        if (typeof updates.business_leave_types[type] === "number") {
          config.business_leave_types[type] =
            updates.business_leave_types[type];
          updateFields.push("business");
        }
      }
    }

    await config.save();

    await leaveSyncQueue.add({
      year: targetYear,
      updatedTypes: updateFields,
    });

    return config;
  } catch (error) {
    throw new AppError(error.message, error.statusCode || 500);
  }
};

/**
 * Adjust leave stats incrementally (apply, reject, restore) using utils.
 * Useful for check-in/checkout or leave actions.
 */
export const AdjustLeaveStatsService = async (
  user_id,
  year,
  leave_type,
  days,
  action,
) => {
  return AdjustLeaveStatsForUser(user_id, year, leave_type, days, action);
};

export const RecalculateLeaveStatsForUser = async (user_id, year) => {
  try {
    const yearNum = Number(year);
    if (isNaN(yearNum)) throw new AppError("Invalid year format", 400);

    const user = await User.findById(user_id);
    if (!user) throw new AppError("User not found", 404);

    const officeConfig = await OfficeConfigs.findOne();
    if (!officeConfig) {
      throw new AppError("Office configuration not found", 500);
    }

    const status = user.employment_status?.toLowerCase();
    const isPermanent = status === "permanent";
    const isProbationOrIntern = ["probation", "internship"].includes(status);
    const isBusinessRole = user.designation?.toLowerCase().includes("business");

    // 🔹 Select leave type config
    const leaveTypes = isBusinessRole
      ? officeConfig.business_leave_types || {}
      : officeConfig.general_leave_types || {};

    // 🔹 Determine allowed leaves
    let allowedLeave;
    if (isPermanent) {
      allowedLeave = isBusinessRole
        ? officeConfig.allowedLeaveForPermanentBusinessDevelopers
        : officeConfig.allowedLeaveForPermanentEmployees;
    } else if (isProbationOrIntern) {
      allowedLeave = leaveTypes.probation || 0; // only probation leaves
    } else {
      allowedLeave = officeConfig.allowedLeaveForPermanentEmployees; // fallback
    }

    const joiningDate = dayjs(user.joining_date);
    const joiningYear = joiningDate.year();

    // 🔹 Pro-rate ONLY for permanent employees
    let proratedLeave = allowedLeave;
    if (isPermanent && joiningYear === yearNum) {
      const start = joiningDate.startOf("day");
      const endOfYear = dayjs().year(yearNum).endOf("year");
      const daysWorked = endOfYear.diff(start, "day") + 1;
      // proratedLeave = Math.floor((allowedLeave * daysWorked) / 365);
      proratedLeave = (allowedLeave * daysWorked) / 365;
    }

    // 🔹 Fetch existing stats to preserve taken leaves
    const existingStats = await LeaveStats.findOne({
      user: user_id,
      year: yearNum,
    });

    let leaveBreakdown = {};

    if (isProbationOrIntern) {
      // 🔹 Probation/Interns only get probation leave
      const taken = existingStats?.leave_breakdown?.probation?.taken || 0;
      leaveBreakdown = {
        probation: {
          allowed: proratedLeave,
          taken,
          remaining: Math.max(0, proratedLeave - taken),
        },
      };
    } else {
      // 🔹 Permanent & others → split and include config categories
      // const baseDistribution = {
      //   sick: Math.floor(proratedLeave * 0.3),
      //   casual: Math.floor(proratedLeave * 0.3),
      // };
      // baseDistribution.annual =
      //   proratedLeave - (baseDistribution.sick + baseDistribution.casual);
      const baseDistribution = {
        sick: proratedLeave * 0.3,
        casual: proratedLeave * 0.3,
      };
      baseDistribution.annual =
        proratedLeave - (baseDistribution.sick + baseDistribution.casual);

      const categoryLimits = { ...baseDistribution };

      // Add other leave categories from config
      Object.entries(leaveTypes).forEach(([type, limit]) => {
        if (!["annual", "sick", "casual"].includes(type)) {
          categoryLimits[type] = limit;
        }
      });
      // Add additional leave types from config
      Object.entries(leaveTypes).forEach(([type, value]) => {
        if (["annual", "casual", "sick", "probation"].includes(type)) return;

        // 🔹 Skip gender-specific leaves
        if (
          type.toLowerCase() === "maternity" &&
          user.gender?.toLowerCase() === "male"
        )
          return;
        if (
          type.toLowerCase() === "paternity" &&
          user.gender?.toLowerCase() === "female"
        )
          return;

        leaveBreakdown[type] = {
          allowed: value,
          taken: existingStats?.leave_breakdown?.[type]?.taken || 0,
          remaining: Math.max(
            0,
            value - (existingStats?.leave_breakdown?.[type]?.taken || 0),
          ),
        };
      });

      Object.entries(categoryLimits).forEach(([type, allowed]) => {
        const taken = existingStats?.leave_breakdown?.[type]?.taken || 0;
        leaveBreakdown[type] = {
          allowed,
          taken,
          remaining: Math.max(0, allowed - taken),
        };
      });
    }

    // 🔹 Calculate totals
    const totalTaken = Object.values(leaveBreakdown).reduce(
      (sum, l) => sum + l.taken,
      0,
    );
    const totalRemaining = Object.values(leaveBreakdown).reduce(
      (sum, l) => sum + l.remaining,
      0,
    );

    const recalculatedStats = await LeaveStats.findOneAndUpdate(
      { user: user_id, year: yearNum },
      {
        user: user_id,
        year: yearNum,
        leave_breakdown: leaveBreakdown,
        prorated_leave_entitlement: proratedLeave,
        total_taken_leaves: totalTaken,
        total_approved_leaves: existingStats?.total_taken_leaves || 0,
        total_pending_leaves: existingStats?.remaining_leaves || 0,
        total_restored_leaves: existingStats?.total_restored_leaves || 0,
        remaining_leaves: totalRemaining,
        last_updated: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return recalculatedStats;
  } catch (error) {
    console.error(`[RecalculateLeaveStats] Error: ${error.message}`);
    throw new AppError("Failed to recalculate leave stats", 500);
  }
};
