import { trackActionQueue } from "../jobs/trackActionQueue.js";

export const createLogsAndNotification = async ({
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
}) => {
  const payload = {
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
  };

  await trackActionQueue.add("track-action", payload);
};
