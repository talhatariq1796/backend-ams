import Attendances from "../models/attendance.model.js";
import Users from "../models/user.model.js";
import Teams from "../models/team.model.js";
import OfficeConfigs from "../models/config.model.js";
import AppError from "../middlewares/error.middleware.js";
import { getDateRangeFromFilter } from "../utils/dateFilters.utils.js";
import * as WorkingHoursService from "./workingHours.service.js";
import leaveQueue from "../utils/leaveQueue.util.js";
import Leave from "../models/requests/leave.model.js";
import Departments from "../models/department.model.js";
import mongoose from "mongoose";
import { getPagination } from "../utils/pagination.util.js";
import RemoteWorkRequests from "../models/requests/remotework.model.js";
import { eachDayOfInterval } from "date-fns";
import { getWorkingDatesOnlyInMonth } from "../utils/getWorkingDatesOnlyInMonth.js";
import axios from "axios";
import { AdjustLeaveStatsForUser } from "../utils/leaveStats.util.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    return ip.includes(":") ? null : ip;
  }
  const ip =
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress;
  return ip?.startsWith("::ffff:") ? ip.slice(7) : ip;
};

const verifyIpLocation = async (ip) => {
  try {
    const { data } = await axios.get(`http://ip-api.com/json/${ip}`);

    if (data.status !== "success") {
      console.error("IP API failed:", data.message || "Unknown error");
      throw new AppError("IP lookup failed", 500);
    }

    const city = (data.city || "").trim().toLowerCase();
    const org = (data.org || "").trim().toLowerCase();

    const allowedCities = ["lahore", "faisalabad"];
    const suspiciousOrgs = ["vpn", "proxy", "digitalocean", "ovh", "contabo"];

    const cityMatch = allowedCities.includes(city);
    const orgSuspicious = suspiciousOrgs.some((word) => org.includes(word));

    // if (!cityMatch) {
    //   throw new AppError(
    //     `City '${data.city}' is not in allowed locations`,
    //     403
    //   );
    // }

    if (orgSuspicious) {
      throw new AppError(`Org '${data.org}' is suspicious`, 403);
    }

    return true;
  } catch (err) {
    console.error("IP verification failed:", err.message);
    throw err;
  }
};

// Helper function to send notification to user
const sendUserNotification = async (userId, message, notifyAdmins = false) => {
  try {
    await createLogsAndNotification({
      notification_by: userId, // User is notifying themselves in this context
      notification_to: userId,
      type: NOTIFICATION_TYPES.ATTENDANCE,
      message,
      notifyAdmins,
    });
    console.log(`📧 Notification sent to user ${userId}: ${message}`);
  } catch (error) {
    console.error(
      `⚠️ Failed to send notification to user ${userId}: ${error.message}`,
    );
  }
};

export const MarkAttendanceService = async (
  req,
  user_id,
  date,
  checkin,
  marked_by,
) => {
  const user = await Users.findById(user_id);
  if (!user) throw new AppError("User not found", 400);

  const config = await OfficeConfigs.findOne();
  if (!config) throw new AppError("Config not found", 400);

  const attendanceDate = new Date(date);
  if (isNaN(attendanceDate.getTime())) {
    throw new AppError("Invalid date format", 400);
  }

  // Convert UTC to Pakistan Standard Time (UTC+5)
  const attendanceDatePK = new Date(
    attendanceDate.getTime() + 5 * 60 * 60 * 1000,
  );
  const dayOfWeekInPK = attendanceDatePK.getDay();

  if (checkin && (dayOfWeekInPK === 0 || dayOfWeekInPK === 6)) {
    throw new AppError("Check-in cannot be done on weekends.", 400);
  }

  attendanceDate.setUTCHours(0, 0, 0, 0);

  const now = new Date();
  now.setHours(now.getHours() + 5);

  const { checkin_time, checkout_time } =
    await WorkingHoursService.GetWorkingHoursByUserIdService(user_id);

  const checkinTimeOnly = new Date(checkin_time);
  checkinTimeOnly.setFullYear(1970, 0, 1);

  const nowTimeOnly = new Date(now);
  nowTimeOnly.setFullYear(1970, 0, 1);

  const hasRemoteWork = await RemoteWorkRequests.exists({
    user_id,
    status: "approved",
    start_date: { $lte: attendanceDate },
    end_date: { $gte: attendanceDate },
  });

  const is_remote = Boolean(hasRemoteWork);

  // Check if IP verification is enabled
  // Priority: attendance_rules.enable_ip_check > enable_ip_check (root) > default true
  const enableIpCheck =
    config?.attendance_rules?.enable_ip_check !== undefined
      ? config.attendance_rules.enable_ip_check
      : config?.enable_ip_check !== undefined
        ? config.enable_ip_check
        : true; // Default to true if not specified

  // Only perform IP check if enabled and user is not on remote work
  if (!is_remote && enableIpCheck) {
    const clientIp = getClientIp(req);
    console.log("Client IP:", clientIp);
    await verifyIpLocation(clientIp);
    const allowedIpsMap = config?.allowed_ips || new Map();
    const allowedIps = Array.from(allowedIpsMap.values());
    const normalizedClientIp = String(clientIp || "")
      .trim()
      .replace(/^::ffff:/, "");

    if (!allowedIps.includes(normalizedClientIp)) {
      throw new AppError("Unauthorized location. Attendance not allowed.", 403);
    }
  }
  const bufferTime = config.buffer_time_minutes || 30;

  // Create normalized date for comparison (this should match what's stored in DB)
  const normalizedDate = new Date(attendanceDate);
  normalizedDate.setUTCHours(0, 0, 0, 0);
  const startOfDay = new Date(attendanceDate);
  const endOfDay = new Date(attendanceDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // Helper function to count early leaves in current month
  const countEarlyLeavesInMonth = async (user_id, date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const earlyLeaves = await Attendances.countDocuments({
      user_id,
      date: { $gte: startOfMonth, $lte: endOfMonth },
      status: "early-leave",
    });

    return earlyLeaves;
  };

  if (checkin) {
    // Normalize date to UTC midnight
    const normalizedDate = new Date(attendanceDate);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    // 1. Block if already marked for today
    const alreadyMarkedToday = await Attendances.findOne({
      user_id,
      date: normalizedDate,
      check_in: { $exists: true },
    });

    if (alreadyMarkedToday) {
      throw new AppError("Attendance already marked for this date", 409);
    }
    let attendance = await Attendances.findOne({
      user_id,
      date: { $gte: startOfDay, $lte: endOfDay },
    });
    // Check if user already has an active check-in (not checked out)
    // const activeCheckIn = await Attendances.findOne({
    //   user_id,
    //   check_in: { $exists: true },
    //   check_out: { $exists: false },
    // }).sort({ check_in: -1 });

    // if (activeCheckIn && activeCheckIn.check_in) {
    //   throw new AppError("Attendance already marked for this date", 409);
    // }

    // Check if user has approved leave for this date
    const approvedLeave = await Leave.findOne({
      user: user_id,
      status: "approved",
      start_date: { $lte: attendanceDate },
      end_date: { $gte: attendanceDate },
    });

    let leaveOverrideMessage = "";
    let leaveDaysToRestore = 0;

    // FIXED VERSION - REPLACE WITH THIS
    if (approvedLeave && !approvedLeave.is_half_day) {
      // FIXED: Always restore exactly 1 day for attendance on any leave day
      // This ensures clean integer calculations and prevents decimal issues
      leaveDaysToRestore = 1;
      leaveOverrideMessage = `Leave overridden. 1 day restored to leave balance.`;

      // Check if this attendance override already exists for this date
      const existingOverride = approvedLeave.attendance_overrides?.find(
        (override) =>
          override.date.toDateString() === attendanceDate.toDateString(),
      );

      // Only add override if it doesn't already exist
      if (!existingOverride) {
        await Leave.findByIdAndUpdate(approvedLeave._id, {
          $push: {
            attendance_overrides: {
              date: attendanceDate,
              restored_days: leaveDaysToRestore,
              created_at: new Date(),
              created_by: marked_by,
            },
          },
        });
        await sendUserNotification(
          user_id,
          `attendance marked successfully and overrode approved ${approvedLeave.leave_type} leave. 1 day has been restored to leave balance.`,
          true, // Notify admins about leave override
        );
      } else {
        // If override already exists, don't restore additional days
        leaveDaysToRestore = 0;
        leaveOverrideMessage = `Attendance already marked for this leave day.`;
      }
    }

    const timeDiffMinutes = Math.floor(
      (nowTimeOnly - checkinTimeOnly) / (1000 * 60),
    );
    let status = "present";
    let is_late = false;

    if (timeDiffMinutes > bufferTime) {
      status = "present";
      is_late = true;
    }

    // 🧠 Add check-in analysis
    let analysis = "";
    if (is_remote) {
      analysis = "User checked in remotely.";
    } else if (is_late) {
      const lateByMinutes = timeDiffMinutes - bufferTime;
      analysis = `User checked in late by ${lateByMinutes} minute${
        lateByMinutes > 1 ? "s" : ""
      } (after buffer time of ${bufferTime} mins).`;
    } else {
      analysis = "User checked in on time within allowed buffer window.";
    }

    const updateData = {
      check_in: now,
      status: is_remote ? "remote" : status,
      is_late,
      updated_by: marked_by,
      analysis,
    };

    // Add leave_override if there's approved leave
    if (approvedLeave) {
      updateData.leave_override = {
        original_leave_id: approvedLeave._id,
        restored_days: leaveDaysToRestore,
        leave_type: approvedLeave.leave_type,
      };
    }

    // let attendance;
    try {
      attendance = await Attendances.findOneAndUpdate(
        {
          user_id,
          date: normalizedDate,
        },
        {
          $set: updateData,
          $setOnInsert: {
            user_id,
            date: normalizedDate,
            created_by: marked_by,
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        },
      );
    } catch (error) {
      if (error.code === 11000) {
        // If still getting duplicate key error, try to find and update the existing record
        console.log(
          "Duplicate key error, attempting to update existing record...",
        );

        // Wait a bit and try again (handles race conditions)
        await new Promise((resolve) => setTimeout(resolve, 100));

        attendance = await Attendances.findOneAndUpdate(
          {
            user_id,
            date: normalizedDate,
          },
          {
            $set: updateData,
          },
          {
            new: true,
            runValidators: true,
          },
        );

        if (!attendance) {
          throw new AppError(
            "Failed to update attendance record after duplicate key error",
            500,
          );
        }
      } else {
        throw error;
      }
    }

    // Update leave stats using AdjustLeaveStatsForUser
    if (approvedLeave && leaveDaysToRestore > 0) {
      await AdjustLeaveStatsForUser(
        user_id,
        attendanceDate.getFullYear(),
        approvedLeave.leave_type,
        leaveDaysToRestore,
        "restore",
      );
    }

    return {
      message: approvedLeave
        ? `Checked in successfully. ${leaveOverrideMessage}`
        : "Checked in successfully",
      attendance,
      is_remote,
      leave_override: approvedLeave
        ? {
            original_leave_type: approvedLeave.leave_type,
            restored_days: leaveDaysToRestore,
          }
        : null,
    };
  } else {
    // Find the latest open attendance (no check_out) within the last 24 hours
    // Checkout logic
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 1);

    let attendance = await Attendances.findOne({
      user_id,
      check_in: { $gte: cutoffDate },
      check_out: { $exists: false },
    }).sort({ check_in: -1 });

    if (!attendance || !attendance.check_in) {
      throw new AppError("User has not checked in.", 400);
    }
    if (attendance.check_out) {
      throw new AppError("User has already checked out.", 409);
    }

    attendance.check_out = now;
    // Format date string in Pakistan timezone
    const options = { year: "numeric", month: "short", day: "numeric" };
    const dateStr = new Date(attendance.date).toLocaleDateString("en-US", {
      ...options,
      timeZone: "Asia/Karachi",
    });

    function truncateToMinutes(date) {
      const d = new Date(date);
      d.setSeconds(0, 0); // Remove seconds and milliseconds
      return d;
    }

    const checkinTime = truncateToMinutes(attendance.check_in);
    const checkoutTime = truncateToMinutes(now);

    let totalMinutes = Math.floor((checkoutTime - checkinTime) / (1000 * 60));
    totalMinutes = Math.max(totalMinutes, 0); // Ensure no negative values

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    attendance.production_time = `${hours}h ${minutes}m`;
    // const wasLateAtCheckIn = attendance.is_late || false;
    const isRemoteCheckIn = attendance.status == "remote" || false;

    // Check if user has approved half-day leave for this date
    const approvedHalfDayLeave = await Leave.findOne({
      user: user_id,
      status: "approved",
      is_half_day: true,
      start_date: { $lte: attendance.date },
      end_date: { $gte: attendance.date },
    });

    // Handle statuses and leave deductions
    if (totalMinutes < 270) {
      // Less than 4.5 hours
      if (approvedHalfDayLeave) {
        // Replace half-day leave with full-day leave
        attendance.status = "auto-leave";
        attendance.analysis = `User had approved half-day ${approvedHalfDayLeave.leave_type} leave but worked only ${hours}h ${minutes}m (<4.5h), so leave upgraded to full-day.`;

        // Update existing half-day leave to full-day
        await Leave.findByIdAndUpdate(approvedHalfDayLeave._id, {
          is_half_day: false,
          total_days: 1,
          reason: `Auto-upgraded from half-day: Worked less than 4.5 hours (${hours}h ${minutes}m)`,
        });

        // Adjust stats: Remove 0.5 days, then apply 1 day = net add 0.5 days
        await AdjustLeaveStatsForUser(
          user_id,
          attendance.date.getFullYear(),
          approvedHalfDayLeave.leave_type,
          0.5,
          "apply",
        );

        await sendUserNotification(
          user_id,
          `half-day ${approvedHalfDayLeave.leave_type} leave on ${dateStr} was automatically upgraded to full-day leave due to working less than 4.5 hours (${hours}h ${minutes}m).`,
          true,
        );
      } else {
        // No half-day leave, apply full day auto-leave
        attendance.status = "auto-leave";
        attendance.analysis = `User worked only ${hours}h ${minutes}m (<4.5h). Marked as full-day unpaid leave.`;

        const leaveData = {
          user: user_id,
          leave_type: "unpaid",
          start_date: attendance.date,
          end_date: attendance.date,
          total_days: 1,
          team: user.team,
          reason: "Auto-applied: Worked less than 4.5 hours",
          is_half_day: false,
          status: "approved",
          action_taken_by: "AMS",
        };
        await leaveQueue.add({ leaveData });

        await AdjustLeaveStatsForUser(
          user_id,
          attendance.date.getFullYear(),
          "unpaid",
          1,
          "apply",
        );
        await sendUserNotification(
          user_id,
          `attendance was automatically marked as full-day unpaid leave on ${dateStr} due to working less than 4.5 hours (${hours}h ${minutes}m).`,
          true,
        );
      }
    } else if (totalMinutes < 390) {
      attendance.is_half_day = true;
      // 4.5–6.5 hours
      if (approvedHalfDayLeave) {
        // Keep half-day leave, just mark attendance as half-day
        attendance.status = "half-day";
        attendance.analysis = `User had approved half-day ${approvedHalfDayLeave.leave_type} leave and worked ${hours}h ${minutes}m (4.5–6.5h). Counted as half-day.`;

        await sendUserNotification(
          user_id,
          `attendance marked as half-day on ${dateStr} due to approved half-day ${approvedHalfDayLeave.leave_type} leave. Worked ${hours}h ${minutes}m.`,
          false,
        );
      } else {
        // No half-day leave, apply auto-half-day
        attendance.status = "auto-half-day";
        attendance.analysis = `User worked ${hours}h ${minutes}m (4.5–6.5h) without any approved leave. Auto-marked as half-day unpaid leave.`;

        const leaveData = {
          user: user_id,
          leave_type: "unpaid",
          start_date: attendance.date,
          end_date: attendance.date,
          total_days: 0.5,
          team: user.team,
          reason: "Auto-applied: Worked less than 6.5 hours",
          is_half_day: true,
          status: "approved",
          action_taken_by: "AMS",
        };
        await leaveQueue.add({ leaveData });

        await AdjustLeaveStatsForUser(
          user_id,
          attendance.date.getFullYear(),
          "unpaid",
          0.5,
          "apply",
        );
        await sendUserNotification(
          user_id,
          `attendance was automatically marked as half-day unpaid leave on ${dateStr} due to working less than 6.5 hours (${hours}h ${minutes}m).`,
          true,
        );
      }
    } else if (totalMinutes < 480) {
      // 6.5–8 hours → early leave (just mark, don't apply leave)
      const earlyLeavesThisMonth = await countEarlyLeavesInMonth(
        user_id,
        attendance.date,
      );

      attendance.status = "early-leave";
      attendance.analysis = `User worked ${hours}h ${minutes}m (6.5–8h). Early leave recorded (${
        earlyLeavesThisMonth + 1
      }/2 used this month).`;

      // Remove any half-day leave if it exists, restore stats if necessary
      if (approvedHalfDayLeave) {
        await Leave.findByIdAndDelete(approvedHalfDayLeave._id);
        await AdjustLeaveStatsForUser(
          user_id,
          attendance.date.getFullYear(),
          approvedHalfDayLeave.leave_type,
          0.5,
          "restore",
        );

        attendance.analysis += ` Approved half-day ${approvedHalfDayLeave.leave_type} leave removed and 0.5 days restored.`;
      }

      await sendUserNotification(
        user_id,
        `early check out detected on ${dateStr} with ${hours}h ${minutes}m worked. Marked as early leave only (no leave applied).`,
        false,
      );
    }

    // else if (totalMinutes < 480) {
    //   // 6.5–8 hours → early leave logic
    //   const earlyLeavesThisMonth = await countEarlyLeavesInMonth(
    //     user_id,
    //     attendance.date
    //   );

    //   if (approvedHalfDayLeave) {
    //     // Remove half-day leave and restore stats
    //     await Leave.findByIdAndDelete(approvedHalfDayLeave._id);

    //     await AdjustLeaveStatsForUser(
    //       user_id,
    //       attendance.date.getFullYear(),
    //       approvedHalfDayLeave.leave_type,
    //       0.5,
    //       "restore"
    //     );

    //     if (earlyLeavesThisMonth >= 2) {
    //       // Apply early leave penalty
    //       attendance.status = "auto-half-day";
    //       attendance.analysis = `User worked ${hours}h ${minutes}m (6.5–8h) and exceeded monthly early leave limit (${earlyLeavesThisMonth}). Auto-marked as half-day unpaid leave.`;

    //       attendance.is_half_day = true;

    //       const leaveData = {
    //         user: user_id,
    //         leave_type: "unpaid",
    //         start_date: attendance.date,
    //         end_date: attendance.date,
    //         total_days: 0.5,
    //         team: user.team,
    //         reason:
    //           "Auto-applied: Early leave exceeded monthly limit (worked 6.5-8 hours)",
    //         is_half_day: true,
    //         status: "approved",
    //         action_taken_by: "AMS",
    //       };
    //       await leaveQueue.add({ leaveData });

    //       await AdjustLeaveStatsForUser(
    //         user_id,
    //         attendance.date.getFullYear(),
    //         "unpaid",
    //         0.5,
    //         "apply"
    //       );

    //       await sendUserNotification(
    //         user_id,
    //         `approved half-day ${approvedHalfDayLeave.leave_type} leave on ${dateStr} was removed and replaced with unpaid half-day leave due to exceeding monthly early leave limit. Worked ${hours}h ${minutes}m.`,
    //         true
    //       );
    //     } else {
    //       // Within limit, just early leave
    //       attendance.status = "early-leave";
    //       attendance.analysis = `User had approved half-day ${approvedHalfDayLeave.leave_type} leave but worked ${hours}h ${minutes}m (6.5–8h). Early leave exceeded limit, so half-day unpaid leave applied.`;

    //       await sendUserNotification(
    //         user_id,
    //         `approved half-day ${
    //           approvedHalfDayLeave.leave_type
    //         } leave on ${dateStr} was removed. Early check out detected with ${hours}h ${minutes}m worked. This counts as early leave (${
    //           earlyLeavesThisMonth + 1
    //         }/2 for this month).`,
    //         false
    //       );
    //     }
    //   } else {
    //     if (earlyLeavesThisMonth >= 2) {
    //       // No half-day leave, apply auto-half-day for exceeding early leave limit
    //       attendance.status = "auto-half-day";
    //       attendance.analysis = `User worked ${hours}h ${minutes}m (6.5–8h) and exceeded monthly early leave limit (${earlyLeavesThisMonth}). Auto-marked as half-day unpaid leave.`;

    //       attendance.is_half_day = true;

    //       const leaveData = {
    //         user: user_id,
    //         leave_type: "unpaid",
    //         start_date: attendance.date,
    //         end_date: attendance.date,
    //         total_days: 0.5,
    //         team: user.team,
    //         reason:
    //           "Auto-applied: Early leave exceeded monthly limit (worked 6.5-8 hours)",
    //         is_half_day: true,
    //         status: "approved",
    //         action_taken_by: "AMS",
    //       };
    //       await leaveQueue.add({ leaveData });

    //       await AdjustLeaveStatsForUser(
    //         user_id,
    //         attendance.date.getFullYear(),
    //         "unpaid",
    //         0.5,
    //         "apply"
    //       );

    //       await sendUserNotification(
    //         user_id,
    //         `attendance was automatically marked as half-day unpaid leave on ${dateStr} due to exceeding monthly early leave limit. Worked ${hours}h ${minutes}m and have already taken ${earlyLeavesThisMonth} early leaves this month.`,
    //         true
    //       );
    //     } else {
    //       // Within early leave limit
    //       attendance.status = "early-leave";
    //       attendance.analysis = `User worked ${hours}h ${minutes}m (6.5–8h). Early leave recorded (${
    //         earlyLeavesThisMonth + 1
    //       }/2 used this month).`;

    //       await sendUserNotification(
    //         user_id,
    //         `early check out detected on ${dateStr} with ${hours}h ${minutes}m worked. This counts as early leave (${
    //           earlyLeavesThisMonth + 1
    //         }/2 for this month).`,
    //         false
    //       );
    //     }
    //   }
    // }
    else {
      // 8+ hours → full day present
      if (approvedHalfDayLeave) {
        // Delete half-day leave and restore stats
        await Leave.findByIdAndDelete(approvedHalfDayLeave._id);

        await AdjustLeaveStatsForUser(
          user_id,
          attendance.date.getFullYear(),
          approvedHalfDayLeave.leave_type,
          0.5,
          "restore",
        );
        attendance.analysis = `User completed full-day work (${hours}h ${minutes}m) despite having approved half-day ${approvedHalfDayLeave.leave_type} leave. Leave removed and 0.5 days restored.`;

        await sendUserNotification(
          user_id,
          `approved half-day ${approvedHalfDayLeave.leave_type} leave on ${dateStr} was removed as full-day attendance (${hours}h ${minutes}m) was completed. 0.5 days restored to leave balance.`,
          false,
        );
      }

      // attendance.status = wasLateAtCheckIn ? "late" : "present";
      attendance.status = isRemoteCheckIn ? "remote" : "present";
      attendance.analysis = `User worked ${hours}h ${minutes}m (≥8h). Marked as full-day present${
        isRemoteCheckIn ? " (remote)" : ""
      }.`;
    }

    attendance.updated_by = marked_by;
    await attendance.save();

    return { message: "Checked out successfully", attendance, is_remote };
  }
};

export const MarkAttendanceByAdminService = async ({
  user_id,
  date,
  check_in,
  check_out,
  status,
  marked_by,
}) => {
  const user = await Users.findById(user_id).populate("team");
  if (!user) throw new AppError("User not found", 404);

  const config = await OfficeConfigs.findOne();
  if (!config) throw new AppError("Config not found", 400);

  const actingUser = await Users.findById(marked_by).select(
    "first_name last_name",
  );
  if (!actingUser) throw new AppError("Invalid admin user", 400);

  const { checkin_time } =
    await WorkingHoursService.GetWorkingHoursByUserIdService(user_id);

  const attendanceDate = new Date(date);
  attendanceDate.setUTCHours(0, 0, 0, 0);

  // Delete existing leaves for this date
  await Leave.deleteMany({
    user: user_id,
    start_date: attendanceDate,
    end_date: attendanceDate,
  });

  let is_late = false;
  let production_time;
  let finalStatus = status || "present";
  let totalMinutes = 0;
  let analysis = "";

  if (check_in) {
    const checkinTimeOnly = new Date(checkin_time);
    checkinTimeOnly.setFullYear(1970, 0, 1);

    const actualCheckin = new Date(check_in);
    const actualCheckinOnly = new Date(actualCheckin);
    actualCheckinOnly.setFullYear(1970, 0, 1);

    const bufferTime = config.buffer_time_minutes || 30;
    const timeDiffMinutes = Math.floor(
      (actualCheckinOnly - checkinTimeOnly) / (1000 * 60),
    );
    is_late = timeDiffMinutes > bufferTime;
  }

  if (check_in && check_out) {
    const ci = new Date(check_in);
    const co = new Date(check_out);

    totalMinutes = Math.floor((co - ci) / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    production_time = `${hours}h ${minutes}m`;

    // Status logic same as checkout
    if (totalMinutes < 270) {
      finalStatus = "auto-leave";
      analysis =
        "Worked less than 4.5 hours. Admin-marked auto-leave (unpaid).";
      await leaveQueue.add({
        leaveData: {
          user: user_id,
          leave_type: "unpaid",
          start_date: attendanceDate,
          end_date: attendanceDate,
          total_days: 1,
          team: user.team,
          reason: "Admin edit: Worked less than 4.5 hours",
          is_half_day: false,
          status: "approved",
          action_taken_by: `${actingUser.first_name} ${actingUser.last_name}`,
        },
      });

      await AdjustLeaveStatsForUser(
        user_id,
        attendanceDate.getFullYear(),
        "unpaid",
        1,
        "apply",
      );
    } else if (totalMinutes < 390) {
      finalStatus = "auto-half-day";
      analysis = "Worked less than 6.5 hours. Admin-marked half-day (unpaid).";

      await leaveQueue.add({
        leaveData: {
          user: user_id,
          leave_type: "unpaid",
          start_date: attendanceDate,
          end_date: attendanceDate,
          total_days: 0.5,
          team: user.team,
          reason: "Admin edit: Worked less than 6.5 hours",
          is_half_day: true,
          status: "approved",
          action_taken_by: `${actingUser.first_name} ${actingUser.last_name}`,
        },
      });

      await AdjustLeaveStatsForUser(
        user_id,
        attendanceDate.getFullYear(),
        "unpaid",
        0.5,
        "apply",
      );
    } else if (totalMinutes < 480) {
      finalStatus = "early-leave";
      analysis = "Worked less than 8 hours. Admin-marked early-leave.";
    } else {
      finalStatus = is_late ? "late" : "present";
      analysis = is_late
        ? "Arrived after buffer time. Admin-marked as late."
        : "Worked full hours. Admin-marked present.";
    }
  } else if (check_in && !check_out) {
    finalStatus = is_late ? "late" : "present";
    analysis = is_late
      ? "Check-in recorded late. No check-out. Admin-marked as late."
      : "Only check-in recorded. Admin-marked as present.";
  } else if (!check_in && !check_out) {
    finalStatus = "leave";
    analysis = "No check-in/out. Admin-marked as leave (annual).";

    await leaveQueue.add({
      leaveData: {
        user: user_id,
        leave_type: "annual",
        start_date: attendanceDate,
        end_date: attendanceDate,
        total_days: 1,
        team: user.team,
        reason: "Admin-marked leave",
        is_half_day: false,
        status: "approved",
        action_taken_by: `${actingUser.first_name} ${actingUser.last_name}`,
      },
    });

    await AdjustLeaveStatsForUser(
      user_id,
      attendanceDate.getFullYear(),
      "annual",
      1,
      "apply",
    );
  }
  // Remote work check — override if approved
  const remoteWorkApproved = await RemoteWorkRequests.exists({
    user_id,
    status: "approved",
    start_date: { $lte: attendanceDate },
    end_date: { $gte: attendanceDate },
  });

  if (remoteWorkApproved) {
    finalStatus = "remote";
    analysis = "User had approved remote work for this date. Marked remote.";
  }
  // Save/update attendance
  const attendance = await Attendances.findOneAndUpdate(
    { user_id, date: attendanceDate },
    {
      $set: {
        user_id,
        date: attendanceDate,
        check_in,
        check_out,
        status: finalStatus,
        production_time,
        is_late,
        updated_by: marked_by,
        created_by: marked_by,
        analysis,
      },
    },
    { upsert: true, new: true },
  );

  return attendance;
};

// Helper function to calculate working days between two dates
function calculateWorkingDays(startDate, endDate) {
  let count = 0;
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Not Sunday (0) or Saturday (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

export const EditAttendanceByAdminService = async ({
  attendance_id,
  updates,
  updated_by,
}) => {
  const actingUser = await Users.findById(updated_by).select(
    "first_name last_name",
  );
  if (!actingUser)
    throw new AppError("Invalid user performing the action", 400);

  const toLocalMidnight = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const countEarlyLeavesInMonth = async (user_id, date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    return await Attendances.countDocuments({
      user_id,
      date: { $gte: startOfMonth, $lte: endOfMonth },
      status: "early-leave",
    });
  };

  const attendance = await Attendances.findById(attendance_id).populate(
    "user_id",
    "first_name last_name email employee_id team _id",
  );

  if (!attendance) throw new AppError("Attendance record not found", 404);

  const config = await OfficeConfigs.findOne();
  if (!config) throw new AppError("Config not found", 400);

  const { checkin_time } =
    await WorkingHoursService.GetWorkingHoursByUserIdService(
      attendance.user_id._id,
    );

  const today = toLocalMidnight(new Date());
  const attendanceDate = toLocalMidnight(attendance.date);

  if (attendanceDate > today)
    throw new AppError("Cannot edit attendance for future dates.", 400);

  if (updates.date) {
    const updatedDate = toLocalMidnight(updates.date);
    if (updatedDate > today)
      throw new AppError("Cannot set attendance to a future date.", 400);
    updates.date = updatedDate;
  }

  // 🔹 Check if checkout is being removed
  // Checkout is being removed if:
  // 1. It existed before AND
  // 2. It's explicitly set to null/undefined in updates, OR it's not in updates at all (omitted)
  const hadCheckoutBefore = attendance.check_out != null;
  const checkoutExplicitlyRemoved =
    updates.check_out !== undefined &&
    (updates.check_out === null || updates.check_out === undefined);
  const checkoutOmitted = !("check_out" in updates) && hadCheckoutBefore;
  const isRemovingCheckout =
    hadCheckoutBefore && (checkoutExplicitlyRemoved || checkoutOmitted);

  const allowedFields = ["check_in", "check_out", "date", "status"];
  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key) && updates[key] !== undefined) {
      if (key !== "status") {
        if (
          (key === "check_in" || key === "check_out") &&
          updates[key] == null
        ) {
          attendance[key] = undefined;
        } else {
          attendance[key] = updates[key];
        }
      }
    }
  }

  // 🔹 Explicitly remove checkout if it's being removed (even if not in updates)
  if (isRemovingCheckout) {
    attendance.check_out = null;
    attendance.production_time = null;
    // Mark as modified to ensure Mongoose saves the change
    attendance.markModified("check_out");
    attendance.markModified("production_time");
  }

  const leaveDate = updates.date || attendance.date;

  // 🔹 If checkout is being removed, handle unpaid leave restoration
  let deletedUnpaidLeaveIds = [];
  if (isRemovingCheckout) {
    // Find unpaid leave records for this date (especially auto-generated ones from instant checkout)
    const unpaidLeaves = await Leave.find({
      user: attendance.user_id._id,
      start_date: leaveDate,
      end_date: leaveDate,
      leave_type: "unpaid",
      status: "approved",
    });

    // Restore leave balance for each unpaid leave
    for (const unpaidLeave of unpaidLeaves) {
      await AdjustLeaveStatsForUser(
        attendance.user_id._id,
        leaveDate.getFullYear(),
        unpaidLeave.leave_type,
        unpaidLeave.total_days,
        "restore",
      );
      deletedUnpaidLeaveIds.push(unpaidLeave._id);
    }

    // Delete unpaid leave records
    if (unpaidLeaves.length > 0) {
      await Leave.deleteMany({
        _id: { $in: deletedUnpaidLeaveIds },
      });
    }
  }

  // Delete all other leaves (non-unpaid or if checkout not being removed) for the date
  const existingLeaves = await Leave.find({
    user: attendance.user_id._id,
    start_date: leaveDate,
    end_date: leaveDate,
    ...(deletedUnpaidLeaveIds.length > 0
      ? { _id: { $nin: deletedUnpaidLeaveIds } }
      : {}),
  });

  for (const existingLeave of existingLeaves) {
    await AdjustLeaveStatsForUser(
      attendance.user_id._id,
      leaveDate.getFullYear(),
      existingLeave.leave_type,
      existingLeave.total_days,
      "restore",
    );
  }

  await Leave.deleteMany({
    user: attendance.user_id._id,
    start_date: leaveDate,
    end_date: leaveDate,
    ...(deletedUnpaidLeaveIds.length > 0
      ? { _id: { $nin: deletedUnpaidLeaveIds } }
      : {}),
  });

  let analysis = "";

  // ----- CASE 1: Admin explicitly set to leave -----
  if (updates.status === "leave") {
    attendance.check_in = undefined;
    attendance.check_out = undefined;
    attendance.production_time = undefined;
    attendance.is_late = undefined;
    attendance.status = "leave";
    analysis = "Admin manually marked as leave (annual).";

    await leaveQueue.add({
      leaveData: {
        user: attendance.user_id._id,
        leave_type: "annual",
        start_date: leaveDate,
        end_date: leaveDate,
        total_days: 1,
        team: attendance.user_id.team,
        reason: "Admin-marked leave",
        is_half_day: false,
        status: "approved",
        action_taken_by: `${actingUser.first_name} ${actingUser.last_name}`,
      },
    });

    await AdjustLeaveStatsForUser(
      attendance.user_id._id,
      leaveDate.getFullYear(),
      "annual",
      1,
      "apply",
    );
  }

  // ----- CASE 2: Check-in and check-out both exist -----
  // Skip this case if checkout was just removed
  else if (attendance.check_in && attendance.check_out && !isRemovingCheckout) {
    const checkinTimeOnly = new Date(checkin_time);
    checkinTimeOnly.setFullYear(1970, 0, 1);

    const actualCheckin = new Date(attendance.check_in);
    const actualCheckinOnly = new Date(actualCheckin);
    actualCheckinOnly.setFullYear(1970, 0, 1);

    const bufferTime = config.buffer_time_minutes || 30;
    const timeDiffMinutes = Math.floor(
      (actualCheckinOnly - checkinTimeOnly) / (1000 * 60),
    );
    attendance.is_late = timeDiffMinutes > bufferTime;

    const truncateToMinutes = (date) => {
      const d = new Date(date);
      d.setSeconds(0, 0);
      return d;
    };

    const ci = truncateToMinutes(attendance.check_in);
    const co = truncateToMinutes(attendance.check_out);

    const totalMinutes = Math.max(Math.floor((co - ci) / (1000 * 60)), 0);

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    attendance.production_time = `${hours}h ${minutes}m`;

    if (totalMinutes < 270) {
      attendance.status = "auto-leave";
      analysis = "Worked less than 4.5 hours. Admin edit: auto-leave applied.";

      await leaveQueue.add({
        leaveData: {
          user: attendance.user_id._id,
          leave_type: "unpaid",
          start_date: leaveDate,
          end_date: leaveDate,
          total_days: 1,
          team: attendance.user_id.team,
          reason: "Admin edit: Worked less than 4.5 hours",
          is_half_day: false,
          status: "approved",
          action_taken_by: `${actingUser.first_name} ${actingUser.last_name}`,
        },
      });

      await AdjustLeaveStatsForUser(
        attendance.user_id._id,
        leaveDate.getFullYear(),
        "unpaid",
        1,
        "apply",
      );
    } else if (totalMinutes < 390) {
      attendance.status = "auto-half-day";
      analysis = "Worked less than 6.5 hours. Admin edit: half-day applied.";

      await leaveQueue.add({
        leaveData: {
          user: attendance.user_id._id,
          leave_type: "unpaid",
          start_date: leaveDate,
          end_date: leaveDate,
          total_days: 0.5,
          team: attendance.user_id.team,
          reason: "Admin edit: Worked less than 6.5 hours",
          is_half_day: true,
          status: "approved",
          action_taken_by: `${actingUser.first_name} ${actingUser.last_name}`,
        },
      });

      await AdjustLeaveStatsForUser(
        attendance.user_id._id,
        leaveDate.getFullYear(),
        "unpaid",
        0.5,
        "apply",
      );
    } else if (totalMinutes < 480) {
      const earlyLeavesThisMonth = await countEarlyLeavesInMonth(
        attendance.user_id._id,
        leaveDate,
      );

      if (earlyLeavesThisMonth >= 2) {
        attendance.status = "auto-half-day";
        analysis =
          "Worked 6.5–8h and exceeded early-leave limit. Auto half-day applied.";

        await leaveQueue.add({
          leaveData: {
            user: attendance.user_id._id,
            leave_type: "unpaid",
            start_date: leaveDate,
            end_date: leaveDate,
            total_days: 0.5,
            team: attendance.user_id.team,
            reason: "Admin edit: Early leave exceeded monthly limit",
            is_half_day: true,
            status: "approved",
            action_taken_by: `${actingUser.first_name} ${actingUser.last_name}`,
          },
        });

        await AdjustLeaveStatsForUser(
          attendance.user_id._id,
          leaveDate.getFullYear(),
          "unpaid",
          0.5,
          "apply",
        );
      } else {
        attendance.status = "early-leave";
        analysis = "Worked less than 8h. Early leave marked (within limit).";
      }
    } else {
      attendance.status = attendance.is_late ? "late" : "present";
      analysis = attendance.is_late
        ? "Arrived late but completed full hours."
        : "Worked full hours, on-time.";
    }
  }

  // ----- CASE 3: Only check-in -----
  else if (attendance.check_in && !attendance.check_out) {
    const checkinTimeOnly = new Date(checkin_time);
    checkinTimeOnly.setFullYear(1970, 0, 1);

    const actualCheckin = new Date(attendance.check_in);
    const actualCheckinOnly = new Date(actualCheckin);
    actualCheckinOnly.setFullYear(1970, 0, 1);

    const bufferTime = config.buffer_time_minutes || 30;
    const timeDiffMinutes = Math.floor(
      (actualCheckinOnly - checkinTimeOnly) / (1000 * 60),
    );

    attendance.is_late = timeDiffMinutes > bufferTime;
    attendance.status = attendance.is_late ? "late" : "present";
    attendance.production_time = undefined;

    analysis = attendance.is_late
      ? "Checked in late, no check-out."
      : "Checked in on time, no check-out recorded.";
  }

  // ----- CASE 4: No times -----
  else if (!attendance.check_in && !attendance.check_out) {
    attendance.status = "leave";
    attendance.is_late = undefined;
    attendance.production_time = undefined;
    analysis = "No check-in or check-out. Admin-marked as leave.";

    await leaveQueue.add({
      leaveData: {
        user: attendance.user_id._id,
        leave_type: "annual",
        start_date: leaveDate,
        end_date: leaveDate,
        total_days: 1,
        team: attendance.user_id.team,
        reason: "Admin-marked leave (no times)",
        is_half_day: false,
        status: "approved",
        action_taken_by: `${actingUser.first_name} ${actingUser.last_name}`,
      },
    });

    await AdjustLeaveStatsForUser(
      attendance.user_id._id,
      leaveDate.getFullYear(),
      "annual",
      1,
      "apply",
    );
  }

  // 🔹 Remote Work Check — override
  const remoteWorkApproved = await RemoteWorkRequests.exists({
    user_id: attendance.user_id._id,
    status: "approved",
    start_date: { $lte: leaveDate },
    end_date: { $gte: leaveDate },
  });

  if (remoteWorkApproved) {
    attendance.status = "remote";
    analysis = "User had approved remote work for this date. Marked remote.";
  }

  // ✅ Save the updated attendance
  attendance.analysis = analysis;
  attendance.updated_by = updated_by;

  // If checkout was removed, use $unset to ensure it's removed from database
  if (isRemovingCheckout) {
    const updateData = {
      $set: {
        analysis,
        updated_by,
        check_in: attendance.check_in,
        status: attendance.status,
        is_late: attendance.is_late,
      },
      $unset: {
        check_out: "",
      },
    };

    // Only unset production_time if it's null/undefined
    if (
      attendance.production_time === null ||
      attendance.production_time === undefined
    ) {
      updateData.$unset.production_time = "";
    } else {
      updateData.$set.production_time = attendance.production_time;
    }

    const updatedAttendance = await Attendances.findByIdAndUpdate(
      attendance._id,
      updateData,
      { new: true },
    ).populate("user_id", "first_name last_name email employee_id team _id");

    return updatedAttendance;
  } else {
    await attendance.save();
    return attendance;
  }
};

export const GetAttendanceRecordsService = async ({
  user_id,
  filter_type,
  month,
  year,
  date,
  start_date,
  end_date,
  role,
}) => {
  let filter = {};
  if (role === "employee" && !user_id) {
    throw new AppError(
      "Unauthorized access: Employees must provide their user_id.",
      401,
    );
  }

  if (user_id) {
    filter.user_id = user_id;
  }
  if (filter_type === "monthly" && month && year) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    filter.date = { $gte: startOfMonth, $lte: endOfMonth };
  } else if (filter_type === "weekly") {
    const today = new Date();
    const firstDayOfWeek = new Date(
      today.setDate(today.getDate() - today.getDay()),
    );
    firstDayOfWeek.setHours(0, 0, 0, 0);
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
    lastDayOfWeek.setHours(23, 59, 59, 999);

    filter.date = { $gte: firstDayOfWeek, $lte: lastDayOfWeek };
  } else if (filter_type === "custom" && date) {
    const customDate = new Date(date);
    customDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(customDate);
    endOfDay.setHours(23, 59, 59, 999);

    filter.date = { $gte: customDate, $lte: endOfDay };
  } else if (filter_type === "custom_range" && start_date && end_date) {
    const startDate = new Date(start_date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end_date);
    endDate.setHours(23, 59, 59, 999);

    filter.date = { $gte: startDate, $lte: endDate };
  }
  const attendanceRecords = await Attendances.find(filter).populate(
    "user_id",
    "first_name last_name email employee_id _id",
  );
  const users = attendanceRecords.user_id;
  attendanceRecords;
  return { attendance: attendanceRecords };
};

export const GetTodaysAttendanceService = async (user, user_id) => {
  const now = new Date();
  const currentHour = now.getHours();

  // If current time is before 6 AM, fetch yesterday's record
  const targetDate = new Date(now);
  if (currentHour < 1) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  const dateStr = targetDate.toISOString().split("T")[0];

  const startOfDay = new Date(dateStr);
  const endOfDay = new Date(dateStr);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const filter = {
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  };

  if (user_id) {
    filter.user_id = user_id;
  } else if (user.role !== "admin") {
    filter.user_id = user._id;
  }

  const attendanceRecords = await Attendances.find(filter).populate(
    "user_id",
    "first_name last_name employee_id profile_picture designation",
  );

  if (!attendanceRecords.length) {
    return {};
  }

  if (user_id || user.role !== "admin") {
    const attendance = attendanceRecords[0];
    return {
      attendance: {
        check_in: attendance.check_in,
        check_out: attendance.check_out,
        date: attendance.date,
        production_time: attendance.production_time,
        status: attendance.status,
        is_late: attendance.is_late || false,
      },
    };
  }

  const allAttendance = attendanceRecords.map((record) => ({
    user: record.user_id
      ? {
          first_name: record.user_id.first_name,
          last_name: record.user_id.last_name,
          employee_id: record.user_id.employee_id,
          profile_picture: record.user_id.profile_picture,
          designation: record.user_id.designation,
        }
      : null,
    check_in: record.check_in,
    check_out: record.check_out,
    date: record.date,
    production_time: record.production_time,
    status: record.status,
    is_late: record.is_late || false,
  }));

  return {
    attendance: allAttendance,
  };
};

// Helper function to calculate working days between two dates based on config
const calculateWorkingDaysInRange = (
  startDate,
  endDate,
  workingDays = [1, 2, 3, 4, 5],
) => {
  let count = 0;
  let current = new Date(startDate);
  const end = new Date(endDate);

  // Normalize dates to start of day for accurate comparison
  current.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // Check if current day is in the working days array
    if (workingDays.includes(dayOfWeek)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
};

export const GetAttendanceStatsService = async (
  user,
  filter_type,
  user_id,
  start_date,
  end_date,
) => {
  let startDate, endDate;
  const applyDateFilter = filter_type && filter_type !== "all";

  if (applyDateFilter) {
    try {
      const dateRange = getDateRangeFromFilter(
        filter_type,
        start_date,
        end_date,
      );
      startDate = dateRange.startDate;
      endDate = dateRange.endDate || new Date();
    } catch (error) {
      throw new AppError(error.message, 400);
    }
  }
  const filter = {};

  if (user.role === "admin" && user_id) {
    filter.user_id = user_id;
  } else if (user.role !== "admin") {
    filter.user_id = user._id;
  }

  if (applyDateFilter) {
    filter.date = { $gte: startDate, $lte: endDate };
  }

  const records = await Attendances.find(filter);

  // Get working days configuration from office config
  let totalWorkingDays = 0;
  if (applyDateFilter && startDate && endDate) {
    try {
      const config = await OfficeConfigs.findOne();
      const workingDays = config?.working_days || [1, 2, 3, 4, 5]; // Default: Mon-Fri
      totalWorkingDays = calculateWorkingDaysInRange(
        startDate,
        endDate,
        workingDays,
      );
    } catch (error) {
      console.error("Error fetching config for working days:", error);
      // Fallback to default (Mon-Fri)
      totalWorkingDays = calculateWorkingDaysInRange(startDate, endDate);
    }
  }

  // Calculate total present days (unique days when user was at work)
  // Includes: present (on-time or late), early-leave, remote, half-day, auto-half-day
  // Excludes: leave, auto-leave, absent (no record)
  // Note: Uses Set to ensure each day is counted only once, even if user was late AND half-day
  const workStatuses = [
    "present",
    "late",
    "early-leave",
    "remote",
    "half-day",
    "auto-half-day",
  ];
  const workDaysSet = new Set();
  records.forEach((r) => {
    // Check if status indicates user was at work (not on leave)
    // Also include any record with is_late === true (they were present but late, regardless of status)
    const isWorkStatus = workStatuses.includes(r.status);
    const isLateButPresent =
      r.is_late === true && r.status !== "leave" && r.status !== "auto-leave";

    if (isWorkStatus || isLateButPresent) {
      // Use date string as key to ensure unique days
      const dateKey = new Date(r.date).toISOString().split("T")[0];
      workDaysSet.add(dateKey);
    }
  });
  const total_present = workDaysSet.size;

  const stats = {
    total_days: records.length,
    total_working_days: totalWorkingDays,
    total_present: total_present,
    present: records.filter(
      (r) => r.status === "present" && r.is_late === false,
    ).length,
    late: records.filter(
      (r) =>
        r.is_late === true && r.status !== "leave" && r.status !== "auto-leave",
    ).length,
    half_day: records.filter(
      (r) => r.status === "half-day" || r.status === "auto-half-day",
    ).length,
    remote: records.filter((r) => r.status === "remote").length,
    leave: records.filter(
      (r) => r.status === "leave" || r.status === "auto-leave",
    ).length,
    early_leave: records.filter((r) => r.status === "early-leave").length,
    average_production_time: calculateAverageProductionTime(records),
  };

  return {
    stats,
  };
};

const calculateAverageProductionTime = (records) => {
  const validRecords = records.filter((r) => r.production_time);
  if (validRecords.length === 0) return "0 h 0 m";

  const totalMinutes = validRecords.reduce((sum, record) => {
    const [hours, minutes] = record.production_time.match(/\d+/g);
    return sum + parseInt(hours) * 60 + parseInt(minutes);
  }, 0);

  const avgMinutes = Math.round(totalMinutes / validRecords.length);
  const hours = Math.floor(avgMinutes / 60);
  const mins = avgMinutes % 60;

  return `${hours} h ${mins} m`;
};

export const GetAttendanceStatusByDateService = async (user_id, date) => {
  if (!user_id || !date) {
    throw new AppError("Both user and date are required", 400);
  }

  const queryDate = new Date(date);

  const attendance = await Attendances.findOne({
    user_id,
    date: queryDate,
  }).populate("user_id", "first_name last_name employee_id");

  if (!attendance) {
    return {
      data: null,
    };
  }

  return {
    data: {
      // user: {
      //   id: attendance.user_id._id,
      //   name: `${attendance.user_id.first_name} ${attendance.user_id.last_name}`,
      //   employee_id: attendance.user_id.employee_id,
      // },
      // date: attendance.date,
      // check_in: attendance.check_in,
      // check_out: attendance.check_out,
      status: attendance.status,
      // is_late: attendance.is_late,
      // production_time: attendance.production_time,
    },
  };
};

export const GetAttendanceHistoryService = async (
  user,
  filter_type,
  start_date,
  end_date,
  status,
  user_id,
  page = 1,
  limit = 10,
  search,
  department_id,
  employment_type,
) => {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const {
    page: parsedPage,
    limit: parsedLimit,
    skip,
  } = getPagination(page, limit);

  const matchStage = [];
  let filterDate = null;

  // ✅ Date Filtering
  if (filter_type) {
    try {
      const { startDate, endDate: rawEndDate } = getDateRangeFromFilter(
        filter_type,
        start_date,
        end_date,
      );

      let cappedEndDate = rawEndDate > now ? now : rawEndDate;

      if (filter_type === "this_week" || filter_type === "this_month") {
        cappedEndDate = rawEndDate;
      }

      matchStage.push({ date: { $gte: startDate, $lte: cappedEndDate } });

      if (startDate.toDateString() === cappedEndDate.toDateString()) {
        filterDate = startDate;
      }
    } catch (error) {
      throw new AppError(error.message, 500);
    }
  } else {
    matchStage.push({ date: { $lte: now } });
  }

  // ✅ Status Filtering
  if (status && status !== "awaiting") {
    const statusMap = {
      present: [{ status: "present" }],
      "half-day": [{ status: "half-day" }, { status: "auto-half-day" }],
      leave: [{ status: "leave" }, { status: "auto-leave" }],
    };

    if (status === "late") {
      // Only fetch records where user was late
      matchStage.push({ is_late: true });
    } else if (statusMap[status]) {
      matchStage.push({ $or: statusMap[status] });
    } else {
      matchStage.push({ status });
    }
  }

  let userFilterIds = null;

  // ✅ Department & Employment Type Filtering
  if ((department_id || employment_type) && user.role === "admin") {
    let teamIds = [];
    if (department_id) {
      const department = await Departments.findById(department_id).lean();
      if (!department) throw new AppError("Invalid department ID", 400);
      teamIds = department.teams || [];
    }

    const userFilter = {};
    if (teamIds.length) userFilter.team = { $in: teamIds };
    if (employment_type) userFilter.employment_status = employment_type;

    const users = await Users.find(userFilter, { _id: 1 });
    userFilterIds = users.map((u) => u._id);
    matchStage.push({ user_id: { $in: userFilterIds } });
  }

  // ✅ Admin vs Normal User
  if (user.role === "admin") {
    if (user_id) {
      matchStage.push({ user_id: new mongoose.Types.ObjectId(user_id) });
    }
  } else {
    matchStage.push({ user_id: new mongoose.Types.ObjectId(user._id) });
  }

  // Handle search with spaces - search in concatenated full name
  let searchRegex = null;
  let searchPattern = null;
  if (search) {
    // Escape special regex characters
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    searchRegex = new RegExp(escapedSearch, "i");
    searchPattern = escapedSearch;
  }

  // ✅ Awaiting Users (single day filter)
  if (status === "awaiting" && filterDate && user.role === "admin") {
    const attendanceUsers = await Attendances.find({
      date: filterDate,
      ...(userFilterIds ? { user_id: { $in: userFilterIds } } : {}),
    }).distinct("user_id");

    const userSearchFilter = {
      ...(userFilterIds ? { _id: { $in: userFilterIds } } : {}),
      _id: { $nin: attendanceUsers },
      role: { $ne: "admin" },
      is_active: true,
    };

    if (searchRegex) {
      userSearchFilter.$or = [
        { first_name: searchRegex },
        { last_name: searchRegex },
        { employee_id: searchRegex },
        // Search in concatenated full name for queries like "zeeshan ali"
        {
          $expr: {
            $regexMatch: {
              input: {
                $concat: [
                  { $ifNull: ["$first_name", ""] },
                  " ",
                  { $ifNull: ["$last_name", ""] },
                ],
              },
              regex: searchPattern,
              options: "i",
            },
          },
        },
      ];
    }

    const total = await Users.countDocuments(userSearchFilter);
    const users = await Users.find(userSearchFilter)
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const records = users.map((u) => ({
      _id: null,
      user: {
        _id: u._id,
        first_name: u.first_name,
        last_name: u.last_name,
        employee_id: u.employee_id,
        is_active: u.is_active,
        designation: u.designation,
        profile_picture: u.profile_picture,
        role: u.role,
      },
      date: filterDate,
      status: "awaiting",
      check_in: null,
      check_out: null,
      production_time: null,
      is_late: false,
      createdAt: null,
      updatedAt: null,
    }));

    const totalPages = Math.ceil(total / parsedLimit);
    return {
      records,
      total,
      currentPage: parsedPage,
      totalPages,
      hasMorePages: parsedPage < totalPages,
    };
  }

  // ✅ Normal Attendance Fetch
  const pipeline = [
    { $match: matchStage.length ? { $and: matchStage } : {} },
    {
      $lookup: {
        from: "users",
        localField: "user_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
  ];
  pipeline.push({
    $match: { "user.is_active": true },
  });

  if (searchRegex) {
    pipeline.push({
      $match: {
        $or: [
          { "user.first_name": searchRegex },
          { "user.last_name": searchRegex },
          { "user.employee_id": searchRegex },
          // Search in concatenated full name for queries like "zeeshan ali"
          {
            $expr: {
              $regexMatch: {
                input: {
                  $concat: [
                    { $ifNull: ["$user.first_name", ""] },
                    " ",
                    { $ifNull: ["$user.last_name", ""] },
                  ],
                },
                regex: searchPattern,
                options: "i",
              },
            },
          },
        ],
      },
    });
  }

  // Sort by date in descending order (most recent first) for proper chronological ordering
  pipeline.push({ $sort: { date: -1 } });

  const attendance = await Attendances.aggregate(pipeline);

  let records = attendance.map((record) => ({
    _id: record._id,
    user: {
      _id: record.user._id,
      first_name: record.user.first_name,
      last_name: record.user.last_name,
      employee_id: record.user.employee_id,
      is_active: record.user.is_active,
      designation: record.user.designation,
      profile_picture: record.user.profile_picture,
      role: record.user.role,
    },
    date: record.date,
    status: record.status,
    check_in: record.check_in,
    check_out: record.check_out,
    production_time: record.production_time,
    is_late: record.is_late,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));

  // ✅ Merge Awaiting Records if filterDate is valid & no status
  if (filterDate && user.role === "admin" && !status) {
    const attendedUserIds = new Set(records.map((r) => r.user._id.toString()));

    const userSearchFilter = {
      ...(userFilterIds ? { _id: { $in: userFilterIds } } : {}),
      role: { $ne: "admin" },
      is_active: true,
    };

    if (searchRegex) {
      userSearchFilter.$or = [
        { first_name: searchRegex },
        { last_name: searchRegex },
        { employee_id: searchRegex },
        // Search in concatenated full name for queries like "zeeshan ali"
        {
          $expr: {
            $regexMatch: {
              input: {
                $concat: [
                  { $ifNull: ["$first_name", ""] },
                  " ",
                  { $ifNull: ["$last_name", ""] },
                ],
              },
              regex: searchRegex.source,
              options: "i",
            },
          },
        },
      ];
    }

    const allRelevantUsers = await Users.find(userSearchFilter).lean();

    for (const u of allRelevantUsers) {
      if (!attendedUserIds.has(u._id.toString())) {
        records.push({
          _id: null,
          user: {
            _id: u._id,
            first_name: u.first_name,
            last_name: u.last_name,
            employee_id: u.employee_id,
            is_active: u.is_active,
            designation: u.designation,
            profile_picture: u.profile_picture,
            role: u.role,
          },
          date: filterDate,
          status: "awaiting",
          check_in: null,
          check_out: null,
          production_time: null,
          is_late: false,
          createdAt: null,
          updatedAt: null,
        });
      }
    }

    // ✅ Re-sort records by date after merging awaiting records to ensure chronological order
    records.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA; // Descending order (most recent first)
    });
  }
  // ✅ Calculate total productivity time (in ms)
  const totalProductivityMs = records.reduce((acc, r) => {
    return acc + (r.production_time ? r.production_time : 0);
  }, 0);

  // Convert ms → HH:mm format if you want readable output
  const formatDuration = (ms) => {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const totalProductivity = formatDuration(totalProductivityMs);

  // ✅ Total AFTER merging
  const total = records.length;
  const totalPages = Math.ceil(total / parsedLimit);

  // ✅ Pagination after merge
  const paginatedRecords = records.slice(skip, skip + parsedLimit);

  return {
    records: paginatedRecords,
    total,
    currentPage: parsedPage,
    totalPages,
    hasMorePages: parsedPage < totalPages,
  };
};

export const GetMonthlyAttendanceService = async (
  user,
  month,
  year,
  department_id,
  search,
  user_id,
  page = 1,
  limit = 10,
) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // Get working days configuration from office config
  let workingDaysConfig = [1, 2, 3, 4, 5]; // Default: Mon-Fri
  try {
    const config = await OfficeConfigs.findOne();
    if (config?.working_days) {
      workingDaysConfig = config.working_days;
    }
  } catch (error) {
    console.error("Error fetching config for working days:", error);
  }

  let teamIds = [];
  if (department_id) {
    const dept = await Departments.findById(department_id).lean();
    if (!dept) throw new AppError("Invalid department ID", 400);
    teamIds = dept.teams || [];
  }

  const userQuery = {
    role: { $ne: "admin" },
    is_active: true,
  };

  if (user.role === "admin") {
    if (user_id) {
      userQuery._id = user_id;
    } else {
      if (teamIds.length) userQuery.team = { $in: teamIds };
      if (search) {
        const terms = search.trim().split(/\s+/);
        const andConditions = terms.map((term) => {
          const regex = new RegExp(term, "i");
          return {
            $or: [
              { first_name: regex },
              { last_name: regex },
              { employee_id: regex },
            ],
          };
        });

        userQuery.$and = andConditions;
      }
    }
  } else {
    userQuery._id = user._id;
  }

  const totalUsers = await Users.countDocuments(userQuery);
  const skip = (page - 1) * limit;

  const users = await Users.find(userQuery, {
    _id: 1,
    first_name: 1,
    last_name: 1,
    employee_id: 1,
    designation: 1,
    team: 1,
    profile_picture: 1,
    role: 1,
  })
    .skip(skip)
    .limit(limit)
    .lean();

  const userIds = users.map((u) => u._id);

  const attendanceData = await Attendances.find({
    user_id: { $in: userIds },
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  // Calculate total working days for the month using config
  const totalWorkingDays = calculateWorkingDaysInRange(
    startDate,
    endDate,
    workingDaysConfig,
  );

  const results = users.map((user) => {
    const records = attendanceData.filter((a) => a.user_id.equals(user._id));
    records.sort(
      (a, b) => new Date(a.check_in || a.date) - new Date(b.check_in || b.date),
    );

    // Calculate total present days (unique days when user was at work)
    const workStatuses = [
      "present",
      "late",
      "early-leave",
      "remote",
      "half-day",
      "auto-half-day",
    ];
    const workDaysSet = new Set();
    records.forEach((r) => {
      const isWorkStatus = workStatuses.includes(r.status);
      const isLateButPresent =
        r.is_late === true && r.status !== "leave" && r.status !== "auto-leave";

      if (isWorkStatus || isLateButPresent) {
        const dateKey = new Date(r.date).toISOString().split("T")[0];
        workDaysSet.add(dateKey);
      }
    });
    const total_present = workDaysSet.size;

    const stats = {
      present: 0,
      absent: 0,
      leave: 0,
      late: 0,
      remote: 0,
      onTime: 0, // ✅ new
      halfDays: 0, // ✅ new
      earlyLeave: 0, // ✅ new
      totalDays: getWorkingDaysInMonth(month, year),
      total_working_days: totalWorkingDays,
      total_present: total_present,
      fine: 0,
      attendance: [],
    };

    const finePolicy = (lateCount) => {
      if (lateCount <= 3) return 0;
      else if (lateCount <= 5) return (lateCount - 3) * 500;
      else if (lateCount <= 10) return lateCount * 1000;
      else return lateCount * 1500;
    };

    records.forEach((r) => {
      stats.attendance.push({
        date: r.date,
        check_in: r.check_in,
        check_out: r.check_out,
        production_time: r.production_time,
        status: r.status,
        is_late: !!r.is_late,
        is_half_day:
          r.is_half_day ||
          r.status === "half-day" ||
          r.status === "auto-half-day" ||
          r.status === "remote-half-day",
        analysis: r.analysis || "",
      });

      // Check for early-leave status
      const normalizedStatus = r.status ? r.status.trim().toLowerCase() : "";
      const isEarlyLeave = normalizedStatus === "early-leave";

      if (
        r.status === "present" ||
        r.status === "half-day" ||
        r.status === "auto-half-day" ||
        r.status === "late" ||
        isEarlyLeave
      ) {
        stats.present++;
      }

      if (r.status === "absent") stats.absent++;
      if (r.status === "leave" || r.status === "auto-leave") stats.leave++;
      if (r.status === "remote") stats.remote++;

      if (r.is_late) {
        stats.late++;
      }

      // ✅ new conditions
      if ((r.status === "present" || r.status === "late") && !r.is_late) {
        stats.onTime++;
      }

      if (r.status === "half-day" || r.status === "auto-half-day") {
        stats.halfDays++;
      }

      if (isEarlyLeave) {
        stats.earlyLeave++;
      }
    });

    stats.fine = finePolicy(stats.late);

    return {
      user: {
        _id: user._id,
        name: `${user.first_name} ${user.last_name}`,
        employee_id: user.employee_id,
        designation: user.designation,
        profile_picture: user.profile_picture,
        role: user.role,
      },
      stats,
    };
  });

  return {
    results,
    total: totalUsers,
    currentPage: page,
    totalPages: Math.ceil(totalUsers / limit),
    hasMorePages: page < Math.ceil(totalUsers / limit),
  };
};

function getWorkingDaysInMonth(month, year) {
  const date = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  let workingDays = 0;

  while (date <= end) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      workingDays++;
    }
    date.setDate(date.getDate() + 1);
  }

  return workingDays;
}

export const GetTodayAttendanceStatsService = async () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setUTCHours(23, 59, 59, 999);

  const totalEmployees = await Users.countDocuments({
    is_active: true,
    role: { $in: ["employee", "teamLead"] },
  });

  const attendances = await Attendances.find({
    date: { $gte: today, $lte: endOfToday },
  });

  let presentCount = 0;
  let lateCount = 0;
  let leaveCount = 0;

  for (const record of attendances) {
    if (!record.status) continue;

    const status = record.status.toLowerCase();
    if (status === "leave" || status === "auto-leave") {
      leaveCount++;
    } else {
      // All non-leave statuses are considered "present"
      presentCount++;
      if (record.is_late === true) {
        lateCount++;
      }
    }
  }

  const awaitingCount = Math.max(totalEmployees - presentCount - leaveCount, 0);

  return {
    stats: {
      total_employees: totalEmployees,
      present: presentCount,
      late: lateCount,
      leave: leaveCount,
      awaiting: awaitingCount,
    },
  };
};

export const DownloadMonthlyAttendanceService = async (
  user,
  month,
  year,
  department_id,
  search,
) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  let teamIds = [];
  if (department_id) {
    const dept = await Departments.findById(department_id).lean();
    if (!dept) throw new AppError("Invalid department ID", 400);
    teamIds = dept.teams || [];
  }

  const userQuery = {
    is_active: true,
  };

  if (user.role === "admin") {
    if (teamIds.length) userQuery.team = { $in: teamIds };
    if (search) {
      const searchRegex = new RegExp(search, "i");
      userQuery.$or = [
        { first_name: searchRegex },
        { last_name: searchRegex },
        { employee_id: searchRegex },
      ];
    }
  } else {
    userQuery._id = user._id;
  }

  const users = await Users.find(
    {
      ...userQuery,
      role: { $ne: "admin" },
    },
    {
      _id: 1,
      first_name: 1,
      last_name: 1,
      employee_id: 1,
      designation: 1,
      team: 1,
    },
  ).lean();

  // Fetch teams
  const teamIdsFromUsers = users.map((u) => u.team).filter(Boolean);
  const teams = await Teams.find({ _id: { $in: teamIdsFromUsers } }).lean();
  const teamMap = Object.fromEntries(teams.map((t) => [t._id.toString(), t]));

  // Fetch departments from teams
  const departmentIds = teams.map((t) => t.department).filter(Boolean);
  const departments = await Departments.find({
    _id: { $in: departmentIds },
  }).lean();
  const departmentMap = Object.fromEntries(
    departments.map((d) => [d._id.toString(), d]),
  );

  const userIds = users.map((u) => u._id);
  const allDates = getWorkingDatesOnlyInMonth(month, year);

  const attendanceData = await Attendances.find({
    user_id: { $in: userIds },
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  const results = users.map((user) => {
    const records = attendanceData.filter((a) => a.user_id.equals(user._id));

    const stats = {
      present: 0,
      leave: 0,
      late: 0,
      early_leave: 0,
      remote: 0,
      unpaid_leave: 0,
      public_holiday: 0,
      totalDays: getWorkingDaysInMonth(month, year),
      fine: 0,
      attendance: [],
    };

    const finePolicy = (lateCount) => {
      if (lateCount <= 3) return 0;
      else if (lateCount <= 5) return (lateCount - 3) * 500;
      else if (lateCount <= 10) return lateCount * 1000;
      else return lateCount * 1500;
    };

    records.forEach((r) => {
      const dateObj = new Date(r.date);
      const day = dateObj.getDay();
      if (day === 0 || day === 6) return;

      // Normalize status for comparison (handle potential whitespace or case issues)
      const normalizedStatus = r.status ? r.status.trim().toLowerCase() : "";

      stats.attendance.push({
        date: r.date,
        check_in: r.check_in,
        check_out: r.check_out,
        status: r.status,
        production_time: r.production_time,
        is_late: r.is_late,
      });

      if (
        normalizedStatus === "present" ||
        normalizedStatus === "early-leave"
      ) {
        stats.present++;
      }
      if (normalizedStatus === "leave" || normalizedStatus === "auto-leave")
        stats.leave++;
      if (normalizedStatus === "early-leave") stats.early_leave++;
      if (normalizedStatus === "remote") stats.remote++;

      // Count unpaid leave: auto-leave (full day) and auto-half-day (half day)
      if (normalizedStatus === "unpaid-leave") {
        stats.unpaid_leave++;
      } else if (normalizedStatus === "auto-leave") {
        // auto-leave is a full day unpaid leave
        stats.unpaid_leave += 1;
      } else if (normalizedStatus === "auto-half-day") {
        // auto-half-day is a half day unpaid leave
        stats.unpaid_leave += 0.5;
      }

      if (normalizedStatus === "public-holiday") stats.public_holiday++;
      if (r.is_late) stats.late++;
    });

    stats.fine = finePolicy(stats.late);

    return {
      user: {
        _id: user._id,
        name: `${user.first_name} ${user.last_name}`,
        employee_id: user.employee_id,
        designation: user.designation,
        team_name: teamMap[user.team?.toString()]?.name || "Not Assigned",
        department_name:
          departmentMap[teamMap[user.team?.toString()]?.department?.toString()]
            ?.name || "Not Assigned",
      },
      stats,
    };
  });

  return results;
};

export const DownloadAttendanceHistoryService = async (
  user,
  filter_type,
  start_date,
  end_date,
  status,
  user_id,
  search,
  department_id,
  employment_type,
) => {
  const now = new Date();
  const matchStage = [];

  let dateRangeStart, dateRangeEnd;

  if (filter_type) {
    const { startDate, endDate: rawEndDate } = getDateRangeFromFilter(
      filter_type,
      start_date,
      end_date,
    );
    dateRangeStart = startDate;
    dateRangeEnd = rawEndDate > now ? now : rawEndDate;
    matchStage.push({ date: { $gte: dateRangeStart, $lte: dateRangeEnd } });
  } else {
    dateRangeEnd = now;
    matchStage.push({ date: { $lte: now } });
  }

  if (status) {
    if (status === "present") {
      matchStage.push({
        $or: [{ status: "present" }, { is_late: true }],
      });
    } else {
      matchStage.push({ status });
    }
  }

  if ((department_id || employment_type) && user.role === "admin") {
    let teamIds = [];
    if (department_id) {
      const department = await Departments.findById(department_id).lean();
      if (!department) throw new AppError("Invalid department ID", 400);
      teamIds = department.teams || [];
    }

    const userFilter = {
      is_active: true,
    };
    if (teamIds.length) userFilter.team = { $in: teamIds };
    if (employment_type) userFilter.employment_status = employment_type;

    const users = await Users.find(userFilter, { _id: 1 });
    matchStage.push({ user_id: { $in: users.map((u) => u._id) } });
  }

  let targetUser = user;

  if (user.role === "admin" && user_id) {
    const fetchedUser = await Users.findById(user_id).lean();
    if (!fetchedUser) throw new AppError("User not found", 404);
    targetUser = fetchedUser;
    matchStage.push({ user_id: new mongoose.Types.ObjectId(user_id) });
  } else if (user.role !== "admin") {
    matchStage.push({ user_id: new mongoose.Types.ObjectId(user._id) });
  }

  // Handle search with spaces - search in concatenated full name
  let searchRegex = null;
  let searchPattern = null;
  if (search) {
    // Escape special regex characters
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    searchRegex = new RegExp(escapedSearch, "i");
    searchPattern = escapedSearch;
  }

  const pipeline = [
    { $match: matchStage.length ? { $and: matchStage } : {} },
    {
      $lookup: {
        from: "users",
        localField: "user_id",
        foreignField: "_id",
        as: "user",
        pipeline: [
          {
            $match: {
              is_active: true,
            },
          },
        ],
      },
    },
    { $unwind: "$user" },
    {
      $lookup: {
        from: "teams",
        localField: "user.team",
        foreignField: "_id",
        as: "team",
      },
    },
    { $unwind: { path: "$team", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "departments",
        localField: "team.department",
        foreignField: "_id",
        as: "department",
      },
    },
    { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
  ];

  if (searchRegex) {
    pipeline.push({
      $match: {
        $or: [
          { "user.first_name": searchRegex },
          { "user.last_name": searchRegex },
          { "user.employee_id": searchRegex },
          // Search in concatenated full name for queries like "zeeshan ali"
          {
            $expr: {
              $regexMatch: {
                input: {
                  $concat: [
                    { $ifNull: ["$user.first_name", ""] },
                    " ",
                    { $ifNull: ["$user.last_name", ""] },
                  ],
                },
                regex: searchPattern,
                options: "i",
              },
            },
          },
        ],
      },
    });
  }

  pipeline.push({ $sort: { date: -1 } });

  const attendances = await Attendances.aggregate(pipeline);

  const fullDates = eachDayOfInterval({
    start: dateRangeStart,
    end: dateRangeEnd,
  });

  const resultMap = new Map();

  for (const record of attendances) {
    const dateStr = record.date.toISOString().slice(0, 10);
    resultMap.set(dateStr, {
      _id: record._id,
      date: record.date,
      status: record.status,
      check_in: record.check_in,
      check_out: record.check_out,
      production_time: record.production_time,
      is_late: record.is_late,
      user: {
        _id: record.user._id,
        first_name: record.user.first_name,
        last_name: record.user.last_name,
        employee_id: record.user.employee_id,
        is_active: record.user.is_active,
        designation: record.user.designation,
        team_name: record.team?.name || "Not Assigned", // ✅ from `$lookup`
        department_name: record.department?.name || "Not Assigned", // ✅ from `$lookup`
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
  const fallbackTeam = await Teams.findById(targetUser.team).lean();
  const fallbackDepartment = fallbackTeam
    ? await Departments.findById(fallbackTeam.department).lean()
    : null;

  const fullRecords = fullDates.map((dateObj) => {
    const dateStr = dateObj.toISOString().slice(0, 10);
    if (resultMap.has(dateStr)) {
      return resultMap.get(dateStr);
    } else {
      return {
        date: dateObj,
        status: "absent",
        check_in: null,
        check_out: null,
        production_time: "0h 0m",
        is_late: false,
        user: {
          _id: targetUser._id,
          first_name: targetUser.first_name,
          last_name: targetUser.last_name,
          employee_id: targetUser.employee_id,
          is_active: targetUser.is_active,
          designation: targetUser.designation,
          team_name: fallbackTeam?.name || "Not Assigned",
          department_name: fallbackDepartment?.name || "Not Assigned",
        },
      };
    }
  });

  return fullRecords;
};

export const DownloadAttendanceStatsService = async (
  user,
  filter_type,
  user_id,
  start_date,
  end_date,
) => {
  return GetAttendanceStatsService(
    user,
    filter_type,
    user_id,
    start_date,
    end_date,
  );
};

export const DownloadTodaysAttendanceService = async (
  user,
  department_id,
  employment_type,
  search,
) => {
  const today = new Date();
  const startOfToday = new Date(today);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setUTCHours(23, 59, 59, 999);

  // Check if today is a weekend
  const dayOfWeek = today.getDay();
  const isTodayWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const userFilter = {
    is_active: true,
    role: { $in: ["employee", "teamLead"] },
  };

  if (department_id) {
    const dept = await Departments.findById(department_id);
    if (!dept) throw new AppError("Invalid department ID", 400);
    userFilter.team = { $in: dept.teams };
  }

  if (employment_type) {
    userFilter.employment_status = employment_type;
  }

  if (search) {
    const searchRegex = new RegExp(search, "i");
    userFilter.$or = [
      { first_name: searchRegex },
      { last_name: searchRegex },
      { employee_id: searchRegex },
    ];
  }

  const users = await Users.find(userFilter).lean();

  const attendances = await Attendances.find({
    date: { $gte: startOfToday, $lte: endOfToday },
  }).lean();

  const leaves = await Leave.find({
    start_date: { $lte: today },
    end_date: { $gte: today },
    status: "approved",
  }).lean();

  const onLeave = new Set(leaves.map((l) => l.user.toString()));

  return users.map((user) => {
    const attendance = attendances.find(
      (a) => a.user_id.toString() === user._id.toString(),
    );

    let status = "absent";
    let check_in = null;
    let check_out = null;
    let productivity = "0h 0m";

    if (attendance) {
      status = attendance.status;
      check_in = attendance.check_in;
      check_out = attendance.check_out;
      productivity = attendance.production_time || "0h 0m";
    } else if (isTodayWeekend) {
      // Show weekend for all fields when it's a weekend
      status = "weekend";
      check_in = "Weekend";
      check_out = "Weekend";
      productivity = "Weekend";
    } else if (onLeave.has(user._id.toString())) {
      status = "leave";
    }

    return {
      employee: `${user.first_name} ${user.last_name}`,
      employee_id: user.employee_id,
      designation: user.designation,
      status,
      check_in,
      check_out,
      productivity,
    };
  });
};

export async function generateAttendanceRecords() {
  const userId = "68494056e8f722ca938be815";
  const startDate = new Date("2025-05-20");
  const endDate = new Date("2025-06-25");

  const records = [];

  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const checkInHour = Math.floor(Math.random() * 2) + 8;
    const checkInMinute = Math.floor(Math.random() * 60);
    const checkIn = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      checkInHour,
      checkInMinute,
    );

    const workHours = Math.floor(Math.random() * 2) + 8;
    const checkOut = new Date(checkIn.getTime() + workHours * 60 * 60 * 1000);

    const timeDiff = checkOut - checkIn;
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const productionTime = `${hours}h ${minutes}m`;

    const isLate =
      checkInHour >= 9 || (checkInHour === 8 && checkInMinute > 30);
    const statuses = ["present", "present", "remote", "late"];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    records.push({
      check_in: checkIn,
      date: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      is_late: isLate,
      status: status,
      user_id: userId,
      created_by: userId,
      updated_by: userId,
      check_out: status === "present" ? checkOut : null,
      production_time: status === "present" ? productionTime : null,
    });
  }

  try {
    const result = await Attendances.insertMany(records);
    console.log(`Successfully inserted ${result.length} records`);
    return result;
  } catch (error) {
    console.error("Error inserting records:", error);
    throw error;
  }
}

/**
 * Get today's attendance for manager's team with filters
 * @param {Object} user - Requesting user (manager)
 * @param {Object} filters - { status, team_id, search, page, limit }
 * @returns {Object} - Attendance data with counts
 */
export const GetManagerTodayAttendanceService = async (user, filters = {}) => {
  const { status, team_id, search, page = 1, limit = 10 } = filters;

  if (user.role !== "manager" && user.role !== "admin") {
    throw new AppError("Only managers and admins can access this", 403);
  }

  const now = new Date();
  const currentHour = now.getHours();

  // If current time is before 1 AM, fetch yesterday's record
  const targetDate = new Date(now);
  if (currentHour < 1) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  const dateStr = targetDate.toISOString().split("T")[0];
  const startOfDay = new Date(dateStr);
  const endOfDay = new Date(dateStr);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // Get manager's teams or specific team if team_id provided
  let teamIds = [];
  const Teams = require("../models/team.model.js").default;

  if (team_id && mongoose.Types.ObjectId.isValid(team_id)) {
    // Specific team requested
    if (user.role === "manager") {
      // Verify manager manages this team
      const team = await Teams.findOne({
        _id: team_id,
        managers: user._id,
      }).select("_id");
      if (!team) {
        throw new AppError("You don't manage this team", 403);
      }
      teamIds = [team_id];
    } else {
      // Admin can select any team
      const team = await Teams.findById(team_id).select("_id");
      if (!team) {
        throw new AppError("Team not found", 404);
      }
      teamIds = [team_id];
    }
  } else {
    // Get all manager's teams
    if (user.role === "manager") {
      const managerTeams = await Teams.find({ managers: user._id }).select(
        "_id",
      );
      teamIds = managerTeams.map((t) => t._id);

      if (teamIds.length === 0) {
        throw new AppError("No teams found for this manager", 404);
      }
    }
  }

  // Get team member IDs
  let memberIds = [];
  const teams = await Teams.find({ _id: { $in: teamIds } }).select("members");
  teams.forEach((team) => {
    if (team.members?.length) {
      memberIds.push(
        ...team.members.map((m) => new mongoose.Types.ObjectId(m)),
      );
    }
  });
  memberIds = [...new Set(memberIds.map((id) => id.toString()))].map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  // Build filter
  const dateFilter = {
    date: { $gte: startOfDay, $lte: endOfDay },
    user_id: { $in: memberIds },
  };

  // Status filter
  const validStatuses = [
    "present",
    "leave",
    "auto-leave",
    "late",
    "remote",
    "awaiting",
    "half-day",
  ];
  if (status && status !== "all" && validStatuses.includes(status)) {
    dateFilter.status = status;
  }

  // Build search regex for user lookup
  let searchFilter = {};
  if (search && search.trim()) {
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedSearch, "i");
    searchFilter = {
      $or: [
        { first_name: searchRegex },
        { last_name: searchRegex },
        { employee_id: searchRegex },
      ],
    };
  }

  // Get users with search filter
  let filteredUserIds = memberIds;
  if (Object.keys(searchFilter).length > 0) {
    const Users = require("../models/user.model.js").default;
    const filteredUsers = await Users.find(searchFilter).select("_id");
    filteredUserIds = filteredUsers
      .map((u) => u._id)
      .filter((id) => memberIds.some((mid) => mid.equals(id)));
  }

  // Apply search/team filter to date filter
  if (filteredUserIds.length > 0) {
    dateFilter.user_id = { $in: filteredUserIds };
  }

  // Fetch attendance records
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const attendance = await Attendances.find(dateFilter)
    .populate({
      path: "user_id",
      select:
        "first_name last_name employee_id profile_picture designation role team",
      populate: {
        path: "team",
        select: "_id name",
      },
    })
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  // Calculate counts
  const totalCount = await Attendances.countDocuments(dateFilter);
  const countsByStatus = await Attendances.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Format count data
  const counts = {
    total: totalCount,
    present: 0,
    remote: 0,
    awaiting: 0,
    leave: 0,
    "half-day": 0,
    late: 0,
  };

  countsByStatus.forEach((item) => {
    if (item._id === "present") counts.present += item.count;
    if (item._id === "remote") counts.remote += item.count;
    if (item._id === "awaiting") counts.awaiting += item.count;
    if (item._id === "leave" || item._id === "auto-leave")
      counts.leave += item.count;
    if (item._id === "half-day" || item._id === "auto-half-day")
      counts["half-day"] += item.count;
    if (item._id === "late") counts.late += item.count;
  });

  // Format attendance data
  const formattedAttendance = attendance.map((record) => ({
    _id: record._id,
    user_name: `${record.user_id.first_name} ${record.user_id.last_name}`,
    employee_id: record.user_id.employee_id,
    designation: record.user_id.designation,
    role: record.user_id.role,
    team: record.user_id.team?.name || "N/A",
    status: record.status,
    check_in: record.check_in,
    check_out: record.check_out,
    date: record.date,
  }));

  return {
    data: formattedAttendance,
    counts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / parseInt(limit)),
    },
  };
};

/**
 * Get today's attendance summary count for manager's team
 * @param {Object} user - Requesting user (manager)
 * @param {String} team_id - Optional: specific team ID to filter
 * @returns {Object} - Summary counts
 */
export const GetManagerTodayAttendanceSummaryService = async (
  user,
  team_id,
) => {
  if (user.role !== "manager" && user.role !== "admin") {
    throw new AppError("Only managers and admins can access this", 403);
  }

  const now = new Date();
  const currentHour = now.getHours();

  // If current time is before 1 AM, fetch yesterday's record
  const targetDate = new Date(now);
  if (currentHour < 1) {
    targetDate.setDate(targetDate.getDate() - 1);
  }

  const dateStr = targetDate.toISOString().split("T")[0];
  const startOfDay = new Date(dateStr);
  const endOfDay = new Date(dateStr);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // Get manager's teams or specific team if team_id provided
  let teamIds = [];
  const Teams = require("../models/team.model.js").default;

  if (team_id && mongoose.Types.ObjectId.isValid(team_id)) {
    // Specific team requested
    if (user.role === "manager") {
      // Verify manager manages this team
      const team = await Teams.findOne({
        _id: team_id,
        managers: user._id,
      }).select("_id");
      if (!team) {
        throw new AppError("You don't manage this team", 403);
      }
      teamIds = [team_id];
    } else {
      // Admin can select any team
      const team = await Teams.findById(team_id).select("_id");
      if (!team) {
        throw new AppError("Team not found", 404);
      }
      teamIds = [team_id];
    }
  } else {
    // Get all manager's teams
    if (user.role === "manager") {
      const managerTeams = await Teams.find({ managers: user._id }).select(
        "_id members",
      );
      teamIds = managerTeams.map((t) => t._id);

      if (teamIds.length === 0) {
        throw new AppError("No teams found for this manager", 404);
      }
    }
  }

  // Get total team members
  let memberIds = [];
  const teams = await Teams.find({ _id: { $in: teamIds } }).select("members");
  teams.forEach((team) => {
    if (team.members?.length) {
      memberIds.push(
        ...team.members.map((m) => new mongoose.Types.ObjectId(m)),
      );
    }
  });
  memberIds = [...new Set(memberIds.map((id) => id.toString()))].map(
    (id) => new mongoose.Types.ObjectId(id),
  );

  const totalMembers = memberIds.length;

  // Get attendance stats
  const dateFilter = {
    date: { $gte: startOfDay, $lte: endOfDay },
    user_id: { $in: memberIds },
  };

  const countsByStatus = await Attendances.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  // Format count data
  const counts = {
    total_members: totalMembers,
    present: 0,
    remote: 0,
    awaiting: 0,
    leave: 0,
    "half-day": 0,
    late: 0,
  };

  countsByStatus.forEach((item) => {
    if (item._id === "present") counts.present += item.count;
    if (item._id === "remote") counts.remote += item.count;
    if (item._id === "awaiting") counts.awaiting += item.count;
    if (item._id === "leave" || item._id === "auto-leave")
      counts.leave += item.count;
    if (item._id === "half-day" || item._id === "auto-half-day")
      counts["half-day"] += item.count;
    if (item._id === "late") counts.late += item.count;
  });

  return counts;
};
