import cron from "node-cron";
import Attendance from "../models/attendance.model.js";
import Leave from "../models/requests/leave.model.js";
import User from "../models/user.model.js";
import OfficeConfig from "../models/config.model.js";
import Event from "../models/event.model.js";
import { sendSystemEmail } from "../utils/email.js";
import { AdjustLeaveStatsForUser } from "../utils/leaveStats.util.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import * as WorkingHoursService from "../services/workingHours.service.js";

const MAX_ATTEMPTS = 3;

// Enhanced utility: compare dates ignoring time and timezone issues
const isSameDate = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  // Create date strings in YYYY-MM-DD format using local timezone
  const dateStr1 =
    d1.getFullYear() +
    "-" +
    String(d1.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d1.getDate()).padStart(2, "0");
  const dateStr2 =
    d2.getFullYear() +
    "-" +
    String(d2.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d2.getDate()).padStart(2, "0");

  return dateStr1 === dateStr2;
};

// Helper function to check if a date falls within an event's date range
const isDateInEventRange = (targetDate, event) => {
  const eventStart = new Date(event.date);
  const eventEnd = event.end_date ? new Date(event.end_date) : eventStart;

  return targetDate >= eventStart && targetDate <= eventEnd;
};

// Helper function to send notification to employee
const SYSTEM_USER_ID = "68aff0c0ac44e32abd7ff1b6";

const sendEmployeeNotification = async (
  userId,
  employeeMessage,
  notifyAdmins = false,
  adminMessage = null
) => {
  try {
    await createLogsAndNotification({
      notification_by: SYSTEM_USER_ID,
      notification_to: userId,
      type: NOTIFICATION_TYPES.ATTENDANCE,
      message: employeeMessage,
      notifyAdmins,
      adminMessage,
    });
    console.log(`📧 Notification sent to user ${userId}: ${employeeMessage}`);
  } catch (error) {
    console.error(
      `⚠️ Failed to send notification to user ${userId}: ${error.message}`
    );
  }
};

const runRegularization = async (attempt = 1) => {
  console.log(
    `🕓 Attempt ${attempt}: Running attendance regularization cron job...`
  );

  try {
    const users = await User.find({
      is_active: true,
      role: { $in: ["employee", "teamLead"] },
    }).select("_id designation first_name last_name");

    console.log(
      `👥 Found ${users.length} active employees/teamLeads to process.`
    );

    if (users.length === 0) {
      console.log("❌ No active employees found.");
      return;
    }

    const config = await OfficeConfig.findOne();
    const workingDays = config?.working_days || [1, 2, 3, 4, 5];
    console.log(`📋 Working days configured: ${workingDays.join(", ")}`);

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Process yesterday's date using UTC to avoid timezone issues
    const processDate = new Date(
      Date.UTC(
        yesterday.getUTCFullYear(),
        yesterday.getUTCMonth(),
        yesterday.getUTCDate()
      )
    );
    const dateStr = processDate.toISOString().split("T")[0];
    const startOfDay = new Date(
      Date.UTC(
        yesterday.getUTCFullYear(),
        yesterday.getUTCMonth(),
        yesterday.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );
    const endOfDay = new Date(
      Date.UTC(
        yesterday.getUTCFullYear(),
        yesterday.getUTCMonth(),
        yesterday.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );
    const dayOfWeek = processDate.getUTCDay();

    console.log(`📅 Current time: ${today.toISOString()}`);
    console.log(`📅 Processing attendance for: ${dateStr} (Day: ${dayOfWeek})`);

    // 🔧 CLEANUP: Remove incomplete auto-leave/auto-half-day records from previous failed runs
    console.log(`\n🔧 Checking for incomplete auto-processed records...`);
    const incompleteRecords = await Attendance.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["auto-leave", "auto-half-day"] },
      check_in: null,
    });

    if (incompleteRecords.length > 0) {
      console.log(
        `⚠️  Found ${incompleteRecords.length} incomplete auto-processed records`
      );
      console.log(`   These will be verified and re-processed if needed`);

      // Check each incomplete record to see if it has a corresponding leave record
      for (const record of incompleteRecords) {
        const hasLeave = await Leave.findOne({
          user: record.user_id,
          start_date: { $gte: startOfDay, $lte: endOfDay },
        });

        if (!hasLeave) {
          console.log(
            `   🗑️  Deleting incomplete record for user ${record.user_id} (no leave record found)`
          );
          await Attendance.deleteOne({ _id: record._id });
        } else {
          console.log(
            `   ✅ Record for user ${record.user_id} has leave - keeping it`
          );
        }
      }
    } else {
      console.log(`✅ No incomplete records found`);
    }
    console.log(``);

    // Skip processing if the day we're processing was not a working day
    if (!workingDays.includes(dayOfWeek)) {
      console.log(
        `🔕 The day being processed (${dateStr}) was not a working day (day ${dayOfWeek}). Skipping.`
      );
      return;
    }

    // ----- 1️⃣ Public Holiday Check -----
    const holidays = await Event.find({ category: "public-holiday" });
    const holidayOnProcessDate = holidays.find((h) => {
      const holidayDate = new Date(h.date);
      const isMatch = isSameDate(holidayDate, processDate);
      console.log(
        `🔍 Checking holiday: ${
          h.title
        } on ${holidayDate.toDateString()} vs ${processDate.toDateString()} = ${isMatch}`
      );
      return isMatch;
    });

    if (holidayOnProcessDate) {
      console.log(
        `📌 Public holiday detected: ${holidayOnProcessDate.title} on ${dateStr}`
      );
      for (const user of users) {
        const alreadyExists = await Attendance.findOne({
          user_id: user._id,
          date: { $gte: startOfDay, $lte: endOfDay },
        });

        if (!alreadyExists) {
          await Attendance.create({
            user_id: user._id,
            date: startOfDay,
            status: "holiday",
            action_taken_by: "System",
            analysis: `Public holiday: ${holidayOnProcessDate.title}. System auto-marked as holiday.`,
          });

          await sendEmployeeNotification(
            user._id,
            `automatically marked your attendance as holiday for ${holidayOnProcessDate.title} on ${dateStr}.`,
            false
          );

          console.log(
            `✅ Holiday attendance marked for user ${user._id} on ${dateStr}`
          );
        }
      }
      console.log("✅ Holiday regularization completed.");
      return;
    }

    // ----- 2️⃣ Trips and Office Events -----
    const events = await Event.find({
      category: { $in: ["trip", "office-event"] },
    });

    console.log(`🔍 Found ${events.length} trip/office events to check.`);

    const tripEvent = events.find((e) => {
      if (e.category !== "trip") return false;
      const eventDate = new Date(e.date);
      const isMatch =
        isSameDate(eventDate, processDate) ||
        (e.end_date && isDateInEventRange(processDate, e));

      if (isMatch) {
        console.log(`🚌 Trip match: ${e.title} on ${eventDate.toDateString()}`);
      }
      return isMatch;
    });

    const officeEvent = events.find((e) => {
      if (e.category !== "office-event") return false;
      const eventDate = new Date(e.date);
      const isMatch =
        isSameDate(eventDate, processDate) ||
        (e.end_date && isDateInEventRange(processDate, e));

      if (isMatch) {
        console.log(
          `🏢 Office event match: ${e.title} on ${eventDate.toDateString()}`
        );
      }
      return isMatch;
    });

    if (tripEvent) {
      console.log(`🚌 Processing trip event: ${tripEvent.title}`);
    }
    if (officeEvent) {
      console.log(`🏢 Processing office event: ${officeEvent.title}`);
    }

    // Define threshold times for event analysis (in UTC)
    // PKT is UTC+5, so to convert PKT to UTC: subtract 5 hours
    // 4 PM PKT (16:00) = 11:00 UTC, 5 PM PKT (17:00) = 12:00 UTC
    // 7 PM PKT (19:00) = 14:00 UTC, 8 PM PKT (20:00) = 15:00 UTC
    const fourPM_PKT = new Date(
      Date.UTC(
        yesterday.getUTCFullYear(),
        yesterday.getUTCMonth(),
        yesterday.getUTCDate(),
        11,
        0,
        0,
        0
      )
    );
    const fivePM_PKT = new Date(
      Date.UTC(
        yesterday.getUTCFullYear(),
        yesterday.getUTCMonth(),
        yesterday.getUTCDate(),
        12,
        0,
        0,
        0
      )
    );
    const sevenPM_PKT = new Date(
      Date.UTC(
        yesterday.getUTCFullYear(),
        yesterday.getUTCMonth(),
        yesterday.getUTCDate(),
        14,
        0,
        0,
        0
      )
    );
    const eightPM_PKT = new Date(
      Date.UTC(
        yesterday.getUTCFullYear(),
        yesterday.getUTCMonth(),
        yesterday.getUTCDate(),
        15,
        0,
        0,
        0
      )
    );

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        const userId = user._id;

        // First, check if there's already an auto-processed record (skip those)
        const autoRecord = await Attendance.findOne({
          user_id: userId,
          date: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ["auto-leave", "auto-half-day"] },
          check_in: null,
        });

        if (autoRecord) {
          console.log(
            `   ℹ️  Already auto-processed (status: ${autoRecord.status}) - skipping`
          );
          skippedCount++;
          continue;
        }

        // Now find any REAL attendance record (with or without check-in)
        const attendance = await Attendance.findOne({
          user_id: userId,
          date: { $gte: startOfDay, $lte: endOfDay },
        });

        console.log(
          `\n👤 Processing: ${user.first_name} ${user.last_name} (${userId})`
        );

        // Debug logging
        if (attendance) {
          console.log(`   📋 Found attendance:`);
          console.log(`      Date: ${attendance.date}`);
          console.log(`      Check-in: ${attendance.check_in || "NULL"}`);
          console.log(`      Check-out: ${attendance.check_out || "NULL"}`);
          console.log(`      Status: ${attendance.status}`);
        } else {
          console.log(`   📋 No attendance record found`);
        }

        // ----- CASE 1: Missing attendance (no record at all) -----
        if (!attendance) {
          console.log(`   ⚠️ No attendance record found - applying auto-leave`);

          // Trip events are still valid (company trips where employees don't need to check in)
          if (tripEvent) {
            await Attendance.create({
              user_id: userId,
              date: startOfDay,
              status: "trip",
              action_taken_by: "System",
              analysis: `Company trip: ${tripEvent.title}. Attendance auto-marked as trip.`,
            });

            await sendEmployeeNotification(
              userId,
              `automatically marked your attendance as trip for "${tripEvent.title}" on ${dateStr}.`,
              false
            );

            console.log(`   ✅ Marked as TRIP`);
            processedCount++;
            continue;
          }

          // If no check-in, always mark as unpaid auto-leave, even if there's an office event
          // Office events only affect attendance when user has checked in
          console.log(
            `   🔄 Applying AUTO-LEAVE (full day) - no check-in recorded, regardless of office events`
          );
          await handleMissingAttendance(userId, startOfDay, user);
          processedCount++;
          continue;
        }

        // ----- CASE 2: Has check-in but no check-out -----
        if (attendance.check_in && !attendance.check_out) {
          console.log(`   ⚠️ Has check-in but missing check-out`);
          console.log(`   Check-in time: ${attendance.check_in}`);
          console.log(`   Current status: ${attendance.status}`);

          if (tripEvent) {
            attendance.status = "trip";
            attendance.action_taken_by = "System";
            attendance.analysis = `Updated to trip status for: ${tripEvent.title}`;
            await attendance.save();

            await sendEmployeeNotification(
              userId,
              `automatically updated your attendance to trip status for "${tripEvent.title}" on ${dateStr}.`,
              false
            );

            console.log(`   ✅ Updated to TRIP status`);
            processedCount++;
            continue;
          }

          if (officeEvent) {
            // Convert event times to UTC for proper comparison
            // Note: MongoDB stores dates in UTC. Event times are stored as Date objects.
            // If event was created with "5 PM PKT", it's stored as 12:00 UTC (17:00 - 5:00).
            // We extract the UTC time components and normalize to yesterday's date for comparison.
            const eventStartTime = officeEvent.start_time
              ? new Date(officeEvent.start_time)
              : null;
            const eventEndTime = officeEvent.end_time
              ? new Date(officeEvent.end_time)
              : null;

            // Normalize event times to the same date (yesterday) for comparison
            // Extract UTC time components (hours/minutes) and apply to yesterday's date in UTC
            let normalizedEventStart = null;
            let normalizedEventEnd = null;

            if (eventStartTime) {
              // Get hours and minutes from event start time
              const eventStartHours = eventStartTime.getUTCHours();
              const eventStartMinutes = eventStartTime.getUTCMinutes();
              normalizedEventStart = new Date(
                Date.UTC(
                  yesterday.getUTCFullYear(),
                  yesterday.getUTCMonth(),
                  yesterday.getUTCDate(),
                  eventStartHours,
                  eventStartMinutes,
                  0,
                  0
                )
              );
            }

            if (eventEndTime) {
              // Get hours and minutes from event end time
              const eventEndHours = eventEndTime.getUTCHours();
              const eventEndMinutes = eventEndTime.getUTCMinutes();
              normalizedEventEnd = new Date(
                Date.UTC(
                  yesterday.getUTCFullYear(),
                  yesterday.getUTCMonth(),
                  yesterday.getUTCDate(),
                  eventEndHours,
                  eventEndMinutes,
                  0,
                  0
                )
              );
            }

            console.log(
              `   📅 Event times - Start: ${
                normalizedEventStart?.toISOString() || "N/A"
              }, End: ${normalizedEventEnd?.toISOString() || "N/A"}`
            );

            // Get the attendance date to ensure checkout is on the same day
            const attendanceDate = new Date(attendance.date);
            const attendanceDateUTC = new Date(
              Date.UTC(
                attendanceDate.getUTCFullYear(),
                attendanceDate.getUTCMonth(),
                attendanceDate.getUTCDate()
              )
            );

            // Get user's checkout time from their working hours configuration
            let userCheckoutTime = null;
            let checkoutTimeHours = 19; // Default to 7 PM (19:00) if not found
            let checkoutTimeMinutes = 0;

            try {
              const workingHours =
                await WorkingHoursService.GetWorkingHoursByUserIdService(
                  userId
                );
              if (workingHours && workingHours.checkout_time) {
                // checkout_time is stored as a Date object
                // We need to extract the time in PKT (Asia/Karachi timezone)
                const checkoutTimeDate = new Date(workingHours.checkout_time);

                // Get time components in PKT using Intl.DateTimeFormat
                const formatter = new Intl.DateTimeFormat("en-US", {
                  timeZone: "Asia/Karachi",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });

                const parts = formatter.formatToParts(checkoutTimeDate);
                const hourPart = parts.find((p) => p.type === "hour");
                const minutePart = parts.find((p) => p.type === "minute");

                if (hourPart && minutePart) {
                  checkoutTimeHours = parseInt(hourPart.value, 10);
                  checkoutTimeMinutes = parseInt(minutePart.value, 10);

                  // Create checkout time in UTC that represents the PKT time for the attendance date
                  // PKT is UTC+5, so 7 PM PKT = 14:00 UTC (19:00 - 5:00)
                  userCheckoutTime = new Date(
                    Date.UTC(
                      attendanceDateUTC.getUTCFullYear(),
                      attendanceDateUTC.getUTCMonth(),
                      attendanceDateUTC.getUTCDate(),
                      checkoutTimeHours - 5, // Convert PKT to UTC (subtract 5 hours)
                      checkoutTimeMinutes,
                      0,
                      0
                    )
                  );

                  console.log(
                    `   📅 User checkout time: ${checkoutTimeHours}:${String(
                      checkoutTimeMinutes
                    ).padStart(
                      2,
                      "0"
                    )} PKT (${userCheckoutTime.toISOString()} UTC)`
                  );
                }
              }
            } catch (error) {
              console.warn(
                `   ⚠️ Could not fetch working hours for user ${userId}, using default 7 PM: ${error.message}`
              );
            }

            // Create fallback checkout time (7 PM PKT) for the attendance date
            const sevenPMForAttendanceDate = new Date(
              Date.UTC(
                attendanceDateUTC.getUTCFullYear(),
                attendanceDateUTC.getUTCMonth(),
                attendanceDateUTC.getUTCDate(),
                14, // 7 PM PKT = 14:00 UTC (19:00 - 5:00)
                0,
                0,
                0
              )
            );

            // Use user's checkout time (or fallback to 7 PM) for comparison
            const userCheckoutTimeForComparison =
              userCheckoutTime || sevenPMForAttendanceDate;

            // Determine how event affects this employee's checkout:
            // 1. If event starts AFTER employee's checkout time → mark as half-day (employee should have checked out before event)
            // 2. If event starts BEFORE employee's checkout time but ends AFTER → use employee's checkout time (not event end time)
            // 3. If event is completely within working hours (ends before or at checkout time) → use employee's checkout time
            const eventStartsAfterCheckout =
              normalizedEventStart &&
              normalizedEventStart >= userCheckoutTimeForComparison;
            const eventEndsAfterCheckout =
              normalizedEventEnd &&
              normalizedEventEnd > userCheckoutTimeForComparison;
            const eventStartsBeforeCheckout =
              normalizedEventStart &&
              normalizedEventStart < userCheckoutTimeForComparison;

            console.log(
              `   🔍 Event analysis for user checkout time (${checkoutTimeHours}:${String(
                checkoutTimeMinutes
              ).padStart(2, "0")} PKT):`
            );
            console.log(
              `      - Event starts after checkout: ${eventStartsAfterCheckout}`
            );
            console.log(
              `      - Event ends after checkout: ${eventEndsAfterCheckout}`
            );
            console.log(
              `      - Event starts before checkout: ${eventStartsBeforeCheckout}`
            );

            if (eventStartsAfterCheckout) {
              // Event starts after employee's checkout time → mark as half-day
              console.log(
                `   🏢 Office event starts after user's checkout time (${checkoutTimeHours}:${String(
                  checkoutTimeMinutes
                ).padStart(2, "0")} PKT) - marking as half-day`
              );
              await handleMissingCheckout(attendance, userId, startOfDay, user);
              processedCount++;
              continue;
            } else if (eventStartsBeforeCheckout && eventEndsAfterCheckout) {
              // Event starts before checkout but ends after → use employee's checkout time
              console.log(
                `   🏢 Office event overlaps with checkout time - using user's checkout time (${checkoutTimeHours}:${String(
                  checkoutTimeMinutes
                ).padStart(2, "0")} PKT) as normal attendance`
              );

              // Use user's checkout time (or fallback to 7 PM) for the attendance date
              const checkoutTime = userCheckoutTime || sevenPMForAttendanceDate;

              // Ensure checkout is after check-in (if not, it means checkout is on next day, which shouldn't happen)
              // But we'll use the checkout time as-is since it's the user's configured shift end time
              const finalCheckoutTime = checkoutTime;

              const productionTimeMs = finalCheckoutTime - attendance.check_in;
              const hoursWorked = Math.floor(productionTimeMs / 3600000);
              const minutesWorked = Math.floor(
                (productionTimeMs % 3600000) / 60000
              );

              // Ensure production time is not negative
              let finalHoursWorked = hoursWorked;
              let finalMinutesWorked = minutesWorked;

              if (productionTimeMs < 0) {
                console.warn(
                  `   ⚠️ Checkout time (${finalCheckoutTime.toISOString()}) is before check-in (${attendance.check_in.toISOString()}). Adjusting to be after check-in.`
                );
                // If checkout is before check-in, set it to be 8 hours after check-in
                const adjustedCheckout = new Date(
                  attendance.check_in.getTime() + 8 * 60 * 60 * 1000
                );
                attendance.check_out = adjustedCheckout;
                const adjustedProductionTimeMs =
                  adjustedCheckout - attendance.check_in;
                finalHoursWorked = Math.floor(
                  adjustedProductionTimeMs / 3600000
                );
                finalMinutesWorked = Math.floor(
                  (adjustedProductionTimeMs % 3600000) / 60000
                );
                attendance.production_time = `${finalHoursWorked}h ${finalMinutesWorked}m`;
              } else {
                attendance.check_out = finalCheckoutTime;
                attendance.production_time = `${hoursWorked}h ${minutesWorked}m`;
              }

              attendance.status = "present"; // Mark as normal attendance, not auto-half-day
              attendance.updated_by = userId;

              // Format time for display in 12-hour format (e.g., "11:00 PM" or "7:00 PM")
              const finalCheckoutHours = userCheckoutTime
                ? checkoutTimeHours
                : 19;
              const finalCheckoutMinutes = userCheckoutTime
                ? checkoutTimeMinutes
                : 0;

              let timeStr = "";
              if (finalCheckoutHours === 0) {
                timeStr = `12:${String(finalCheckoutMinutes).padStart(
                  2,
                  "0"
                )} AM`;
              } else if (finalCheckoutHours < 12) {
                timeStr = `${finalCheckoutHours}:${String(
                  finalCheckoutMinutes
                ).padStart(2, "0")} AM`;
              } else if (finalCheckoutHours === 12) {
                timeStr = `12:${String(finalCheckoutMinutes).padStart(
                  2,
                  "0"
                )} PM`;
              } else {
                timeStr = `${finalCheckoutHours - 12}:${String(
                  finalCheckoutMinutes
                ).padStart(2, "0")} PM`;
              }

              // Format attendance date for notification
              const attendanceDateStr = new Date(
                attendanceDate
              ).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "Asia/Karachi",
              });

              attendance.analysis = `Auto-checkout at ${timeStr} (user's checkout time) due to office event "${officeEvent.title}" preventing normal checkout. Marked as normal attendance.`;

              await attendance.save();

              const fullName = user
                ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                : "an employee";

              // Send notification with correct message format
              await sendEmployeeNotification(
                userId,
                `Your attendance for ${attendanceDateStr} was auto-marked as Present due to the office event. You have been credited with ${finalHoursWorked} working hours.`,
                true,
                `${fullName}'s attendance for ${attendanceDateStr} was auto-marked as Present due to the office event. They have been credited with ${finalHoursWorked} working hours.`
              );

              console.log(
                `   ✅ Auto-checkout at ${timeStr} applied - marked as PRESENT (${finalHoursWorked}h ${finalMinutesWorked}m)`
              );
              processedCount++;
              continue;
            } else {
              // Event is completely within working hours (ends before or at checkout time)
              // Use employee's checkout time as normal attendance
              console.log(
                `   🏢 Office event is within working hours - using user's checkout time (${checkoutTimeHours}:${String(
                  checkoutTimeMinutes
                ).padStart(2, "0")} PKT) as normal attendance`
              );
              // Use user's checkout time (or fallback to 7 PM) for the attendance date
              const checkoutTime = userCheckoutTime || sevenPMForAttendanceDate;
              const finalCheckoutTime = checkoutTime;

              const productionTimeMs = finalCheckoutTime - attendance.check_in;
              const hoursWorked = Math.floor(productionTimeMs / 3600000);
              const minutesWorked = Math.floor(
                (productionTimeMs % 3600000) / 60000
              );

              let finalHoursWorked = hoursWorked;
              let finalMinutesWorked = minutesWorked;

              if (productionTimeMs < 0) {
                console.warn(
                  `   ⚠️ Checkout time (${finalCheckoutTime.toISOString()}) is before check-in (${attendance.check_in.toISOString()}). Adjusting to be after check-in.`
                );
                const adjustedCheckout = new Date(
                  attendance.check_in.getTime() + 8 * 60 * 60 * 1000
                );
                attendance.check_out = adjustedCheckout;
                const adjustedProductionTimeMs =
                  adjustedCheckout - attendance.check_in;
                finalHoursWorked = Math.floor(
                  adjustedProductionTimeMs / 3600000
                );
                finalMinutesWorked = Math.floor(
                  (adjustedProductionTimeMs % 3600000) / 60000
                );
                attendance.production_time = `${finalHoursWorked}h ${finalMinutesWorked}m`;
              } else {
                attendance.check_out = finalCheckoutTime;
                attendance.production_time = `${hoursWorked}h ${minutesWorked}m`;
              }

              attendance.status = "present";
              attendance.updated_by = userId;

              const finalCheckoutHours = userCheckoutTime
                ? checkoutTimeHours
                : 19;
              const finalCheckoutMinutes = userCheckoutTime
                ? checkoutTimeMinutes
                : 0;

              let timeStr = "";
              if (finalCheckoutHours === 0) {
                timeStr = `12:${String(finalCheckoutMinutes).padStart(
                  2,
                  "0"
                )} AM`;
              } else if (finalCheckoutHours < 12) {
                timeStr = `${finalCheckoutHours}:${String(
                  finalCheckoutMinutes
                ).padStart(2, "0")} AM`;
              } else if (finalCheckoutHours === 12) {
                timeStr = `12:${String(finalCheckoutMinutes).padStart(
                  2,
                  "0"
                )} PM`;
              } else {
                timeStr = `${finalCheckoutHours - 12}:${String(
                  finalCheckoutMinutes
                ).padStart(2, "0")} PM`;
              }

              const attendanceDateStr = new Date(
                attendanceDate
              ).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "Asia/Karachi",
              });

              attendance.analysis = `Auto-checkout at ${timeStr} (user's checkout time) due to office event "${officeEvent.title}". Marked as normal attendance.`;

              await attendance.save();

              const fullName = user
                ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                : "an employee";

              await sendEmployeeNotification(
                userId,
                `Your attendance for ${attendanceDateStr} was auto-marked as Present due to the office event. You have been credited with ${finalHoursWorked} working hours.`,
                true,
                `${fullName}'s attendance for ${attendanceDateStr} was auto-marked as Present due to the office event. They have been credited with ${finalHoursWorked} working hours.`
              );

              console.log(
                `   ✅ Auto-checkout at ${timeStr} applied - marked as PRESENT (${finalHoursWorked}h ${finalMinutesWorked}m)`
              );
              processedCount++;
              continue;
            }
          }

          console.log(`   🔄 Applying AUTO-HALF-DAY (missing checkout)`);
          await handleMissingCheckout(attendance, userId, startOfDay, user);
          processedCount++;
          continue;
        }

        // ----- CASE 3: Complete attendance (has both check-in and check-out) -----
        if (attendance.check_in && attendance.check_out) {
          console.log(
            `   ✅ Complete attendance (check-in: ${attendance.check_in}, check-out: ${attendance.check_out}) - skipping`
          );
          skippedCount++;
          continue;
        }

        // ----- CASE 4: Attendance exists but no check-in (edge case - should be rare) -----
        if (attendance && !attendance.check_in && !attendance.check_out) {
          console.log(
            `   ⚠️ Attendance record exists but no check-in/check-out`
          );
          console.log(`   Status: ${attendance.status}`);
          console.log(`   This appears to be a placeholder record - skipping`);
          skippedCount++;
          continue;
        }

        // If we reach here, something unexpected happened
        console.log(`   ⚠️ Unexpected attendance state - skipping`);
        skippedCount++;
      } catch (userError) {
        console.error(
          `   ❌ Error processing user ${user._id}: ${userError.message}`
        );
        errorCount++;
      }
    }

    console.log(`\n📊 Regularization Summary:`);
    console.log(`   ✅ Processed: ${processedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log("✅ Attendance regularization completed.");

    // Send success email to awais with detailed logs
    const processDateStr = new Date(processDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Karachi",
    });

    const successEmailHtml = `
      <h2>✅ Attendance Regularization Cron Job Completed Successfully</h2>
      <p><strong>Date:</strong> ${new Date().toLocaleString("en-US", {
        timeZone: "Asia/Karachi",
      })} (PKT)</p>
      <p><strong>Processed Date:</strong> ${processDateStr}</p>
      <hr>
      <h3>Summary:</h3>
      <ul>
        <li><strong>Total Users Processed:</strong> ${users.length}</li>
        <li><strong>Successfully Processed:</strong> ${processedCount} users</li>
        <li><strong>Skipped (Already Complete):</strong> ${skippedCount} users</li>
        <li><strong>Errors Encountered:</strong> ${errorCount} users</li>
      </ul>
      ${
        tripEvent
          ? `<p><strong>🚌 Trip Event:</strong> ${tripEvent.title}</p>`
          : ""
      }
      ${
        officeEvent
          ? `<p><strong>🏢 Office Event:</strong> ${officeEvent.title}</p>`
          : ""
      }
      <p>The attendance regularization cron job has completed successfully. All active employees' attendance has been processed for ${processDateStr}.</p>
    `;

    await sendSystemEmail(
      `✅ Attendance Regularization Completed - ${processDateStr}`,
      successEmailHtml,
      "awais.tariq@whiteboxtech.net"
    );
  } catch (error) {
    console.error(`❌ Attempt ${attempt} failed: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);

    if (attempt < MAX_ATTEMPTS) {
      const delay = attempt * 30 * 1000;
      console.log(`🔁 Retrying in ${delay / 1000} seconds...`);
      setTimeout(() => runRegularization(attempt + 1), delay);
    } else {
      console.error("⛔ Max retry attempts reached. Cron job failed.");
      const errorDetails = `
      <p><strong>Error Message:</strong> ${error.message}</p>
      <p><strong>Stack Trace:</strong></p>
      <pre>${error.stack}</pre>
    `;

      const processDateStr = new Date(processDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Karachi",
      });

      await sendSystemEmail(
        "🚨 Attendance Cron Failure Alert",
        `<h2>❌ Attendance Regularization Cron Job Failed</h2>
        <p><strong>Date:</strong> ${new Date().toLocaleString("en-US", {
          timeZone: "Asia/Karachi",
        })} (PKT)</p>
        <p><strong>Processed Date:</strong> ${processDateStr}</p>
        <p>The attendance regularization cron job failed after 3 attempts.</p>
        <hr>
        <h3>Error Details:</h3>
        ${errorDetails}
        <p><strong>Please review the server logs and ensure employees' attendance is not skipped.</strong></p>`,
        "awais.tariq@whiteboxtech.net"
      );
    }
  }
};

const handleMissingAttendance = async (userId, date, user) => {
  try {
    const dateStr = date.toISOString().split("T")[0];
    const fullName = user
      ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
      : "an employee";

    console.log(`      📝 Creating full-day unpaid leave for ${fullName}`);

    // Check if leave already exists
    const existingLeave = await Leave.findOne({
      user: userId,
      start_date: date,
      end_date: date,
      is_half_day: false,
    });

    if (existingLeave) {
      console.log(
        `      ℹ️  Full-day leave already exists - skipping leave creation`
      );
    } else {
      // Apply full-day leave
      const newLeave = await new Leave({
        user: userId,
        leave_type: "unpaid",
        start_date: date,
        end_date: date,
        total_days: 1,
        reason: "Auto-generated: No check-in recorded",
        status: "approved",
        action_taken_by: "System",
        is_half_day: false,
      }).save();

      console.log(`      ✅ Leave record created with ID: ${newLeave._id}`);

      await AdjustLeaveStatsForUser(
        userId,
        date.getFullYear(),
        "unpaid",
        1,
        "apply"
      );
      console.log(`      ✅ Leave stats adjusted`);
    }

    // Check if attendance record already exists
    const existingAttendance = await Attendance.findOne({
      user_id: userId,
      date: { $gte: date, $lte: new Date(date.getTime() + 86400000 - 1) },
    });

    if (existingAttendance) {
      console.log(`      ℹ️  Attendance record already exists - updating it`);
      existingAttendance.status = "auto-leave";
      existingAttendance.action_taken_by = "System";
      existingAttendance.analysis =
        "No check-in recorded. System auto-marked as unpaid leave.";
      await existingAttendance.save();
      console.log(`      ✅ Attendance record updated`);
    } else {
      const newAttendance = await Attendance.create({
        user_id: userId,
        date,
        status: "auto-leave",
        created_by: userId,
        updated_by: userId,
        action_taken_by: "System",
        analysis: "No check-in recorded. System auto-marked as unpaid leave.",
      });
      console.log(
        `      ✅ Attendance record created with ID: ${newAttendance._id}`
      );
    }

    // Send notification
    try {
      await sendEmployeeNotification(
        userId,
        `marked your attendance as unpaid leave because no check-in was recorded on ${dateStr}.`,
        true,
        `marked ${fullName}'s attendance as unpaid leave on ${dateStr} (no check-in recorded).`
      );
      console.log(`      ✅ Notification sent`);
    } catch (notifError) {
      console.error(
        `      ⚠️ Failed to send notification: ${notifError.message}`
      );
    }

    console.log(`      ✅ Full-day leave processing completed for ${fullName}`);
  } catch (error) {
    console.error(
      `      ❌ Error in handleMissingAttendance for user ${userId}: ${error.message}`
    );
    console.error(`      Stack: ${error.stack}`);
    throw error;
  }
};

const handleMissingCheckout = async (attendance, userId, date, user) => {
  try {
    if (!attendance.check_in) {
      throw new Error("Check-in is missing; cannot compute check-out.");
    }

    const dateStr = date.toISOString().split("T")[0];
    const fullName = user
      ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
      : "an employee";

    console.log(`      📝 Processing half-day for ${fullName}`);

    // Set checkout time to 5 hours after check-in
    const checkoutTime = new Date(attendance.check_in);
    checkoutTime.setHours(checkoutTime.getHours() + 5);

    const productionTimeMs = checkoutTime - attendance.check_in;
    const hoursWorked = Math.floor(productionTimeMs / 3600000);
    const minutesWorked = Math.floor((productionTimeMs % 3600000) / 60000);

    attendance.check_out = checkoutTime;
    attendance.production_time = `${hoursWorked}h ${minutesWorked}m`;
    attendance.status = "auto-half-day";
    attendance.updated_by = userId;
    attendance.analysis =
      "No check-out recorded. System assumed 5-hour shift and marked as half-day.";
    await attendance.save();

    console.log(
      `      ✅ Attendance updated: checkout at ${checkoutTime.toISOString()}, worked ${hoursWorked}h ${minutesWorked}m`
    );

    // Apply half-day leave if not already present
    const alreadyExists = await Leave.findOne({
      user: userId,
      start_date: date,
      end_date: date,
      is_half_day: true,
    });

    if (!alreadyExists) {
      const newLeave = await new Leave({
        user: userId,
        leave_type: "unpaid",
        start_date: date,
        end_date: date,
        total_days: 0.5,
        reason: "Auto-generated: No check-out, 5-hour shift assumed",
        status: "approved",
        action_taken_by: "System",
        is_half_day: true,
      }).save();

      console.log(`      ✅ Half-day leave created with ID: ${newLeave._id}`);

      await AdjustLeaveStatsForUser(
        userId,
        date.getFullYear(),
        "unpaid",
        0.5,
        "apply"
      );

      console.log(`      ✅ Leave stats adjusted`);
    } else {
      console.log(
        `      ℹ️  Half-day leave already exists - skipping creation`
      );
    }

    // Send notification
    try {
      await sendEmployeeNotification(
        userId,
        `automatically checked out your attendance and marked as half-day due to missing check-out on ${dateStr}. A 5-hour shift was assumed.`,
        true,
        `auto-checked out ${fullName} on ${dateStr} and marked them as half-day due to missing check-out.`
      );
      console.log(`      ✅ Notification sent`);
    } catch (notifError) {
      console.error(
        `      ⚠️ Failed to send notification: ${notifError.message}`
      );
    }

    console.log(`      ✅ Half-day processing completed for ${fullName}`);
  } catch (error) {
    console.error(
      `      ❌ Error in handleMissingCheckout for user ${userId}: ${error.message}`
    );
    console.error(`      Stack: ${error.stack}`);
    throw error;
  }
};

// Schedule cron job
// For testing: use * * * * * (runs every minute)
// For production: use 0 1 * * 2-6 (Tue–Sat at 1:00 AM UTC = 6:00 AM PKT)
const regularizeAttendance = cron.schedule("0 1 * * 2-6", () => {
  console.log("\n🚀 ============ CRON JOB TRIGGERED ============");
  runRegularization();
});

export default regularizeAttendance;
