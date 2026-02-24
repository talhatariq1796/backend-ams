import cron from "node-cron";
import User from "../models/user.model.js";
import Suggestion from "../models/suggestion.model.js";
import {
  birthdayTemplates,
  anniversaryTemplates,
} from "../utils/celebrationTemplates.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import { runCronWithRetry } from "../utils/cronRunner.util.js";

const GENERAL_ADMIN_ID = "686b817b00c74fe33a6d5729";
const PKT_TIMEZONE = "Asia/Karachi"; // UTC+5

// helper: returns a unique template each call
const getUniqueTemplate = (templates, used) => {
  const available = templates.filter((t) => !used.has(t));
  if (available.length === 0) {
    used.clear();
    available.push(...templates);
  }
  const chosen = available[Math.floor(Math.random() * available.length)];
  used.add(chosen);
  return chosen;
};

// Get MM-DD in Pakistan timezone from UTC date
const getPKTMonthDay = (utcDate) => {
  const date = new Date(utcDate);

  // Convert to Pakistan time string and extract date parts
  const pktString = date.toLocaleString("en-US", {
    timeZone: PKT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // Format: MM/DD/YYYY
  const [month, day] = pktString.split(",")[0].split("/");
  return `${month}-${day}`;
};

// Runs at 6:00 AM PKT (1:00 AM UTC)
const celebrationPostJob = cron.schedule("0 1 * * *", () => {
  runCronWithRetry("Celebration Post Cron", async () => {
    const now = new Date();

    // Get today's date in Pakistan timezone
    const todayPKT = new Date(
      now.toLocaleString("en-US", { timeZone: PKT_TIMEZONE })
    );
    const todayMonthDay = getPKTMonthDay(now);

    // Create date range for "today" in Pakistan timezone
    const pktDateString = todayPKT.toLocaleDateString("en-CA"); // YYYY-MM-DD format
    const [year, month, day] = pktDateString.split("-").map(Number);

    // Start and end of today in PKT, converted to UTC for MongoDB query
    const startOfTodayPKT = new Date(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}T00:00:00+05:00`
    );
    const startOfTomorrowPKT = new Date(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}T00:00:00+05:00`
    );
    startOfTomorrowPKT.setDate(startOfTomorrowPKT.getDate() + 1);

    console.log("🗓️  Current UTC time:", now.toISOString());
    console.log(
      "🗓️  Today in Pakistan (PKT):",
      todayPKT.toLocaleString("en-US", { timeZone: PKT_TIMEZONE })
    );
    console.log(
      "📅 Looking for celebrations on (PKT month-day):",
      todayMonthDay
    );
    console.log("📅 Date range (UTC):", {
      start: startOfTodayPKT.toISOString(),
      end: startOfTomorrowPKT.toISOString(),
    });

    const users = await User.find({ is_active: true }).populate({
      path: "team",
      populate: { path: "department" },
    });

    console.log(`📋 Total active users found: ${users.length}`);

    const todayBirthdays = [];
    const todayAnniversaries = [];

    // Filter users by birthday and anniversary
    for (const user of users) {
      // Check for birthdays
      if (user.date_of_birth) {
        const userBirthdayMonthDay = getPKTMonthDay(user.date_of_birth);

        console.log(
          `👤 ${user.first_name} ${
            user.last_name
          }: DOB (UTC) ${user.date_of_birth.toISOString()} → (PKT) ${userBirthdayMonthDay} ${
            userBirthdayMonthDay === todayMonthDay ? "🎂 MATCH!" : ""
          }`
        );

        if (userBirthdayMonthDay === todayMonthDay) {
          todayBirthdays.push(user);
        }
      }

      // Check for anniversaries
      if (user.joining_date) {
        const userJoiningMonthDay = getPKTMonthDay(user.joining_date);

        // Get the year in PKT timezone
        const joiningDatePKT = new Date(
          user.joining_date.toLocaleString("en-US", { timeZone: PKT_TIMEZONE })
        );
        const joiningYear = joiningDatePKT.getFullYear();
        const currentYear = todayPKT.getFullYear();

        console.log(
          `👤 ${user.first_name} ${
            user.last_name
          }: Joining (UTC) ${user.joining_date.toISOString()} → (PKT) ${userJoiningMonthDay}, year: ${joiningYear}`
        );

        // Only celebrate if at least 1 year has passed
        if (
          userJoiningMonthDay === todayMonthDay &&
          currentYear > joiningYear
        ) {
          todayAnniversaries.push(user);
          const yearsOfService = currentYear - joiningYear;
          console.log(
            `  🎊 ✅ ANNIVERSARY MATCH! (${yearsOfService} year${
              yearsOfService > 1 ? "s" : ""
            })`
          );
        }
      }
    }

    console.log(
      `\n📊 Summary: ${todayBirthdays.length} birthdays, ${todayAnniversaries.length} anniversaries`
    );

    const celebrationPosts = [];
    const usedBirthdayTemplates = new Set();
    const usedAnniversaryTemplates = new Set();

    // 🎂 Birthday Posts
    for (const user of todayBirthdays) {
      const already = await Suggestion.findOne({
        celebration_type: "birthday",
        created_for_user: user._id,
        createdAt: { $gte: startOfTodayPKT, $lt: startOfTomorrowPKT },
      }).lean();

      if (already) {
        console.log(
          `⏭️  Skipping ${user.first_name} - birthday post already exists`
        );
        continue;
      }

      const template = getUniqueTemplate(
        birthdayTemplates,
        usedBirthdayTemplates
      );
      const title = `🎉 Birthday Alert: ${user.first_name} ${user.last_name}`;
      const description = template.replace("{name}", user.first_name);

      const visibleDepartments = user?.team?.department?._id
        ? [user.team.department._id]
        : [];

      const post = await Suggestion.create({
        title,
        description,
        category: "culture",
        celebration_type: "birthday",
        created_by: GENERAL_ADMIN_ID,
        created_for_user: user._id,
        visible_to_departments: visibleDepartments,
        is_identity_hidden: false,
        is_visible_to_admin_only: false,
      });

      await createLogsAndNotification({
        notification_by: GENERAL_ADMIN_ID,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: ` created a birthday post for ${user.first_name} ${user.last_name}`,
        notifyDepartments: visibleDepartments,
        hideNotificationIdentity: false,
      });

      celebrationPosts.push(post._id);
      console.log(
        `✨ Created birthday post for ${user.first_name} ${user.last_name}`
      );
    }

    // 🎊 Anniversary Posts
    for (const user of todayAnniversaries) {
      const already = await Suggestion.findOne({
        celebration_type: "anniversary",
        created_for_user: user._id,
        createdAt: { $gte: startOfTodayPKT, $lt: startOfTomorrowPKT },
      }).lean();

      if (already) {
        console.log(
          `⏭️  Skipping ${user.first_name} - anniversary post already exists`
        );
        continue;
      }

      const template = getUniqueTemplate(
        anniversaryTemplates,
        usedAnniversaryTemplates
      );

      // Calculate years of service in PKT timezone
      const joiningDatePKT = new Date(
        user.joining_date.toLocaleString("en-US", { timeZone: PKT_TIMEZONE })
      );
      const yearsOfService =
        todayPKT.getFullYear() - joiningDatePKT.getFullYear();

      const title = `🎊 Anniversary Alert: ${user.first_name} ${
        user.last_name
      } - ${yearsOfService} Year${yearsOfService > 1 ? "s" : ""}`;
      const description = template
        .replace("{name}", user.first_name)
        .replace("{years}", yearsOfService);

      const visibleDepartments = user?.team?.department?._id
        ? [user.team.department._id]
        : [];

      const post = await Suggestion.create({
        title,
        description,
        category: "culture",
        celebration_type: "anniversary",
        created_by: GENERAL_ADMIN_ID,
        created_for_user: user._id,
        visible_to_departments: visibleDepartments,
        is_identity_hidden: false,
        is_visible_to_admin_only: false,
      });

      await createLogsAndNotification({
        notification_by: GENERAL_ADMIN_ID,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: ` created an anniversary post for ${user.first_name} ${user.last_name}`,
        notifyDepartments: visibleDepartments,
        hideNotificationIdentity: false,
      });

      celebrationPosts.push(post._id);
      console.log(
        `✨ Created anniversary post for ${user.first_name} ${user.last_name}`
      );
    }

    console.log(
      `\n✅ Celebration Post Cron completed. Created ${
        celebrationPosts.length
      } post${celebrationPosts.length !== 1 ? "s" : ""}.`
    );
    if (celebrationPosts.length > 0) {
      console.log(`   Post IDs: ${celebrationPosts.join(", ")}`);
    }
  });
});

export default celebrationPostJob;
