import * as NotificationService from "../services/notification.service.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import mongoose from "mongoose";
import AppError from "../middlewares/error.middleware.js";

export const GetUserNotifications = async (req, res) => {
  try {
    const userId = req.user?._id;
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError("Invalid user ID", 400);
    }

    const notifications = await NotificationService.GetUserNotificationsService(
      { userId, page, limit }
    );

    AppResponse({
      res,
      statusCode: 200,
      message: "Notifications retrieved successfully",
      data: notifications,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Something went wrong",
      success: false,
    });
  }
};

export const MarkAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError("Invalid user ID", 400);
    }

    await NotificationService.MarkAllNotificationsAsReadService(userId);

    AppResponse({
      res,
      statusCode: 200,
      message: "All notifications marked as read successfully.",
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Something went wrong",
      success: false,
    });
  }
};

export const MarkMultipleNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { notificationIds } = req.body;

    if (!Array.isArray(notificationIds)) {
      throw new AppError("notificationIds must be an array", 400);
    }

    const result =
      await NotificationService.MarkMultipleNotificationsAsReadService(
        notificationIds,
        userId
      );

    AppResponse({
      res,
      statusCode: 200,
      message: "Notifications marked as read successfully.",
      data: result,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Something went wrong",
      success: false,
    });
  }
};

export const HasUnreadNotifications = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError("Invalid user ID", 400);
    }

    const notifications =
      await NotificationService.HasUnreadNotificationsService(userId);

    AppResponse({
      res,
      statusCode: 200,
      message: "Unread notification status fetched successfully.",
      data: notifications,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Something went wrong",
      success: false,
    });
  }
};

export const SendTestNotificationToAllUsers = async (req, res) => {
  try {
    const result = await NotificationService.SendTestNotificationToAllUsersService();

    AppResponse({
      res,
      statusCode: 200,
      message: result.message || "Test notifications sent successfully",
      data: {
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        totalUsers: result.totalUsers,
      },
      success: result.success,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to send test notifications",
      success: false,
    });
  }
};
