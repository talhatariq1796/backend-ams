import express from "express";
import * as NotificationController from "../controllers/notification.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const NotificationRouter = express.Router();

NotificationRouter.get(
  "/user-notifications/",
  authenticateToken,
  NotificationController.GetUserNotifications
);

NotificationRouter.put(
  "/read-all",
  authenticateToken,
  NotificationController.MarkAllNotificationsAsRead
);

NotificationRouter.put(
  "/read-notifications",
  authenticateToken,
  NotificationController.MarkMultipleNotificationsAsRead
);

NotificationRouter.get(
  "/notifications/has-unread",
  authenticateToken,
  NotificationController.HasUnreadNotifications
);

NotificationRouter.post(
  "/notifications/test-all",
  authenticateToken,
  NotificationController.SendTestNotificationToAllUsers
);

export { NotificationRouter };
