// REDIS DISABLED - Worker functionality disabled
// import { Worker } from "bullmq";
// import IORedis from "ioredis";
// import User from "../models/user.model.js";
// import Team from "../models/team.model.js";
// import Department from "../models/department.model.js";
// import { SendNotificationService } from "../services/notification.service.js";
// import { CreateLogsService } from "../services/logs.service.js";

// // Use environment variables for Redis connection (Railway compatible)
// const connection = new IORedis({
//   host: process.env.REDIS_HOST || process.env.REDIS_URL?.split("@")[1]?.split(":")[0] || "127.0.0.1",
//   port: process.env.REDIS_PORT || parseInt(process.env.REDIS_URL?.split(":")[2] || "6379"),
//   password: process.env.REDIS_PASSWORD || process.env.REDIS_URL?.split("@")[0]?.split("://")[1] || undefined,
//   maxRetriesPerRequest: null,
//   retryStrategy: (times) => {
//     const delay = Math.min(times * 50, 2000);
//     return delay;
//   },
//   reconnectOnError: (err) => {
//     const targetError = "READONLY";
//     if (err.message.includes(targetError)) {
//       return true; // Reconnect on READONLY error
//     }
//     return false;
//   },
// });

// // Handle connection errors gracefully
// connection.on("error", (err) => {
//   console.error("Redis connection error in worker:", err.message);
//   // Don't crash - worker will retry
// });

// Worker disabled - jobs are processed immediately in trackActionQueue mock
// const worker = new Worker(
//   "track-action",
//   async (job) => {
//     const {
//       notification_by,
//       notification_to,
//       moreUsers = [],
//       notifyAdmins,
//       notifyOthers,
//       notifyTeams = [],
//       notifyDepartments = [],
//       type,
//       message,
//       adminMessage,
//       hideLogsIdentity,
//       hideNotificationIdentity,
//       role,
//       company_id,
//     } = job.data;

//     // Get company_id from job data or from the user
//     let companyId = company_id;
//     if (!companyId && notification_by) {
//       const user = await User.findById(notification_by).select("company_id");
//       if (user?.company_id) {
//         companyId = user.company_id;
//       }
//     }
//     if (!companyId && notification_to) {
//       const user = await User.findById(notification_to).select("company_id");
//       if (user?.company_id) {
//         companyId = user.company_id;
//       }
//     }
//     if (!companyId) {
//       throw new Error("Company ID required for tracking action");
//     }

//     // Collect recipients first
//     const recipients = new Set();

//     // 1. Direct target
//     if (notification_to) recipients.add(String(notification_to));

//     // 2. Specific users
//     moreUsers.forEach((userId) => recipients.add(String(userId)));

//     // 3. Admins
//     if (notifyAdmins) {
//       const admins = await User.find(
//         { company_id: companyId, role: "admin", _id: { $ne: notification_by } },
//         "_id"
//       );
//       admins.forEach((admin) => recipients.add(String(admin._id)));
//     }

//     // 4. All active employees except sender
//     if (notifyOthers) {
//       const employees = await User.find(
//         {
//           company_id: companyId,
//           is_active: true,
//           _id: { $ne: notification_by },
//         },
//         "_id"
//       );
//       employees.forEach((emp) => recipients.add(String(emp._id)));
//     }

//     // 5. Users from teams
//     if (Array.isArray(notifyTeams) && notifyTeams.length > 0) {
//       const teams = await Team.find({
//         company_id: companyId,
//         _id: { $in: notifyTeams },
//       })
//         .select("members")
//         .lean();
//       teams.forEach((team) => {
//         team.members.forEach((id) => recipients.add(String(id)));
//       });
//     }

//     // 6. Users from departments → teams → members
//     if (Array.isArray(notifyDepartments) && notifyDepartments.length > 0) {
//       const departments = await Department.find({
//         company_id: companyId,
//         _id: { $in: notifyDepartments },
//       })
//         .populate({
//           path: "teams",
//           select: "members",
//         })
//         .lean();

//       departments.forEach((dept) => {
//         dept.teams.forEach((team) => {
//           team.members.forEach((id) => recipients.add(String(id)));
//         });
//       });
//     }

//     // ✅ Now send notifications in ONE loop only
//     for (const userId of recipients) {
//       const user = await User.findById(userId).select("role");

//       let msgToSend = message;

//       // 🔧 FIXED: Always give admins the adminMessage if available
//       if (user?.role === "admin" && adminMessage) {
//         msgToSend = adminMessage;
//       }

//       await SendNotificationService({
//         notification_to: userId,
//         notification_by: hideNotificationIdentity ? null : notification_by,
//         type,
//         message: msgToSend,
//         role,
//         companyId,
//       });

//       console.log(
//         `🔔 Notification sent to user ${userId} (${user?.role}) by ${notification_by} [type=${type}]: ${msgToSend}`
//       );
//     }

//     // Create logs (only for primary notification target)
//     // Create a mock req object for CreateLogsService
//     const mockReq = {
//       company_id: companyId,
//       user: {
//         company_id: companyId,
//       },
//     };
//     await CreateLogsService(mockReq, {
//       action_to: hideLogsIdentity ? null : notification_to,
//       action_by: notification_by,
//       type,
//       message,
//       role,
//     });
//   },
//   { connection }
// );

// worker.on("completed", (job) => {
//   console.log(`✅ Job ${job.id} completed`);
// });

// worker.on("failed", (job, err) => {
//   console.error(`❌ Job ${job.id} failed`, err);
// });

console.log("⚠️ Redis is disabled - trackActionWorker not initialized");
