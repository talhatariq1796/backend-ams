import { Worker } from "bullmq";
import IORedis from "ioredis";
import User from "../models/user.model.js";
import Team from "../models/team.model.js";
import Department from "../models/department.model.js";
import { SendNotificationService } from "../services/notification.service.js";
import { CreateLogsService } from "../services/logs.service.js";

const connection = new IORedis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "track-action",
  async (job) => {
    const {
      notification_by,
      notification_to,
      moreUsers = [],
      notifyAdmins,
      notifyOthers,
      notifyTeams = [], // New
      notifyDepartments = [], // New
      type,
      message,
      adminMessage, // 🔧 ADD THIS - was missing!
      hideLogsIdentity,
      hideNotificationIdentity,
      role,
    } = job.data;

    // Collect recipients first
    const recipients = new Set();

    // 1. Direct target
    if (notification_to) recipients.add(String(notification_to));

    // 2. Specific users
    moreUsers.forEach((userId) => recipients.add(String(userId)));

    // 3. Admins
    if (notifyAdmins) {
      const admins = await User.find(
        { role: "admin", _id: { $ne: notification_by } },
        "_id"
      );
      admins.forEach((admin) => recipients.add(String(admin._id)));
    }

    // 4. All active employees except sender
    if (notifyOthers) {
      const employees = await User.find(
        { is_active: true, _id: { $ne: notification_by } },
        "_id"
      );
      employees.forEach((emp) => recipients.add(String(emp._id)));
    }

    // 5. Users from teams
    if (Array.isArray(notifyTeams) && notifyTeams.length > 0) {
      const teams = await Team.find({ _id: { $in: notifyTeams } })
        .select("members")
        .lean();
      teams.forEach((team) => {
        team.members.forEach((id) => recipients.add(String(id)));
      });
    }

    // 6. Users from departments → teams → members
    if (Array.isArray(notifyDepartments) && notifyDepartments.length > 0) {
      const departments = await Department.find({
        _id: { $in: notifyDepartments },
      })
        .populate({
          path: "teams",
          select: "members",
        })
        .lean();

      departments.forEach((dept) => {
        dept.teams.forEach((team) => {
          team.members.forEach((id) => recipients.add(String(id)));
        });
      });
    }

    // ✅ Now send notifications in ONE loop only
    for (const userId of recipients) {
      const user = await User.findById(userId).select("role");

      let msgToSend = message;

      // 🔧 FIXED: Always give admins the adminMessage if available
      if (user?.role === "admin" && adminMessage) {
        msgToSend = adminMessage;
      }

      await SendNotificationService({
        notification_to: userId,
        notification_by: hideNotificationIdentity ? null : notification_by,
        type,
        message: msgToSend,
        role,
        hideNotificationIdentity: hideNotificationIdentity || false,
      });

      console.log(
        `🔔 Notification sent to user ${userId} (${user?.role}) by ${notification_by} [type=${type}]: ${msgToSend}`
      );
    }

    // Create logs (only for primary notification target)
    await CreateLogsService({
      action_to: hideLogsIdentity ? null : notification_to,
      action_by: notification_by,
      type,
      message,
      role,
    });
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed`, err);
});
