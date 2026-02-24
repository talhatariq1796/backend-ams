import Leave from "../../models/requests/leave.model.js";
import { CheckValidation } from "../../utils/validation.util.js";
import { getDateRangeFromFilter } from "../../utils/dateFilters.utils.js";
import AppError, { AppResponse } from "../../middlewares/error.middleware.js";
import RemoteWork from "../../models/requests/remotework.model.js";
import Attendance from "../../models/attendance.model.js";
import moment from "moment";
import mongoose from "mongoose";
import User from "../../models/user.model.js";
import Teams from "../../models/team.model.js";
import OfficeConfigs from "../../models/config.model.js";
import dayjs from "dayjs";
import { getPagination } from "../../utils/pagination.util.js";
import { AdjustLeaveStatsForUser } from "../../utils/leaveStats.util.js";
import { GetLeaveStatsService } from "../leaveStats.service.js";

export const ApplyLeaveService = async (leaveData, requestingUser) => {
  let {
    user,
    leave_type,
    start_date,
    end_date,
    total_days,
    team,
    substitute,
    reason,
    is_half_day,
  } = leaveData;

  const validationError = CheckValidation(
    ["user", "leave_type", "start_date", "end_date", "total_days", "reason"],
    { body: leaveData },
  );
  if (validationError) throw new AppError(validationError, 400);

  if (new Date(start_date) > new Date(end_date)) {
    throw new AppError("Start date cannot be after end date", 400);
  }

  const today = dayjs();
  const start = dayjs(start_date);
  if (start.isBefore(today.subtract(30, "day"), "day")) {
    throw new AppError(
      "Leave cannot be applied for dates more than 30 days in the past",
      400,
    );
  }

  const userInfo = await User.findById(user);
  if (!userInfo) throw new AppError("User not found", 404);

  // 🔍 Check for overlapping active leaves (approved or pending only)
  const overlappingLeaves = await Leave.find({
    user,
    status: { $in: ["approved", "pending"] },
    $or: [
      {
        start_date: { $lte: new Date(end_date) },
        end_date: { $gte: new Date(start_date) },
      },
      {
        start_date: { $gte: new Date(start_date) },
        end_date: { $lte: new Date(end_date) },
      },
    ],
  });

  // 🧠 Allow reapplication only if overlapping leave is auto-generated or canceled
  const validOverlap = overlappingLeaves.some((leave) => {
    const isAuto =
      leave.reason?.toLowerCase()?.includes("auto-generated") ||
      leave.action_taken_by === "System" ||
      leave.status === "auto-leave";
    return !isAuto;
  });

  if (validOverlap) {
    throw new AppError(
      requestingUser.role === "admin"
        ? "User already has leave applied for the selected date range."
        : "You already have leave applied for the selected date range.",
      400,
    );
  }

  // Remove any overlapping leaves (auto-leave, pending, or approved) before applying new one
  await Leave.deleteMany({
    user,
    status: { $in: ["auto-leave", "pending", "approved"] },
    start_date: { $lte: new Date(end_date) },
    end_date: { $gte: new Date(start_date) },
  });

  // Also clean up attendance linked to those deleted leaves
  await Attendance.deleteMany({
    user_id: user,
    date: { $gte: new Date(start_date), $lte: new Date(end_date) },
    status: { $in: ["auto-leave", "leave"] },
  });

  // Extract years from start_date and end_date to handle cross-year leaves
  const startYear = dayjs(start_date).year();
  const endYear = dayjs(end_date).year();
  const yearsInvolved = [];

  // Collect all years the leave spans across
  for (let year = startYear; year <= endYear; year++) {
    yearsInvolved.push(year);
  }

  // Initialize stats for all years involved (important for future year leaves)
  // Use the start year for validation, but ensure all years have stats initialized
  for (const year of yearsInvolved) {
    try {
      await GetLeaveStatsService(userInfo, userInfo._id, year);
    } catch (error) {
      console.error(`Failed to initialize stats for year ${year}:`, error);
      throw new AppError(
        `Failed to initialize leave stats for year ${year}: ${error.message}`,
        error.statusCode || 500,
      );
    }
  }

  // Get stats for the start year for validation
  const statsResponse = await GetLeaveStatsService(
    userInfo,
    userInfo._id,
    startYear,
  );
  const leaveStats = statsResponse.stats;
  const leaveBreakdown = leaveStats.leave_breakdown || {};
  let noticeViolationNote = "";

  if (leave_type !== "unpaid") {
    const remainingForType = leaveBreakdown[leave_type]?.remaining || 0;
    if (remainingForType < total_days) {
      throw new AppError(
        requestingUser.role === "admin"
          ? `User has exceeded their ${leave_type} leave limit.`
          : `You have exceeded your ${leave_type} leave limit.`,
        400,
      );
    }

    // FIX: Only check notice period for non-admin users
    if (requestingUser.role !== "admin") {
      const today = dayjs();
      const leaveStart = dayjs(start_date);
      const daysBeforeStart = leaveStart.diff(today, "day");

      // Apply notice policy based on leave type
      if (["annual", "casual"].includes(leave_type)) {
        // FIX: Use if-else to ensure only one condition matches
        if (total_days <= 2) {
          if (daysBeforeStart < 3) {
            noticeViolationNote = `Notice period violation (Policy 4.1.${
              leave_type === "annual" ? "1" : "3"
            }): 1–2 day ${leave_type} leave requires at least 3 days' notice.`;
          }
        } else if (total_days >= 3 && total_days <= 5) {
          if (daysBeforeStart < 14) {
            noticeViolationNote = `Notice period violation (Policy 4.1.${
              leave_type === "annual" ? "1" : "3"
            }): 3–5 day ${leave_type} leave requires at least 2 weeks' notice.`;
          }
        } else if (total_days >= 6) {
          if (daysBeforeStart < 28) {
            noticeViolationNote = `Notice period violation (Policy 4.1.${
              leave_type === "annual" ? "1" : "3"
            }): 6+ day ${leave_type} leave requires at least 4 weeks' notice.`;
          }
        }
      } else if (leave_type === "sick") {
        // Sick leave → No advance notice required but add medical cert logic if needed
        if (total_days > 2) {
          noticeViolationNote =
            "Policy 4.1.2: Sick leave longer than 2 consecutive days requires a medical certificate.";
        }
      } else if (leave_type === "probation") {
        // Probation leave notice period
        if (total_days <= 2) {
          if (daysBeforeStart < 3) {
            noticeViolationNote =
              "Notice period violation (Policy 4.2.1): 1–2 day probation leave requires at least 3 days' notice.";
          }
        } else if (total_days === 3) {
          if (daysBeforeStart < 7) {
            noticeViolationNote =
              "Notice period violation (Policy 4.2.1): 3 days of probation leave requires at least 1 week's notice.";
          }
        }
      } else if (
        ["maternity", "paternity", "hajj/umrah", "marriage"].includes(
          leave_type,
        )
      ) {
        // These require 4 weeks' notice
        if (daysBeforeStart < 28) {
          const policyMap = {
            maternity: "4.2.2",
            paternity: "4.2.3",
            "hajj/umrah": "4.2.4",
            marriage: "4.2.5",
          };
          noticeViolationNote = `Notice period violation (Policy ${
            policyMap[leave_type]
          }): ${
            leave_type.charAt(0).toUpperCase() + leave_type.slice(1)
          } leave requires at least 4 weeks' notice.`;
        }
      } else if (leave_type === "unpaid") {
        // Unpaid leave notice period (same as annual/casual)
        if (total_days <= 2) {
          if (daysBeforeStart < 3) {
            noticeViolationNote =
              "Notice period violation (Policy 4.2.7): 1–2 day unpaid leave requires at least 3 days' notice.";
          }
        } else if (total_days >= 3 && total_days <= 5) {
          if (daysBeforeStart < 14) {
            noticeViolationNote =
              "Notice period violation (Policy 4.2.7): 3–5 day unpaid leave requires at least 2 weeks' notice.";
          }
        } else if (total_days >= 6) {
          if (daysBeforeStart < 28) {
            noticeViolationNote =
              "Notice period violation (Policy 4.2.7): 6+ day unpaid leave requires at least 4 weeks' notice.";
          }
        }
      }
      // Note: Bereavement leave (demise) doesn't have strict notice requirements
    }
  }

  let substituteDetails = null;
  if (substitute) {
    substituteDetails = await User.findById(substitute).select(
      "first_name last_name",
    );
    if (!substituteDetails) {
      throw new AppError("Substitute user not found", 200);
    }
  }

  const newLeave = new Leave({
    user: userInfo._id,
    leave_type,
    start_date,
    end_date,
    total_days: is_half_day ? 0.5 : total_days,
    team: team?.id || team,
    substitute: substitute
      ? {
          user: substitute,
          name: `${substituteDetails.first_name} ${substituteDetails.last_name}`,
        }
      : null,
    reason: reason?.trim(),
    is_half_day: is_half_day || false,
    notice_violation_note: noticeViolationNote || "",
    ...(requestingUser.role === "admin" &&
    requestingUser._id.toString() !== user
      ? {
          applied_by_admin: requestingUser._id,
          status: "approved",
          action_taken_by: `${requestingUser.first_name} ${requestingUser.last_name}`,
        }
      : {}),
  });

  await newLeave.save();

  if (
    requestingUser.role === "admin" &&
    requestingUser._id.toString() !== user
  ) {
    const start = moment(start_date);
    const end = moment(end_date);
    const attendanceEntries = [];
    let current = start.clone();

    while (current <= end) {
      const day = current.day();
      const currentDate = current.toDate();

      if (day !== 0 && day !== 6) {
        attendanceEntries.push({
          user: userInfo._id,
          date: currentDate,
          status: "leave",
          created_by: requestingUser._id,
          updated_by: requestingUser._id,
        });
      }
      current.add(1, "day");
    }

    if (attendanceEntries.length > 0) {
      try {
        await Attendance.insertMany(attendanceEntries, { ordered: false });
      } catch (err) {
        if (err.code !== 11000) throw err;
        console.warn("Some duplicate attendance records were skipped");
      }
    }
  }

  // Handle cross-year leaves: calculate working days per year and adjust stats accordingly
  if (is_half_day) {
    // Half-day leaves only apply to the start date's year
    await AdjustLeaveStatsForUser(user, startYear, leave_type, 0.5, "apply");
  } else if (startYear === endYear) {
    // Single year leave - simple case
    await AdjustLeaveStatsForUser(
      user,
      startYear,
      leave_type,
      total_days,
      "apply",
    );
  } else {
    // Cross-year leave - calculate actual working days in each year's portion
    const startDateObj = dayjs(start_date);
    const endDateObj = dayjs(end_date);

    // Calculate working days for each year
    for (const year of yearsInvolved) {
      let yearStart, yearEnd;

      if (year === startYear) {
        // First year: from start_date to end of year
        yearStart = startDateObj;
        yearEnd = dayjs(`${year}-12-31`);
      } else if (year === endYear) {
        // Last year: from start of year to end_date
        yearStart = dayjs(`${year}-01-01`);
        yearEnd = endDateObj;
      } else {
        // Middle years: full year (shouldn't happen for typical leaves, but handle it)
        yearStart = dayjs(`${year}-01-01`);
        yearEnd = dayjs(`${year}-12-31`);
      }

      // Calculate working days in this year's portion (excluding weekends)
      let workingDaysInYear = 0;
      let current = yearStart.startOf("day");
      const end = yearEnd.endOf("day");

      while (current.isBefore(end) || current.isSame(end, "day")) {
        const dayOfWeek = current.day();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // Not Sunday (0) or Saturday (6)
          workingDaysInYear++;
        }
        current = current.add(1, "day");
      }

      // Adjust stats for this year with the actual working days in that year
      if (workingDaysInYear > 0) {
        await AdjustLeaveStatsForUser(
          user,
          year,
          leave_type,
          workingDaysInYear,
          "apply",
        );
      }
    }
  }

  // Get leave stats for the year of the leave to include in response
  const leaveYear = dayjs(start_date).year();
  const leaveStatsResponse = await GetLeaveStatsService(
    userInfo,
    userInfo._id,
    leaveYear,
  );

  // Populate user data for response
  const populatedLeave = await newLeave.populate({
    path: "user",
    select:
      "first_name last_name employee_id profile_picture gender designation role employment_status team",
    populate: {
      path: "team",
      select: "name department members leads",
    },
  });

  return {
    ...populatedLeave.toObject(),
    leave_balance: {
      total_taken_leaves: leaveStatsResponse.stats.total_taken_leaves || 0,
      remaining_leaves: leaveStatsResponse.stats.remaining_leaves || 0,
    },
  };
};

export const UpdateLeaveStatusService = async (
  leave_id,
  status,
  userInfo,
  rejection_reason = null,
) => {
  if (!["approved", "rejected"].includes(status)) {
    throw new AppError("Invalid status. Must be 'approved' or 'rejected'", 400);
  }

  const leave = await Leave.findById(leave_id);
  if (!leave) throw new AppError("Leave request not found", 400);

  if (leave.status !== "pending") {
    throw new AppError("Leave request has already been processed", 400);
  }

  // Role-based approval validation
  if (userInfo.role === "teamLead") {
    if (leave.user.toString() === userInfo._id.toString()) {
      throw new AppError(
        "You cannot approve or reject your own leave request",
        403,
      );
    }

    // ✅ Fetch all teams where this user is a lead
    const teamsLed = await Teams.find({ leads: userInfo._id }).select(
      "members",
    );

    if (!teamsLed.length) {
      throw new AppError("You are not leading any team", 403);
    }

    // Combine all member IDs from teams the lead manages
    const allMemberIds = teamsLed.flatMap((team) =>
      team.members.map((m) => m.toString()),
    );

    // Check if the leave belongs to any of those team members
    if (!allMemberIds.includes(leave.user.toString())) {
      throw new AppError(
        "You can only approve or reject leave requests of your team members",
        403,
      );
    }
  } else if (userInfo.role === "manager") {
    if (leave.user.toString() === userInfo._id.toString()) {
      throw new AppError(
        "You cannot approve or reject your own leave request",
        403,
      );
    }

    // ✅ Fetch all teams where this user is a manager
    const teamsManaged = await Teams.find({ managers: userInfo._id }).select(
      "members",
    );

    if (!teamsManaged.length) {
      throw new AppError("You are not managing any team", 403);
    }

    // Combine all member IDs from teams the manager manages
    const allMemberIds = teamsManaged.flatMap((team) =>
      team.members.map((m) => m.toString()),
    );

    // Check if the leave belongs to any of those team members
    if (!allMemberIds.includes(leave.user.toString())) {
      throw new AppError(
        "You can only approve or reject leave requests of your team members",
        403,
      );
    }
  } else if (userInfo.role !== "admin") {
    throw new AppError(
      "You are not authorized to approve or reject leave requests",
      403,
    );
  }

  // Proceed with updating leave
  leave.status = status;
  leave.action_taken_by = `${userInfo.first_name} ${userInfo.last_name}`;

  const startYear = dayjs(leave.start_date).year();
  const endYear = dayjs(leave.end_date).year();
  const daysToAdjust = leave.is_half_day ? 0.5 : leave.total_days;

  if (status === "rejected") {
    if (!rejection_reason) {
      throw new AppError("Rejection reason is required", 400);
    }
    leave.rejection_reason = rejection_reason;

    // If pending leaves were already deducted, restore them
    // Handle cross-year leaves for rejection
    if (leave.is_half_day) {
      // Half-day leaves only apply to the start date's year
      await AdjustLeaveStatsForUser(
        leave.user,
        startYear,
        leave.leave_type,
        0.5,
        "restore",
      );
    } else if (startYear === endYear) {
      // Single year leave - simple case
      await AdjustLeaveStatsForUser(
        leave.user,
        startYear,
        leave.leave_type,
        daysToAdjust,
        "restore",
      );
    } else {
      // Cross-year leave - restore for all years involved
      const startDateObj = dayjs(leave.start_date);
      const endDateObj = dayjs(leave.end_date);
      const yearsInvolved = [];

      for (let year = startYear; year <= endYear; year++) {
        yearsInvolved.push(year);
      }

      for (const year of yearsInvolved) {
        let yearStart, yearEnd;

        if (year === startYear) {
          yearStart = startDateObj;
          yearEnd = dayjs(`${year}-12-31`);
        } else if (year === endYear) {
          yearStart = dayjs(`${year}-01-01`);
          yearEnd = endDateObj;
        } else {
          yearStart = dayjs(`${year}-01-01`);
          yearEnd = dayjs(`${year}-12-31`);
        }

        // Calculate working days in this year's portion (excluding weekends)
        let workingDaysInYear = 0;
        let current = yearStart.startOf("day");
        const end = yearEnd.endOf("day");

        while (current.isBefore(end) || current.isSame(end, "day")) {
          const dayOfWeek = current.day();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workingDaysInYear++;
          }
          current = current.add(1, "day");
        }

        if (workingDaysInYear > 0) {
          await AdjustLeaveStatsForUser(
            leave.user,
            year,
            leave.leave_type,
            workingDaysInYear,
            "restore",
          );
        }
      }
    }
  }

  if (status === "approved") {
    const start = moment(leave.start_date);
    const end = moment(leave.end_date);
    const userObjectId = new mongoose.Types.ObjectId(leave.user);

    const existingAttendances = await Attendance.find({
      user_id: userObjectId,
      date: { $gte: start.toDate(), $lte: end.toDate() },
    });

    // ✅ Update existing "auto-leave" records to "leave" status
    const autoLeaveAttendances = existingAttendances.filter(
      (a) => a.status === "auto-leave",
    );

    if (autoLeaveAttendances.length > 0) {
      for (const attendance of autoLeaveAttendances) {
        const attendanceDate = new Date(attendance.date);
        const dayOfWeek = attendanceDate.getDay();

        // Only update weekdays (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // Check if this date falls within the leave range
          const attendanceMoment = moment(attendanceDate);
          if (
            attendanceMoment.isSameOrAfter(start, "day") &&
            attendanceMoment.isSameOrBefore(end, "day")
          ) {
            attendance.status = leave.is_half_day ? "half-day" : "leave";
            attendance.updated_by = userInfo._id;
            attendance.analysis = `Updated from auto-leave to approved ${
              leave.is_half_day ? "half-day" : "leave"
            } after leave request approval.`;
            await attendance.save();

            console.log(
              `✅ Updated attendance from auto-leave to ${
                attendance.status
              } for user ${userObjectId} on ${
                attendanceDate.toISOString().split("T")[0]
              }`,
            );
          }
        }
      }
    }

    // ✅ Handle auto-leave unpaid leave records - restore and update
    // Find auto-leave records that overlap with the approved leave date range
    // Note: These might have been deleted by ApplyLeaveService, but we check anyway
    const autoLeaveRecords = await Leave.find({
      user: userObjectId,
      leave_type: "unpaid",
      status: "approved",
      $or: [
        // Auto-leave starts within the approved leave range
        { start_date: { $gte: start.toDate(), $lte: end.toDate() } },
        // Auto-leave ends within the approved leave range
        { end_date: { $gte: start.toDate(), $lte: end.toDate() } },
        // Auto-leave completely contains the approved leave range
        {
          start_date: { $lte: start.toDate() },
          end_date: { $gte: end.toDate() },
        },
      ],
      reason: /Auto-generated|Auto-applied|No check-in|System auto/i,
    });

    if (autoLeaveRecords.length > 0) {
      for (const autoLeave of autoLeaveRecords) {
        const autoLeaveStart = moment(autoLeave.start_date);
        const autoLeaveEnd = moment(autoLeave.end_date);

        // Check if auto-leave overlaps with approved leave
        if (
          (autoLeaveStart.isSameOrAfter(start, "day") &&
            autoLeaveStart.isSameOrBefore(end, "day")) ||
          (autoLeaveEnd.isSameOrAfter(start, "day") &&
            autoLeaveEnd.isSameOrBefore(end, "day")) ||
          (autoLeaveStart.isBefore(start, "day") &&
            autoLeaveEnd.isAfter(end, "day"))
        ) {
          // Restore unpaid leave stats (since auto-leave already deducted them)
          const autoLeaveYear = autoLeaveStart.year();
          const autoLeaveDays = autoLeave.is_half_day
            ? 0.5
            : autoLeave.total_days;

          await AdjustLeaveStatsForUser(
            leave.user,
            autoLeaveYear,
            "unpaid",
            autoLeaveDays,
            "restore",
          );

          // Update the auto-leave record to reflect the approved leave
          autoLeave.leave_type = leave.leave_type;
          autoLeave.reason = `Converted from auto-leave unpaid to approved ${leave.leave_type} leave`;
          autoLeave.action_taken_by = `${userInfo.first_name} ${userInfo.last_name}`;
          autoLeave.updatedAt = new Date();
          await autoLeave.save();

          console.log(
            `✅ Converted auto-leave unpaid record to ${
              leave.leave_type
            } leave for user ${userObjectId} on ${autoLeaveStart.format(
              "YYYY-MM-DD",
            )}`,
          );
        }
      }
    }

    const existingDates = new Set(
      existingAttendances.map((a) => a.date.getTime()),
    );
    const attendanceEntries = [];
    let current = start.clone();

    while (current <= end) {
      const day = current.day();
      const currentDate = current.toDate();
      const dateKey = currentDate.getTime();

      if (day !== 0 && day !== 6 && !existingDates.has(dateKey)) {
        attendanceEntries.push({
          user_id: userObjectId,
          date: currentDate,
          status: leave.is_half_day ? "half-day" : "leave",
          created_by: userInfo._id,
          updated_by: userInfo._id,
        });
      }
      current.add(1, "day");
    }

    if (attendanceEntries.length > 0) {
      try {
        await Attendance.insertMany(attendanceEntries, {
          ordered: false,
          rawResult: true,
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }

    // ✅ Handle half-day logic and auto-half-day conversion
    if (leave.is_half_day) {
      const targetDate = leave.start_date;
      const existingAttendance = await Attendance.findOne({
        user_id: userObjectId,
        date: {
          $gte: dayjs(targetDate).startOf("day").toDate(),
          $lte: dayjs(targetDate).endOf("day").toDate(),
        },
      });

      if (existingAttendance && existingAttendance.status === "auto-half-day") {
        existingAttendance.status = "half-day";
        existingAttendance.updated_by = userInfo._id;
        await existingAttendance.save();
      }

      const systemHalfDay = await Leave.findOne({
        user: userObjectId,
        is_half_day: true,
        leave_type: "unpaid",
        start_date: { $lte: targetDate },
        end_date: { $gte: targetDate },
        reason: /Auto-applied/i,
      });

      if (systemHalfDay) {
        await AdjustLeaveStatsForUser(
          leave.user,
          startYear,
          "unpaid",
          0.5,
          "restore",
        );
        await AdjustLeaveStatsForUser(
          leave.user,
          startYear,
          leave.leave_type,
          0.5,
          "apply",
        );

        systemHalfDay.leave_type = leave.leave_type;
        systemHalfDay.reason = `Converted from auto-half-day unpaid to approved ${leave.leave_type} leave`;
        systemHalfDay.action_taken_by = `${userInfo.first_name} ${userInfo.last_name}`;
        systemHalfDay.updatedAt = new Date();
        await systemHalfDay.save();
      }
    }
  }

  await leave.save();

  const updatedUser = await User.findById(leave.user).select(
    "first_name last_name employee_id role email",
  );
  // Get stats for the year of the leave's start_date
  const leaveYear = dayjs(leave.start_date).year();
  const updatedStats = await GetLeaveStatsService(
    updatedUser,
    updatedUser._id,
    leaveYear,
  );

  return {
    ...leave.toObject(),
    user: updatedUser,
    leave_balance: {
      total_taken_leaves: updatedStats.stats.total_taken_leaves || 0,
      remaining_leaves: updatedStats.stats.remaining_leaves || 0,
    },
  };
};

export const EditLeaveService = async (leave_id, editData, userInfo) => {
  const leave = await Leave.findById(leave_id).populate("user", "_id");
  if (!leave) throw new AppError("Leave request not found", 404);

  // Role and status checks
  if (
    userInfo.role !== "admin" &&
    leave.user._id.toString() !== userInfo._id.toString()
  ) {
    throw new AppError("You can only edit your own leave requests", 403);
  }

  if (userInfo.role !== "admin" && leave.status !== "pending") {
    throw new AppError("Only pending leaves can be edited", 400);
  }

  // Store old values for adjustment
  const oldValues = {
    leave_type: leave.leave_type,
    total_days: leave.total_days,
    is_half_day: leave.is_half_day,
    status: leave.status,
    start_date: leave.start_date,
    end_date: leave.end_date,
  };

  // Apply updates
  if (editData.leave_type !== undefined) leave.leave_type = editData.leave_type;
  if (editData.start_date !== undefined) leave.start_date = editData.start_date;
  if (editData.end_date !== undefined) leave.end_date = editData.end_date;
  if (editData.total_days !== undefined) leave.total_days = editData.total_days;
  if (editData.is_half_day !== undefined)
    leave.is_half_day = editData.is_half_day;
  if (editData.reason !== undefined) leave.reason = editData.reason?.trim();
  if (editData.team !== undefined)
    leave.team = editData.team?.id || editData.team;

  // Handle substitute
  if (editData.substitute !== undefined) {
    if (editData.substitute) {
      const substituteDetails = await User.findById(editData.substitute).select(
        "first_name last_name",
      );
      if (!substituteDetails)
        throw new AppError("Substitute user not found", 400);
      leave.substitute = {
        user: editData.substitute,
        name: `${substituteDetails.first_name} ${substituteDetails.last_name}`,
      };
    } else {
      leave.substitute = null;
    }
  }

  // Admin-specific updates
  if (userInfo.role === "admin") {
    if (editData.status !== undefined) {
      leave.status = editData.status;
      leave.action_taken_by = `${userInfo.first_name} ${userInfo.last_name}`;
      if (editData.status === "rejected" && !editData.rejection_reason) {
        throw new AppError("Rejection reason is required", 400);
      }
      leave.rejection_reason =
        editData.status === "rejected" ? editData.rejection_reason : undefined;
    }
    leave.edited_by_admin = userInfo._id;
  }

  // Validate dates
  if (new Date(leave.start_date) > new Date(leave.end_date)) {
    throw new AppError("Start date cannot be after end date", 400);
  }

  // Check overlapping leaves
  const overlappingConditions = {
    user: leave.user._id,
    _id: { $ne: leave_id },
    status: { $in: ["approved", "pending"] },
    $or: [
      {
        start_date: { $lte: new Date(leave.end_date) },
        end_date: { $gte: new Date(leave.start_date) },
      },
    ],
  };
  const overlappingLeaves = await Leave.find(overlappingConditions);
  if (overlappingLeaves.length > 0) {
    throw new AppError("User already has leave for the selected dates", 400);
  }

  // Check overlapping remote
  const overlappingRemote = await RemoteWork.find({
    user: leave.user._id,
    status: { $in: ["approved", "pending"] },
    $or: [
      {
        start_date: { $lte: new Date(leave.end_date) },
        end_date: { $gte: new Date(leave.start_date) },
      },
    ],
  });
  if (overlappingRemote.length > 0) {
    throw new AppError("User has remote work during these dates", 400);
  }

  // Attendance updates (if approved leave changes)
  const shouldUpdateAttendance =
    +new Date(leave.start_date) !== +new Date(oldValues.start_date) ||
    +new Date(leave.end_date) !== +new Date(oldValues.end_date) ||
    leave.total_days !== oldValues.total_days ||
    (leave.status === "approved" && oldValues.status !== "approved") ||
    (oldValues.status === "approved" && leave.status !== "approved");

  if (shouldUpdateAttendance) {
    if (oldValues.status === "approved") {
      await Attendance.deleteMany({
        user_id: leave.user._id,
        date: { $gte: oldValues.start_date, $lte: oldValues.end_date },
        status: "leave",
      });
    }

    if (leave.status === "approved") {
      const attendanceEntries = [];
      const current = moment(leave.start_date);
      const end = moment(leave.end_date);

      while (current <= end) {
        const day = current.day();
        if (day !== 0 && day !== 6) {
          attendanceEntries.push({
            user_id: leave.user._id,
            date: current.toDate(),
            status: "leave",
            created_by: userInfo._id,
            updated_by: userInfo._id,
          });
        }
        current.add(1, "day");
      }

      if (attendanceEntries.length > 0) {
        try {
          await Attendance.insertMany(attendanceEntries, { ordered: false });
        } catch (err) {
          if (err.code !== 11000) throw err;
          console.warn("Duplicate attendance records skipped");
        }
      }
    }
  }

  // ✅ Update attendance records when leave_type changes (for auto-leave records)
  // This handles the case where admin edits an auto-generated leave and changes the leave_type
  if (
    leave.status === "approved" &&
    oldValues.status === "approved" &&
    leave.leave_type !== oldValues.leave_type
  ) {
    const start = moment(leave.start_date);
    const end = moment(leave.end_date);
    const userObjectId = new mongoose.Types.ObjectId(leave.user._id);

    // Find attendance records with "auto-leave" status for the leave dates
    const autoLeaveAttendances = await Attendance.find({
      user_id: userObjectId,
      date: { $gte: start.toDate(), $lte: end.toDate() },
      status: "auto-leave",
    });

    if (autoLeaveAttendances.length > 0) {
      // Update all auto-leave records to regular leave with the new leave_type
      for (const attendance of autoLeaveAttendances) {
        attendance.status = "leave";
        attendance.leave_override = {
          original_leave_id: leave._id,
          restored_days: 0,
          leave_type: leave.leave_type,
        };
        attendance.updated_by = userInfo._id;
        attendance.analysis = `Updated from auto-leave to approved ${leave.leave_type} leave (edited by admin)`;
        await attendance.save();
      }
    }

    // Also update any existing "leave" status records to reflect the new leave_type
    const existingLeaveAttendances = await Attendance.find({
      user_id: userObjectId,
      date: { $gte: start.toDate(), $lte: end.toDate() },
      status: "leave",
    });

    for (const attendance of existingLeaveAttendances) {
      if (!attendance.leave_override) {
        attendance.leave_override = {
          original_leave_id: leave._id,
          restored_days: 0,
          leave_type: leave.leave_type,
        };
      } else {
        attendance.leave_override.leave_type = leave.leave_type;
        attendance.leave_override.original_leave_id = leave._id;
      }
      attendance.updated_by = userInfo._id;
      await attendance.save();
    }
  }

  // Adjust stats
  const oldYear = dayjs(oldValues.start_date).year();
  const newYear = dayjs(leave.start_date).year();

  const oldDays = oldValues.is_half_day ? 0.5 : oldValues.total_days;
  const newDays = leave.is_half_day ? 0.5 : leave.total_days;

  await AdjustLeaveStatsForUser(
    leave.user._id,
    oldYear,
    oldValues.leave_type,
    oldDays,
    "restore",
  );

  await AdjustLeaveStatsForUser(
    leave.user._id,
    newYear,
    leave.leave_type,
    newDays,
    "apply",
  );

  await leave.save();
  return leave;
};

export const DeleteLeaveService = async (user, leave_id) => {
  const leave = await Leave.findById(leave_id);
  if (!leave) {
    throw new AppError("Leave request not found", 400);
  }

  const leaveUserId = leave.user;
  const year = dayjs(leave.start_date).year();

  // ADMIN DELETION
  if (user.role === "admin") {
    if (leave.status === "approved" || leave.status === "pending") {
      // clean up attendance only if approved
      if (leave.status === "approved") {
        await Attendance.deleteMany({
          user_id: leaveUserId,
          date: { $gte: leave.start_date, $lte: leave.end_date },
          status: "leave",
        });
      }

      // restore leave stats (since you deduct on apply)
      const daysToAdjust = leave.is_half_day ? 0.5 : leave.total_days;
      await AdjustLeaveStatsForUser(
        leaveUserId,
        year,
        leave.leave_type,
        daysToAdjust,
        "restore",
      );
    }

    await Leave.findByIdAndDelete(leave_id);
    return { message: "Leave deleted successfully by admin" };
  }

  // USER DELETION
  if (leave.status !== "pending") {
    throw new AppError("Cannot delete leave after approval/rejection", 400);
  }

  // Restore leave balance because deduction happened on apply
  const daysToAdjust = leave.is_half_day ? 0.5 : leave.total_days;
  await AdjustLeaveStatsForUser(
    leaveUserId,
    year,
    leave.leave_type,
    daysToAdjust,
    "restore",
  );

  await Leave.findByIdAndDelete(leave_id);
  return true;
};

export const GetAllLeaveRequestsService = async (
  userInfo,
  view_scope = "self",
  filter_type,
  start_date,
  end_date,
  status,
  user,
  department_id,
  search,
  leave_type,
  page = 1,
  limit = 10,
) => {
  try {
    let filter = {};

    // Leave type filtering
    if (leave_type) {
      const validTypes = [
        "annual",
        "casual",
        "sick",
        "demise",
        "hajj/umrah",
        "marriage",
        "maternity",
        "paternity",
        "probation",
        "unpaid",
      ];
      const requestedTypes = leave_type.split(",");
      const invalidTypes = requestedTypes.filter(
        (t) => !validTypes.includes(t),
      );
      if (invalidTypes.length > 0) {
        throw new AppError(
          `Invalid leave type(s): ${invalidTypes.join(", ")}`,
          400,
        );
      }
      filter.leave_type =
        requestedTypes.length > 1 ? { $in: requestedTypes } : requestedTypes[0];
    }

    // Date filtering
    if (filter_type) {
      const { startDate, endDate } = getDateRangeFromFilter(
        filter_type,
        start_date,
        end_date,
      );
      filter.$or = [
        {
          start_date: { $lte: endDate },
          end_date: { $gte: startDate },
        },
      ];
    }

    // Status filtering
    if (status) {
      filter.status =
        status === "processed" ? { $in: ["approved", "rejected"] } : status;
    }

    // User filtering
    // Determine leave scope based on view_scope
    if (userInfo.role === "admin") {
      // Admin can request all leaves
      // If user_id is provided, use it regardless of view_scope
      if (
        user &&
        typeof user === "string" &&
        mongoose.Types.ObjectId.isValid(user)
      ) {
        filter.user = new mongoose.Types.ObjectId(user);
      } else if (view_scope === "all") {
        // all users - only if no specific user_id provided
        if (search && search.trim()) {
          // Escape special regex characters and search in concatenated full name
          const escapedSearch = search
            .trim()
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const searchRegex = new RegExp(escapedSearch, "i");
          const users = await User.find({
            $or: [
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
                    regex: escapedSearch,
                    options: "i",
                  },
                },
              },
            ],
          }).select("_id");
          filter.user = { $in: users.map((u) => u._id) };
        }
        // If no search and no user_id, show all (no filter.user set)
      } else if (view_scope === "self") {
        filter.user = new mongoose.Types.ObjectId(userInfo._id);
      } else {
        throw new AppError("Invalid scope for admin", 400);
      }
    } else if (userInfo.role === "teamLead") {
      // FIX: Find all teams where this user is the lead
      const teamsLedByUser = await Teams.find({
        leads: userInfo._id,
      }).select("members");

      // Collect all team member IDs from all teams led by this user
      let teamMemberIds = [];
      teamsLedByUser.forEach((team) => {
        if (team.members && team.members.length > 0) {
          teamMemberIds.push(
            ...team.members.map((m) => new mongoose.Types.ObjectId(m)),
          );
        }
      });

      // Remove duplicates
      teamMemberIds = [
        ...new Set(teamMemberIds.map((id) => id.toString())),
      ].map((id) => new mongoose.Types.ObjectId(id));

      if (view_scope === "team") {
        // Exclude team lead's own ID from the list
        teamMemberIds = teamMemberIds.filter((id) => !id.equals(userInfo._id));

        if (teamMemberIds.length === 0) {
          throw new AppError("No team members found for this team lead", 404);
        }

        filter.user = { $in: teamMemberIds };
      } else if (view_scope === "self") {
        filter.user = new mongoose.Types.ObjectId(userInfo._id);
      } else {
        throw new AppError("Invalid scope for team lead", 400);
      }
    } else if (userInfo.role === "manager") {
      // Similar to teamLead: Find all teams where this user is a manager
      const teamsManagedByUser = await Teams.find({
        managers: userInfo._id,
      }).select("members");

      // Collect all team member IDs from all teams managed by this user
      let teamMemberIds = [];
      teamsManagedByUser.forEach((team) => {
        if (team.members && team.members.length > 0) {
          teamMemberIds.push(
            ...team.members.map((m) => new mongoose.Types.ObjectId(m)),
          );
        }
      });

      // Remove duplicates
      teamMemberIds = [
        ...new Set(teamMemberIds.map((id) => id.toString())),
      ].map((id) => new mongoose.Types.ObjectId(id));

      if (view_scope === "team") {
        // Exclude manager's own ID from the list
        teamMemberIds = teamMemberIds.filter((id) => !id.equals(userInfo._id));

        if (teamMemberIds.length === 0) {
          throw new AppError("No team members found for this manager", 404);
        }

        filter.user = { $in: teamMemberIds };
      } else if (view_scope === "self") {
        filter.user = new mongoose.Types.ObjectId(userInfo._id);
      } else {
        throw new AppError("Invalid scope for manager", 400);
      }
    } else {
      // Regular user
      if (view_scope !== "self") {
        throw new AppError("Users can only view their own leaves", 403);
      }
      filter.user = new mongoose.Types.ObjectId(userInfo._id);
    }

    // Department filtering
    if (department_id && mongoose.Types.ObjectId.isValid(department_id)) {
      const teamsInDept = await Teams.find({
        department: department_id,
      }).select("members");
      const userIdsInDept = teamsInDept.flatMap((team) =>
        team.members.map((m) => new mongoose.Types.ObjectId(m)),
      );

      if (userIdsInDept.length > 0) {
        if (!filter.user) {
          filter.user = { $in: userIdsInDept };
        } else if (filter.user.$in) {
          const filteredIds = userIdsInDept.filter((id) =>
            filter.user.$in.some((uid) => uid.equals(id)),
          );
          filter.user = { $in: filteredIds };
        } else if (userIdsInDept.some((id) => id.equals(filter.user))) {
          // keep as is
        } else {
          filter.user = { $in: [] }; // no match
        }
      } else {
        filter.user = { $in: [] };
      }
    }

    // Pagination
    const {
      page: parsedPage,
      limit: parsedLimit,
      skip,
    } = getPagination(page, limit);

    // Aggregation query
    const leaves = await Leave.aggregate([
      { $match: filter },
      {
        $addFields: {
          status_priority: {
            $cond: [{ $eq: ["$status", "pending"] }, 0, 1],
          },
        },
      },
      { $sort: { status_priority: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: parsedLimit },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
          pipeline: [
            {
              $project: {
                _id: 1,
                first_name: 1,
                last_name: 1,
                employee_id: 1,
                role: 1,
                gender: 1,
                designation: 1,
                employment_status: 1,
                profile_picture: 1,
                team: 1,
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
          as: "user.team",
        },
      },
      {
        $unwind: {
          path: "$user.team",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]);

    const total = await Leave.countDocuments(filter);
    const totalPages = Math.ceil(total / parsedLimit);
    const hasMorePages = parsedPage < totalPages;

    // Build leave stats map - use year from each leave's start_date
    // We need to get stats for each unique user+year combination
    const userYearMap = new Map();

    leaves.forEach((leave) => {
      const uid = leave.user?._id?.toString();
      const leaveYear = dayjs(leave.start_date).year();
      const key = `${uid}_${leaveYear}`;
      if (!userYearMap.has(key)) {
        userYearMap.set(key, { userId: uid, year: leaveYear });
      }
    });

    const leaveStatsMap = {};

    await Promise.all(
      Array.from(userYearMap.values()).map(async ({ userId, year }) => {
        const statsResponse = await GetLeaveStatsService(
          userInfo,
          userId,
          year,
        );
        const key = `${userId}_${year}`;
        leaveStatsMap[key] = {
          total_taken_leaves: statsResponse.stats.total_taken_leaves,
          remaining_leaves: statsResponse.stats.remaining_leaves,
        };
      }),
    );

    const enrichedLeaves = leaves.map((leave) => {
      const uid = leave.user?._id?.toString();
      const leaveYear = dayjs(leave.start_date).year();
      const key = `${uid}_${leaveYear}`;
      return {
        ...leave,
        leave_balance: leaveStatsMap[key] || {},
      };
    });

    return {
      leaves: enrichedLeaves,
      total,
      currentPage: parsedPage,
      totalPages,
      hasMorePages,
    };
  } catch (error) {
    console.error("Error in GetAllLeaveRequestsService:", error);
    throw new AppError(error.message, 500);
  }
};

export const GetAvailableLeaveTypesService = async (userInfo) => {
  const userData = await User.findById(userInfo._id).select(
    "gender employment_status designation",
  );
  if (!userData) throw new AppError("User not found", 404);

  const officeConfig = await OfficeConfigs.findOne();
  if (
    !officeConfig ||
    (!officeConfig.general_leave_types && !officeConfig.business_leave_types)
  ) {
    throw new AppError("Leave configuration not found", 404);
  }

  const isBusinessDev = userData.designation
    ?.toLowerCase()
    .includes("business");

  const leaveConfig = isBusinessDev
    ? officeConfig.business_leave_types
    : officeConfig.general_leave_types;

  if (!leaveConfig || typeof leaveConfig !== "object") {
    throw new AppError("Invalid leave configuration", 500);
  }

  let leaveTypes = Object.keys(leaveConfig);

  if (userData.gender === "male") {
    leaveTypes = leaveTypes.filter((type) => type !== "maternity");
  } else if (userData.gender === "female") {
    leaveTypes = leaveTypes.filter((type) => type !== "paternity");
  }

  if (
    userData.employment_status === "probation" ||
    userData.employment_status === "internship"
  ) {
    leaveTypes = leaveTypes.filter((type) => type === "probation");
  } else if (userData.employment_status === "permanent") {
    leaveTypes = leaveTypes.filter((type) => type !== "probation");
  }

  return leaveTypes;
};

export const GetPendingLeavesCountService = async (user) => {
  const filter = { status: "pending" };

  if (user.role === "admin") {
    // Admin → all pending leaves
  } else if (user.role === "manager") {
    // Manager → pending leaves from their managed teams
    const teamsManagedByUser = await Teams.find({ managers: user._id }).select(
      "members",
    );

    let memberIds = [];
    teamsManagedByUser.forEach((team) => {
      if (team.members?.length) {
        memberIds.push(
          ...team.members.map((id) => new mongoose.Types.ObjectId(id)),
        );
      }
    });

    memberIds = [...new Set(memberIds.map((id) => id.toString()))]
      .map((id) => new mongoose.Types.ObjectId(id))
      .filter((id) => id.toString() !== user._id.toString());

    filter.user = { $in: memberIds };
  } else if (user.role === "teamLead") {
    const teamsLedByUser = await Teams.find({ leads: user._id }).select(
      "members",
    );

    let memberIds = [];
    teamsLedByUser.forEach((team) => {
      if (team.members?.length) {
        memberIds.push(
          ...team.members.map((id) => new mongoose.Types.ObjectId(id)),
        );
      }
    });

    memberIds = [...new Set(memberIds.map((id) => id.toString()))]
      .map((id) => new mongoose.Types.ObjectId(id))
      .filter((id) => id.toString() !== user._id.toString());

    filter.user = { $in: memberIds };
  } else {
    filter.user = user._id;
  }

  const count = await Leave.countDocuments(filter);
  return { count };
};
