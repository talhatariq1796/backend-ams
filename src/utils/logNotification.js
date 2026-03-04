import { trackActionQueue } from "../jobs/trackActionQueue.js";
import User from "../models/user.model.js";
import Team from "../models/team.model.js";
import Department from "../models/department.model.js";
import { SendNotificationService } from "../services/notification.service.js";
import { CreateLogsService } from "../services/logs.service.js";

/**
 * Process notifications immediately (used when Redis/queue is disabled)
 */
const processNotificationsImmediately = async ({
  notification_by,
  notification_to = null,
  moreUsers = [],
  notifyAdmins = false,
  notifyOthers = false,
  notifyDepartments = [],
  notifyTeams = [],
  type,
  message,
  adminMessage,
  hideLogsIdentity = false,
  hideNotificationIdentity = false,
  role,
  company_id,
}) => {
  try {
    // Get company_id if not provided
    let companyId = company_id;
    
    if (!companyId && (notification_by || notification_to)) {
      const getUserCompanyId = async (userId) => {
        if (!userId) return null;
        try {
          const user = await User.findById(userId).select("company_id").lean();
          return user?.company_id || null;
        } catch (err) {
          return null;
        }
      };

      try {
        const promises = [];
        if (notification_by) {
          promises.push(getUserCompanyId(notification_by));
        }
        if (notification_to) {
          promises.push(getUserCompanyId(notification_to));
        }
        
        const results = await Promise.race([
          Promise.all(promises),
          new Promise((resolve) => setTimeout(() => resolve([null, null]), 200)),
        ]);
        
        companyId = Array.isArray(results) ? results.find((id) => id !== null) || null : null;
      } catch (err) {
        companyId = null;
      }
    }

    if (!companyId) {
      console.error("⚠️ Cannot process notifications: company_id is required");
      return;
    }

    // Collect recipients
    const recipients = new Set();

    // 1. Direct target
    if (notification_to) recipients.add(String(notification_to));

    // 2. Specific users
    moreUsers.forEach((userId) => {
      if (userId) recipients.add(String(userId));
    });

    // 3. Admins
    if (notifyAdmins) {
      const admins = await User.find(
        { company_id: companyId, role: "admin", _id: { $ne: notification_by } },
        "_id"
      ).lean();
      admins.forEach((admin) => recipients.add(String(admin._id)));
    }

    // 4. All active employees except sender
    if (notifyOthers) {
      const employees = await User.find(
        {
          company_id: companyId,
          is_active: true,
          _id: { $ne: notification_by },
        },
        "_id"
      ).lean();
      employees.forEach((emp) => recipients.add(String(emp._id)));
    }

    // 5. Users from teams
    if (Array.isArray(notifyTeams) && notifyTeams.length > 0) {
      const teams = await Team.find({
        company_id: companyId,
        _id: { $in: notifyTeams },
      })
        .select("members")
        .lean();
      teams.forEach((team) => {
        if (team.members && Array.isArray(team.members)) {
          team.members.forEach((id) => {
            if (id) recipients.add(String(id));
          });
        }
      });
    }

    // 6. Users from departments → teams → members
    if (Array.isArray(notifyDepartments) && notifyDepartments.length > 0) {
      const departments = await Department.find({
        company_id: companyId,
        _id: { $in: notifyDepartments },
      })
        .populate({
          path: "teams",
          select: "members",
        })
        .lean();

      departments.forEach((dept) => {
        if (dept.teams && Array.isArray(dept.teams)) {
          dept.teams.forEach((team) => {
            if (team.members && Array.isArray(team.members)) {
              team.members.forEach((id) => {
                if (id) recipients.add(String(id));
              });
            }
          });
        }
      });
    }

    // Remove the sender from recipients
    if (notification_by) {
      recipients.delete(String(notification_by));
    }

    // Send notifications to all recipients
    const notificationPromises = [];
    for (const userId of recipients) {
      try {
        const user = await User.findById(userId).select("role").lean();
        let msgToSend = message;

        // Use adminMessage for admins if available
        if (user?.role === "admin" && adminMessage) {
          msgToSend = adminMessage;
        }

        notificationPromises.push(
          SendNotificationService({
            notification_to: userId,
            notification_by: hideNotificationIdentity ? null : notification_by,
            type,
            message: msgToSend,
            role,
            companyId,
          }).catch((err) => {
            console.error(`❌ Failed to send notification to user ${userId}:`, err.message);
          })
        );
      } catch (err) {
        console.error(`❌ Error processing notification for user ${userId}:`, err.message);
      }
    }

    // Wait for all notifications to be sent (but don't block on errors)
    await Promise.allSettled(notificationPromises);

    console.log(
      `✅ Processed ${recipients.size} notifications [type=${type}] by ${notification_by}`
    );

    // Create logs (only for primary notification target)
    try {
      const mockReq = {
        company_id: companyId,
        user: {
          company_id: companyId,
        },
      };
      await CreateLogsService(mockReq, {
        action_to: hideLogsIdentity ? null : notification_to,
        action_by: notification_by,
        type,
        message,
        role,
      });
    } catch (err) {
      console.error("❌ Error creating log:", err.message);
    }
  } catch (err) {
    console.error("❌ Error in processNotificationsImmediately:", err.message);
  }
};

export const createLogsAndNotification = ({
  notification_by,
  notification_to = null,
  moreUsers = [],
  notifyAdmins = false,
  notifyOthers = false,
  notifyDepartments = [],
  notifyTeams = [],
  type,
  message,
  adminMessage,
  hideLogsIdentity = false,
  hideNotificationIdentity = false,
  role,
  company_id, // Accept company_id if provided
}) => {
  // Make this completely fire-and-forget to avoid blocking HTTP responses
  // Run everything in background without blocking the main request
  
  (async () => {
    try {
      // Get company_id if not provided - do this in background
      let companyId = company_id;
      
      if (!companyId && (notification_by || notification_to)) {
        // Try to get company_id quickly, but don't block if it takes too long
        const getUserCompanyId = async (userId) => {
          if (!userId) return null;
          try {
            const user = await User.findById(userId).select("company_id").lean();
            return user?.company_id || null;
          } catch (err) {
            return null;
          }
        };

        // Try to get company_id with a quick timeout
        try {
          const promises = [];
          if (notification_by) {
            promises.push(getUserCompanyId(notification_by));
          }
          if (notification_to) {
            promises.push(getUserCompanyId(notification_to));
          }
          
          const results = await Promise.race([
            Promise.all(promises),
            new Promise((resolve) => setTimeout(() => resolve([null, null]), 200)), // 200ms timeout max
          ]);
          
          companyId = Array.isArray(results) ? results.find((id) => id !== null) || null : null;
        } catch (err) {
          // Continue without company_id - will try to get it in processor
          companyId = null;
        }
      }

      // Since Redis is disabled, process notifications immediately
      await processNotificationsImmediately({
        notification_by,
        notification_to,
        moreUsers,
        notifyAdmins,
        notifyOthers,
        notifyDepartments,
        notifyTeams,
        type,
        message,
        adminMessage,
        hideLogsIdentity,
        hideNotificationIdentity,
        role,
        company_id: companyId,
      });
    } catch (err) {
      // Silently catch all errors - we don't want notification failures to break the API
      console.error("Error in createLogsAndNotification (non-blocking):", err.message);
    }
  })();
  
  // Return immediately without waiting for anything
  return Promise.resolve();
};
