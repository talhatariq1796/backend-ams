import cron from "node-cron";
import Attendance from "../models/attendance.model.js";
import Leave from "../models/requests/leave.model.js";
import User from "../models/user.model.js";
import CompanyConfigs from "../models/config.model.js";
import Company from "../models/company.model.js";
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
  adminMessage = null,
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
      `⚠️ Failed to send notification to user ${userId}: ${error.message}`,
    );
  }
};

const runRegularization = async (attempt = 1) => {
  console.log(
    `🕓 Attempt ${attempt}: Running attendance regularization cron job at 6 AM...`
  );

  try {
    const companies = await Company.find({
      is_active: true,
      status: "approved",
    });
    console.log(`📊 Processing attendance for ${companies.length} companies`);

    for (const company of companies) {
      console.log(
        `\n🏢 Processing company: ${company.company_name} (${company._id})`
      );

      const users = await User.find({
        company_id: company._id,
        is_active: true,
        role: { $in: ["employee", "teamLead"] },
      }).select("_id designation first_name last_name");

      if (users.length === 0) {
        console.log(
          `❌ No active employees found for company ${company.company_name}.`,
        );
        continue;
      }

      const config = await CompanyConfigs.findOne({ company_id: company._id });
      if (!config) {
        console.log(`⚠️  No config found for company ${company.company_name}`);
        continue;
      }

      const workingDays = config?.working_days || [1, 2, 3, 4, 5];

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Process yesterday's date (the day we're regularizing attendance for)
      const processDate = new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate(),
      );
      const dateStr = processDate.toISOString().split("T")[0];
      const startOfDay = new Date(processDate);
      const endOfDay = new Date(processDate);
      endOfDay.setHours(23, 59, 59, 999);
      const dayOfWeek = processDate.getDay();

      console.log(`📅 Cron running at: ${today.toISOString()}`);
      console.log(
        `📅 Processing attendance for PREVIOUS day: ${dateStr} (Day of week: ${dayOfWeek})`,
      );

      // Skip processing if the day we're processing was not a working day
      if (!workingDays.includes(dayOfWeek)) {
        console.log(
          `🔕 The day being processed (${dateStr}) was not a working day (day ${dayOfWeek}). Skipping.`,
        );
        return;
      }

      // ----- 1️⃣ Public Holiday Check -----
      // Check if the day we're processing (yesterday) was a public holiday
      const holidays = await Event.find({
        company_id: company._id,
        category: "public-holiday",
      });
      const holidayOnProcessDate = holidays.find((h) => {
        const holidayDate = new Date(h.date);
        const isMatch = isSameDate(holidayDate, processDate);
        console.log(
          `🔍 Checking holiday: ${
            h.title
          } on ${holidayDate.toDateString()} vs processing date ${processDate.toDateString()} = ${isMatch}`,
        );
        return isMatch;
      });

      if (holidayOnProcessDate) {
        console.log(
          `📌 Public holiday detected on processing date: ${holidayOnProcessDate.title} on ${dateStr}`,
        );
        for (const user of users) {
          const alreadyExists = await Attendance.findOne({
            company_id: company._id,
            user_id: user._id,
            date: { $gte: startOfDay, $lte: endOfDay },
          });

          if (!alreadyExists) {
            await Attendance.create({
              company_id: company._id,
              user_id: user._id,
              date: startOfDay,
              status: "holiday",
              action_taken_by: "System",
              analysis: `Public holiday: ${holidayOnProcessDate.title}. System auto-marked as holiday.`,
            });
          }
          await sendEmployeeNotification(
              user._id,
              `automatically marked your attendance as holiday for ${holidayOnProcessDate.title} on ${dateStr}.`,
              false,
            );

          console.log(
            `✅ Holiday attendance marked for user ${user._id} on ${dateStr}`,
          );
        }
        return;
      }

      // ----- 2️⃣ Trips and Office Events -----
      const events = await Event.find({
        company_id: company._id,
        category: { $in: ["trip", "office-event"] },
      });

      console.log(
        `🔍 Found ${events.length} trip/office events to check against processing date: ${dateStr}`,
      );

      const tripEvent = events.find((e) => {
        if (e.category !== "trip") return false;
        const eventDate = new Date(e.date);
        const isMatch =
          isSameDate(eventDate, processDate) ||
          (e.end_date && isDateInEventRange(processDate, e));
        console.log(
          `🔍 Checking trip: ${e.title} on ${eventDate.toDateString()} vs processing date ${processDate.toDateString()} = ${isMatch}`,
        );
        return isMatch;
      });

      const officeEvent = events.find((e) => {
        if (e.category !== "office-event") return false;
        const eventDate = new Date(e.date);
        const isMatch =
          isSameDate(eventDate, processDate) ||
          (e.end_date && isDateInEventRange(processDate, e));
        console.log(
          `🔍 Checking office event: ${e.title} on ${eventDate.toDateString()} vs processing date ${processDate.toDateString()} = ${isMatch}`,
        );
        return isMatch;
      });

      if (tripEvent) {
        console.log(
          `🚌 Trip event detected on processing date: ${tripEvent.title} on ${dateStr}`,
        );
      }
      if (officeEvent) {
        console.log(
          `🏢 Office event detected on processing date: ${officeEvent.title} on ${dateStr}`,
        );
      }

      let processedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const user of users) {
        try {
          const userId = user._id;

          const autoRecord = await Attendance.findOne({
            company_id: company._id,
            user_id: userId,
            date: { $gte: startOfDay, $lte: endOfDay },
            status: { $in: ["auto-leave", "auto-half-day"] },
            check_in: null,
          });

          if (autoRecord) {
            skippedCount++;
            continue;
          }

          const attendance = await Attendance.findOne({
            company_id: company._id,
            user_id: userId,
            date: { $gte: startOfDay, $lte: endOfDay },
          });

          // ----- CASE 1: Missing attendance (no record at all) -----
          if (!attendance) {
            if (tripEvent) {
              await Attendance.create({
                company_id: company._id,
                user_id: userId,
                date: startOfDay,
                status: "trip",
                action_taken_by: "System",
                analysis: `Company trip: ${tripEvent.title}. Attendance auto-marked as trip.`,
              });
              await sendEmployeeNotification(
                userId,
                `automatically marked your attendance as trip for "${tripEvent.title}" on ${dateStr}.`,
                false,
              );
              processedCount++;
              continue;
            }
            await handleMissingAttendance(
              company._id,
              userId,
              startOfDay,
              user,
            );
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
                false,
              );
              console.log(`   ✅ Updated to TRIP status`);
              processedCount++;
              continue;
            }
            if (officeEvent) {
              const eightPM = new Date(startOfDay);
              eightPM.setHours(20, 0, 0, 0);
              if (
                officeEvent.end_time &&
                new Date(officeEvent.end_time) > eightPM
              ) {
                const autoCheckout = new Date(startOfDay);
                autoCheckout.setHours(19, 0, 0, 0);
                const productionTimeMs = autoCheckout - attendance.check_in;
                const hoursWorked = Math.floor(productionTimeMs / 3600000);
                const minutesWorked = Math.floor(
                  (productionTimeMs % 3600000) / 60000,
                );
                attendance.check_out = autoCheckout;
                attendance.production_time = `${hoursWorked}h ${minutesWorked}m`;
                attendance.status =
                  hoursWorked < 5 ? "auto-half-day" : "present";
                attendance.updated_by = userId;
                await attendance.save();
                await sendEmployeeNotification(
                  userId,
                  `automatically checked out your attendance at 7:00 PM due to office event "${officeEvent.title}" extending beyond 8 PM on ${dateStr}.`,
                  true,
                  `auto-checked out ${user.first_name} ${user.last_name} at 7:00 PM due to the office event "${officeEvent.title}" on ${dateStr}.`,
                );
                processedCount++;
                continue;
              }
              attendance.status = "office-event";
              attendance.action_taken_by = "System";
              await attendance.save();
              await sendEmployeeNotification(
                userId,
                `automatically updated your attendance to office event status for "${officeEvent.title}" on ${dateStr}.`,
                false,
              );
              processedCount++;
              continue;
            }
            await handleMissingCheckout(
              company._id,
              attendance,
              userId,
              startOfDay,
              user,
            );
            processedCount++;
            continue;
          }

          skippedCount++;
        } catch (userError) {
          console.error(
            `⚠️ Error processing user ${user._id}: ${userError.message}`,
          );
          errorCount++;
        }
      }
    } // End company loop

    console.log("✅ Attendance regularization completed for all companies.");
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

      await sendSystemEmail(
        "🚨 Attendance Cron Failure Alert",
        `<p>The attendance regularization cron job failed after 3 attempts on <strong>${new Date()}</strong>.</p>
      ${errorDetails}
      <p>Please review the server logs and ensure employees' attendance is not skipped.</p>`,
        "awais.tariq@whiteboxtech.net"
      );
    }
  }
};

const handleMissingAttendance = async (companyId, userId, date, user) => {
  try {
    const dateStr = date.toISOString().split("T")[0];
    const fullName = user
      ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
      : "an employee";

    const existingLeave = await Leave.findOne({
      company_id: companyId,
      user: userId,
      start_date: date,
      end_date: date,
      is_half_day: false,
    });

    if (!existingLeave) {
      await new Leave({
        company_id: companyId,
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
      await AdjustLeaveStatsForUser(
        userId,
        date.getFullYear(),
        "unpaid",
        1,
        "apply",
        companyId,
      );
    }

    const existingAttendance = await Attendance.findOne({
      company_id: companyId,
      user_id: userId,
      date: { $gte: date, $lte: new Date(date.getTime() + 86400000 - 1) },
    });

    if (existingAttendance) {
      existingAttendance.status = "auto-leave";
      existingAttendance.action_taken_by = "System";
      existingAttendance.analysis =
        "No check-in recorded. System auto-marked as unpaid leave.";
      await existingAttendance.save();
    } else {
      await Attendance.create({
        company_id: companyId,
        user_id: userId,
        date,
        status: "auto-leave",
        created_by: userId,
        updated_by: userId,
        action_taken_by: "System",
        analysis: "No check-in recorded. System auto-marked as unpaid leave.",
      });
    }

    await sendEmployeeNotification(
      userId,
      `marked your attendance as unpaid leave because no check-in was recorded on ${dateStr}.`,
      true,
      `marked ${fullName}'s attendance as unpaid leave on ${dateStr} (no check-in recorded).`
    );
  } catch (error) {
    console.error(
      `Error in handleMissingAttendance for user ${userId}: ${error.message}`,
    );
    console.error(`      Stack: ${error.stack}`);
    throw error;
  }
};

const handleMissingCheckout = async (
  companyId,
  attendance,
  userId,
  date,
  user,
) => {
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
      company_id: companyId,
      user: userId,
      start_date: date,
      end_date: date,
      is_half_day: true,
    });

    if (!alreadyExists) {
      const newLeave = await new Leave({
        company_id: companyId,
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
        "apply",
        companyId,
      );

      console.log(`      ✅ Leave stats adjusted`);
    } else {
      console.log(
        `      ℹ️  Half-day leave already exists - skipping creation`
      );
    }

    await sendEmployeeNotification(
      userId,
      `automatically checked out your attendance and marked as half-day due to missing check-out on ${dateStr}. A 5-hour shift was assumed.`,
      true,
      `auto-checked out ${fullName} on ${dateStr} and marked them as half-day due to missing check-out.`
    );
    console.log(
      `✅ Auto-checkout applied for user ${userId} on ${date.toDateString()}`,
    );
  } catch (error) {
    console.error(
      `Error in handleMissingCheckout for user ${userId}: ${error.message}`,
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
