import cron from "node-cron";
import User from "../models/user.model.js";
import LeaveStats from "../models/leaveStats.model.js";
import { InitializeLeaveStatsForUser } from "../utils/leaveStats.util.js";
import { runCronWithRetry } from "../utils/cronRunner.util.js";
import { sendSystemEmail } from "../utils/email.js";
import dayjs from "dayjs";

/**
 * CRON Job: Initialize Leave Stats for New Year
 *
 * This job runs on January 1st at 12:05 AM PKT (7:05 PM UTC on Dec 31)
 * to initialize leave stats for all active users for the new year.
 *
 * Schedule: "5 19 31 12 *" - Runs at 19:05 UTC on December 31st every year
 * For PKT (UTC+5), this is 12:05 AM on January 1st
 */
const initializeLeaveStatsJob = cron.schedule("5 19 31 12 *", () => {
  runCronWithRetry("Initialize Leave Stats for New Year", async () => {
    const currentYear = dayjs().year();
    const targetYear = currentYear; // Initialize for the current year (which is the new year on Jan 1st)

    console.log(
      `\n🚀 ============ INITIALIZE LEAVE STATS CRON JOB TRIGGERED ============`
    );
    console.log(`📅 Target Year: ${targetYear}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);

    // Get all active users
    const activeUsers = await User.find({
      is_active: true,
      role: { $ne: "admin" }, // Exclude admins from leave stats
    }).select("_id first_name last_name employee_id");

    if (!activeUsers || activeUsers.length === 0) {
      console.log(
        "ℹ️  No active users found. Skipping leave stats initialization."
      );
      return;
    }

    console.log(`👥 Found ${activeUsers.length} active users`);

    let successCount = 0;
    let errorCount = 0;
    let alreadyExistedCount = 0;
    const errors = [];

    // Initialize stats for each user
    for (const user of activeUsers) {
      try {
        // Check if stats already exist for this year
        const existingStats = await LeaveStats.findOne({
          user: user._id,
          year: targetYear,
        });

        if (existingStats) {
          console.log(
            `⏭️  Stats already exist for user ${
              user.employee_id || user._id
            } (${user.first_name} ${
              user.last_name
            }) for year ${targetYear}. Skipping.`
          );
          successCount++;
          alreadyExistedCount++;
          continue;
        }

        // Initialize stats for the new year
        await InitializeLeaveStatsForUser(user._id, targetYear);
        console.log(
          `✅ Initialized leave stats for user ${
            user.employee_id || user._id
          } (${user.first_name} ${user.last_name}) for year ${targetYear}`
        );
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = `Failed to initialize stats for user ${
          user.employee_id || user._id
        } (${user.first_name} ${user.last_name}): ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`\n📊 ============ SUMMARY ============`);
    console.log(`✅ Successfully initialized: ${successCount} users`);
    console.log(`❌ Failed: ${errorCount} users`);
    if (errors.length > 0) {
      console.log(`\n⚠️  Errors:`);
      errors.forEach((err) => console.log(`   - ${err}`));
    }
    console.log(
      `\n✅ Leave Stats Initialization Cron completed at: ${new Date().toISOString()}`
    );

    // Send success email to awais and hr
    const successEmailHtml = `
      <h2>✅ Leave Stats Initialization Completed Successfully</h2>
      <p><strong>Date:</strong> ${new Date().toLocaleString("en-US", {
        timeZone: "Asia/Karachi",
      })} (PKT)</p>
      <p><strong>Target Year:</strong> ${targetYear}</p>
      <hr>
      <h3>Summary:</h3>
      <ul>
        <li><strong>Total Active Users:</strong> ${activeUsers.length}</li>
        <li><strong>Successfully Initialized:</strong> ${
          successCount - alreadyExistedCount
        } users</li>
        <li><strong>Already Existed:</strong> ${alreadyExistedCount} users</li>
        <li><strong>Failed:</strong> ${errorCount} users</li>
      </ul>
      ${
        errors.length > 0
          ? `
      <h3>⚠️ Errors Encountered:</h3>
      <ul>
        ${errors.map((err) => `<li>${err}</li>`).join("")}
      </ul>
      `
          : ""
      }
      <p>The leave stats initialization cron job has completed. All active users now have leave stats initialized for year ${targetYear}.</p>
    `;

    // Send success email to awais with detailed logs
    await sendSystemEmail(
      `✅ Leave Stats Initialization Completed - ${targetYear}`,
      successEmailHtml,
      ["awais.tariq@whiteboxtech.net", "hr@whiteboxtech.net"]
    );
  });
});

export default initializeLeaveStatsJob;
