import dayjs from "dayjs";
import LeaveStats from "../models/leaveStats.model.js";
import User from "../models/user.model.js";
import OfficeConfigs from "../models/config.model.js";
import AppError from "../middlewares/error.middleware.js";

export const InitializeLeaveStatsForUser = async (user_id, year) => {
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

    // 🔹 Pro-rate ONLY for permanent employees in their joining year
    let proratedLeave = allowedLeave;
    if (isPermanent && joiningYear === yearNum) {
      const start = joiningDate.startOf("day");
      const endOfYear = dayjs(`${yearNum}-12-31`).endOf("year");
      const daysWorked = endOfYear.diff(start, "day") + 1;
      proratedLeave = Math.floor((allowedLeave * daysWorked) / 365);
    }

    // 🔹 Build leave breakdown
    let leaveBreakdown = {};

    if (isProbationOrIntern) {
      // Only probation leaves
      leaveBreakdown = {
        probation: {
          allowed: proratedLeave,
          taken: 0,
          remaining: proratedLeave,
        },
      };
    } else {
      // Permanent & others → split and include config categories
      const baseDistribution = {
        sick: Math.floor(proratedLeave * 0.3),
        casual: Math.floor(proratedLeave * 0.3),
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

        leaveBreakdown[type] = { allowed: value, taken: 0, remaining: value };
      });

      Object.entries(categoryLimits).forEach(([type, allowed]) => {
        leaveBreakdown[type] = {
          allowed,
          taken: 0,
          remaining: allowed,
        };
      });
    }

    // Check if stats already exist to avoid duplicate key errors
    let initializedStats = await LeaveStats.findOne({
      user: user_id,
      year: yearNum,
    });

    if (!initializedStats) {
      // Create new stats if they don't exist
      initializedStats = await LeaveStats.create({
        user: user_id,
        year: yearNum,
        leave_breakdown: leaveBreakdown,
        prorated_leave_entitlement: proratedLeave,
        total_taken_leaves: 0,
        total_approved_leaves: 0,
        total_pending_leaves: 0,
        total_restored_leaves: 0,
        remaining_leaves: proratedLeave,
        last_updated: new Date(),
      });
    } else {
      // Update existing stats if they exist but are incomplete
      initializedStats.leave_breakdown = leaveBreakdown;
      initializedStats.prorated_leave_entitlement = proratedLeave;
      initializedStats.remaining_leaves = proratedLeave;
      initializedStats.last_updated = new Date();
      await initializedStats.save();
    }

    return initializedStats;
  } catch (error) {
    console.error(`[InitializeLeaveStats] Error for user ${user_id}, year ${year}:`, error);
    // Preserve the original error message if it's an AppError, otherwise provide more context
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      `Failed to initialize leave stats: ${error.message || "Unknown error"}`,
      500
    );
  }
};

export const AdjustLeaveStatsForUser = async (
  user_id,
  year,
  leave_type,
  days,
  action
) => {
  try {
    const yearNum = Number(year);
    if (isNaN(yearNum)) throw new AppError("Invalid year format", 400);

    // Fetch user to determine employment status
    const user = await User.findById(user_id);
    if (!user) throw new AppError("User not found", 404);

    const stats = await LeaveStats.findOne({ user: user_id, year: yearNum });
    if (!stats) throw new AppError("Leave stats not initialized for user", 404);

    const breakdown = stats.leave_breakdown[leave_type];
    if (!breakdown)
      throw new AppError(`Leave type ${leave_type} not found`, 400);

    let delta = 0;
    if (action === "apply") delta = days; // Apply or approve leave
    if (action === "delete" || action === "reject" || action === "restore")
      delta = -days;

    breakdown.taken = Math.max(0, breakdown.taken + delta);
    breakdown.remaining = Math.max(0, breakdown.allowed - breakdown.taken);

    // 🔹 Define leave types to EXCLUDE from total_taken_leaves calculation
    const excludedFromTotalLeaves = [
      "unpaid",
      "demise",
      "hajj/umrah",
      "marriage",
      "paternity",
      "maternity",
    ];

    // 🔹 Recalculate total_taken_leaves (excluding unpaid and special leaves)
    stats.total_taken_leaves = Object.entries(stats.leave_breakdown).reduce(
      (sum, [type, data]) => {
        // Skip excluded leave types
        if (excludedFromTotalLeaves.includes(type.toLowerCase())) {
          return sum;
        }
        return sum + data.taken;
      },
      0
    );

    // 🔹 FIX: Calculate remaining_leaves based on employment status
    const isProbationOrInternship =
      user.employment_status?.toLowerCase() === "probation" ||
      user.employment_status?.toLowerCase() === "internship";

    if (isProbationOrInternship) {
      // For probation/internship users, only count "probation" leave type
      stats.remaining_leaves = stats.leave_breakdown.probation?.remaining || 0;
    } else {
      // For permanent users, count annual, sick, and casual leaves only
      stats.remaining_leaves = ["annual", "sick", "casual"].reduce(
        (sum, type) => {
          return sum + (stats.leave_breakdown[type]?.remaining || 0);
        },
        0
      );
    }

    stats.last_updated = new Date();

    await stats.save();
    return stats;
  } catch (error) {
    console.error(`[AdjustLeaveStats] Error: ${error.message}`);
    throw new AppError("Failed to adjust leave stats", 500);
  }
};
