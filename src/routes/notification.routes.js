import express from "express";
import * as NotificationController from "../controllers/notification.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const NotificationRouter = express.Router();

NotificationRouter.get(
  "/user-notifications/",
  authenticateToken,
  requirePermission("view_notifications"),
  NotificationController.GetUserNotifications
);

NotificationRouter.put(
  "/read-all",
  authenticateToken,
  requirePermission("view_notifications"),
  NotificationController.MarkAllNotificationsAsRead
);

NotificationRouter.put(
  "/read-notifications",
  authenticateToken,
  requirePermission("view_notifications"),
  NotificationController.MarkMultipleNotificationsAsRead
);

NotificationRouter.get(
  "/notifications/has-unread",
  authenticateToken,
  requirePermission("view_notifications"),
  NotificationController.HasUnreadNotifications
);

NotificationRouter.post(
  "/notifications/test-all",
  authenticateToken,
  requirePermission("send_test_notification"),
  NotificationController.SendTestNotificationToAllUsers
);

export { NotificationRouter };
