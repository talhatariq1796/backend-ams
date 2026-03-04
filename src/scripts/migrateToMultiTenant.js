/**
 * Migration Script: Add First Company and Backfill Existing Data
 *
 * This script:
 * 1. Creates the WhiteBox company
 * 2. Approves the company
 * 3. Backfills company_id in all existing records
 */

import mongoose from "mongoose";
import Company from "../models/company.model.js";
import User from "../models/user.model.js";
import Attendance from "../models/attendance.model.js";
import Leave from "../models/requests/leave.model.js";
import LeaveStats from "../models/leaveStats.model.js";
import Department from "../models/department.model.js";
import Team from "../models/team.model.js";
import Event from "../models/event.model.js";
import Notification from "../models/notification.model.js";
import Document from "../models/document.model.js";
import Suggestion from "../models/suggestion.model.js";
import Ticket from "../models/ticket.model.js";
import Todo from "../models/todo.model.js";
import WorkingHours from "../models/workingHours.model.js";
import WorkingHoursRequest from "../models/requests/workinghours.model.js";
import RemoteWorkRequest from "../models/requests/remotework.model.js";
import BookMeetingRoom from "../models/requests/bookmeetingroom.model.js";
import Comment from "../models/comments.model.js";
import Like from "../models/likes.model.js";
import Log from "../models/logs.model.js";
import Bug from "../models/bug.model.js";
import RecentRequest from "../models/requests/recentRequest.model.js";
import CompanyConfigs from "../models/config.model.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Connect to database
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error connecting to database: ${error.message}`);
    process.exit(1);
  }
};

const migrateData = async () => {
  try {
    console.log("\n🚀 Starting Multi-Tenant Migration...\n");

    // Step 1: Check if company already exists
    let company = await Company.findOne({
      company_name: { $regex: /^WhiteBox$/i },
    });

    if (!company) {
      console.log("📝 Creating WhiteBox company...");

      // Create the company
      company = await Company.create({
        company_name: "WhiteBox",
        company_domain: "whiteboxtech.net",
        contact_person_name: "Awais Chaudhry",
        contact_email: "info@whiteboxtech.net",
        contact_phone: "03004949543",
        subscription_tier: "basic",
        max_employees: 50,
        status: "approved",
        is_active: true,
        approved_at: new Date(),
      });

      console.log(`✅ Company created with ID: ${company._id}\n`);
    } else {
      console.log(`✅ Company already exists with ID: ${company._id}\n`);
    }

    const companyId = company._id;
    let totalUpdated = 0;

    // Step 2: Update all collections
    console.log("🔄 Starting to backfill company_id in all collections...\n");

    // Users
    console.log("📊 Updating Users...");
    const usersUpdate = await User.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(`   ✅ Updated ${usersUpdate.modifiedCount} users`);
    totalUpdated += usersUpdate.modifiedCount;

    // Attendances
    console.log("📊 Updating Attendances...");
    const attendancesUpdate = await Attendance.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(`   ✅ Updated ${attendancesUpdate.modifiedCount} attendances`);
    totalUpdated += attendancesUpdate.modifiedCount;

    // Leaves
    console.log("📊 Updating Leaves...");
    const leavesUpdate = await Leave.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(`   ✅ Updated ${leavesUpdate.modifiedCount} leaves`);
    totalUpdated += leavesUpdate.modifiedCount;

    // LeaveStats
    console.log("📊 Updating LeaveStats...");
    const leaveStatsUpdate = await LeaveStats.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(`   ✅ Updated ${leaveStatsUpdate.modifiedCount} leave stats`);
    totalUpdated += leaveStatsUpdate.modifiedCount;

    // Departments
    console.log("📊 Updating Departments...");
    const departmentsUpdate = await Department.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(`   ✅ Updated ${departmentsUpdate.modifiedCount} departments`);
    totalUpdated += departmentsUpdate.modifiedCount;

    // Teams
    console.log("📊 Updating Teams...");
    const teamsUpdate = await Team.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(`   ✅ Updated ${teamsUpdate.modifiedCount} teams`);
    totalUpdated += teamsUpdate.modifiedCount;

    // Events
    console.log("📊 Updating Events...");
    const eventsUpdate = await Event.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(`   ✅ Updated ${eventsUpdate.modifiedCount} events`);
    totalUpdated += eventsUpdate.modifiedCount;

    // Notifications
    console.log("📊 Updating Notifications...");
    const notificationsUpdate = await Notification.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(
      `   ✅ Updated ${notificationsUpdate.modifiedCount} notifications`
    );
    totalUpdated += notificationsUpdate.modifiedCount;

    // Documents
    console.log("📊 Updating Documents...");
    const documentsUpdate = await Document.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(`   ✅ Updated ${documentsUpdate.modifiedCount} documents`);
    totalUpdated += documentsUpdate.modifiedCount;

    // Suggestions
    console.log("📊 Updating Suggestions...");
    const suggestionsUpdate = await Suggestion.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(`   ✅ Updated ${suggestionsUpdate.modifiedCount} suggestions`);
    totalUpdated += suggestionsUpdate.modifiedCount;

    // Tickets
    console.log("📊 Updating Tickets...");
    const ticketsUpdate = await Ticket.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(`   ✅ Updated ${ticketsUpdate.modifiedCount} tickets`);
    totalUpdated += ticketsUpdate.modifiedCount;

    // Todos
    console.log("📊 Updating Todos...");
    const todosUpdate = await Todo.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(`   ✅ Updated ${todosUpdate.modifiedCount} todos`);
    totalUpdated += todosUpdate.modifiedCount;

    // WorkingHours
    console.log("📊 Updating WorkingHours...");
    const workingHoursUpdate = await WorkingHours.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(
      `   ✅ Updated ${workingHoursUpdate.modifiedCount} working hours`
    );
    totalUpdated += workingHoursUpdate.modifiedCount;

    // WorkingHoursRequests
    console.log("📊 Updating WorkingHoursRequests...");
    const workingHoursRequestsUpdate = await WorkingHoursRequest.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(
      `   ✅ Updated ${workingHoursRequestsUpdate.modifiedCount} working hours requests`
    );
    totalUpdated += workingHoursRequestsUpdate.modifiedCount;

    // RemoteWorkRequests
    console.log("📊 Updating RemoteWorkRequests...");
    const remoteWorkRequestsUpdate = await RemoteWorkRequest.updateMany(
      { company_id: { $exists: false } },
      { $set: { company_id: companyId } }
    );
    console.log(
      `   ✅ Updated ${remoteWorkRequestsUpdate.modifiedCount} remote work requests`
    );
    totalUpdated += remoteWorkRequestsUpdate.modifiedCount;

    // BookMeetingRoom - backfill from user's company_id
    console.log("📊 Updating BookMeetingRoom...");
    const bookingsWithoutCompanyId = await BookMeetingRoom.find({
      $or: [{ company_id: { $exists: false } }, { company_id: null }],
    })
      .populate("user", "company_id")
      .lean();

    let bookingsBackfilled = 0;
    for (const booking of bookingsWithoutCompanyId) {
      let bookingCompanyId = companyId; // Default to WhiteBox

      // Try to get from user
      if (booking.user?.company_id) {
        bookingCompanyId = booking.user.company_id;
      }

      await BookMeetingRoom.updateOne(
        { _id: booking._id },
        { $set: { company_id: bookingCompanyId } }
      );
      bookingsBackfilled++;
    }
    console.log(`   ✅ Updated ${bookingsBackfilled} meeting room bookings`);
    totalUpdated += bookingsBackfilled;

    // Comments - backfill from suggestion's company_id (no populate: ref "Suggestion" vs model "suggestion")
    console.log("📊 Updating Comments...");
    const commentsWithoutCompanyId = await Comment.find({
      $or: [{ company_id: { $exists: false } }, { company_id: null }],
    }).lean();

    let commentsBackfilled = 0;
    for (const comment of commentsWithoutCompanyId) {
      let commentCompanyId = companyId;
      const suggestionId = comment.suggestion?._id ?? comment.suggestion;
      if (suggestionId) {
        const suggestion = await Suggestion.findById(suggestionId)
          .select("company_id")
          .lean();
        if (suggestion?.company_id) commentCompanyId = suggestion.company_id;
      }
      if (commentCompanyId === companyId && comment.created_by) {
        const user = await User.findById(comment.created_by)
          .select("company_id")
          .lean();
        if (user?.company_id) commentCompanyId = user.company_id;
      }
      await Comment.updateOne(
        { _id: comment._id },
        { $set: { company_id: commentCompanyId } }
      );
      commentsBackfilled++;
    }
    console.log(`   ✅ Updated ${commentsBackfilled} comments`);
    totalUpdated += commentsBackfilled;

    // Likes - backfill from suggestion's company_id (no populate: ref "Suggestion" vs model "suggestion")
    console.log("📊 Updating Likes...");
    const likesWithoutCompanyId = await Like.find({
      $or: [{ company_id: { $exists: false } }, { company_id: null }],
    }).lean();

    let likesBackfilled = 0;
    for (const like of likesWithoutCompanyId) {
      let likeCompanyId = companyId;
      const suggestionId = like.suggestion?._id ?? like.suggestion;
      if (suggestionId) {
        const suggestion = await Suggestion.findById(suggestionId)
          .select("company_id")
          .lean();
        if (suggestion?.company_id) likeCompanyId = suggestion.company_id;
      }
      if (likeCompanyId === companyId && like.user) {
        const user = await User.findById(like.user).select("company_id").lean();
        if (user?.company_id) likeCompanyId = user.company_id;
      }
      await Like.updateOne(
        { _id: like._id },
        { $set: { company_id: likeCompanyId } }
      );
      likesBackfilled++;
    }
    console.log(`   ✅ Updated ${likesBackfilled} likes`);
    totalUpdated += likesBackfilled;

    // Logs
    console.log("📊 Updating Logs...");
    const logsUpdate = await Log.updateMany(
      { $or: [{ company_id: { $exists: false } }, { company_id: null }] },
      { $set: { company_id: companyId } }
    );
    console.log(`   ✅ Updated ${logsUpdate.modifiedCount} logs`);
    totalUpdated += logsUpdate.modifiedCount;

    // RecentRequests - backfill from user's company_id
    console.log("📊 Updating RecentRequests...");
    const recentWithoutCompanyId = await RecentRequest.find({
      $or: [{ company_id: { $exists: false } }, { company_id: null }],
    })
      .populate("userId", "company_id")
      .lean();
    let recentBackfilled = 0;
    for (const rec of recentWithoutCompanyId) {
      let recCompanyId = companyId;
      const uid = rec.userId?._id ?? rec.userId;
      if (uid) {
        const user = await User.findById(uid).select("company_id").lean();
        if (user?.company_id) recCompanyId = user.company_id;
      }
      await RecentRequest.updateOne(
        { _id: rec._id },
        { $set: { company_id: recCompanyId } }
      );
      recentBackfilled++;
    }
    console.log(`   ✅ Updated ${recentBackfilled} recent requests`);
    totalUpdated += recentBackfilled;

    // Bugs - backfill from user's company_id
    console.log("📊 Updating Bugs...");
    const bugsWithoutCompanyId = await Bug.find({
      $or: [{ company_id: { $exists: false } }, { company_id: null }],
    })
      .populate("reported_by", "company_id")
      .lean();

    let bugsBackfilled = 0;
    for (const bug of bugsWithoutCompanyId) {
      let bugCompanyId = companyId; // Default to WhiteBox

      // Try to get from user who reported it
      if (bug.reported_by?.company_id) {
        bugCompanyId = bug.reported_by.company_id;
      } else if (bug.reported_by) {
        // Fallback: get directly from user
        const user = await User.findById(bug.reported_by)
          .select("company_id")
          .lean();
        if (user?.company_id) {
          bugCompanyId = user.company_id;
        }
      }

      await Bug.updateOne(
        { _id: bug._id },
        { $set: { company_id: bugCompanyId } }
      );
      bugsBackfilled++;
    }
    console.log(`   ✅ Updated ${bugsBackfilled} bugs`);
    totalUpdated += bugsBackfilled;

    console.log("\n✅ MIGRATION COMPLETED!\n");
    console.log(`📊 Total records updated: ${totalUpdated}`);
    console.log(`🏢 Company ID: ${companyId}`);
    console.log(`🏢 Company Name: WhiteBox\n`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
};

// Run the migration
const runMigration = async () => {
  await connectDB();
  await migrateData();
  console.log("✅ Migration script completed successfully!");
  process.exit(0);
};

// Execute migration
runMigration().catch((error) => {
  console.error("❌ Migration error:", error);
  process.exit(1);
});
