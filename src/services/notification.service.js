import Notification from "../models/notification.model.js";
import mongoose from "mongoose";
import AppError from "../middlewares/error.middleware.js";
import Users from "../models/user.model.js";
import admin from "firebase-admin";
import { NOTIFICATION_TITLES } from "../constants/notificationTypes.js";
import dayjs from "dayjs";

export const SendNotificationService = async ({
  notification_to,
  notification_by,
  type,
  message,
  role,
}) => {
  let notification = await Notification.create({
    notification_to,
    notification_by,
    type,
    message,
    read: false,
    role,
  });
  notification = await notification.populate({
    path: "notification_by",
    select: "first_name last_name profile_picture",
  });

  // SOCKETS NOTIFICATIONS
  if (global.io) {
    if (notification_to) {
      console.log(
        "📢 Emitting notification to socket room:",
        notification_to.toString(),
      );
      global.io
        .to(notification_to.toString())
        .emit("new_notification", notification);
    } else {
      console.warn("⚠️ No 'notification_to' found");
    }
  } else {
    console.warn("⚠️ Socket.io not initialized");
  }

  const senderName = notification.notification_by?.first_name || "Someone";
  const bodyText = `${senderName} ${message}`;
  const titleText = NOTIFICATION_TITLES[type] || "New Notification";

  // Send FCM push notification
  try {
    if (!notification_to) {
      console.warn("⚠️ No notification_to provided, skipping FCM push");
      return notification;
    }

    const user =
      await Users.findById(notification_to).select("fcmToken is_active");

    if (!user) {
      console.warn(`⚠️ User not found: ${notification_to}`);
      return notification;
    }

    if (!user.is_active) {
      console.warn(
        `⚠️ User is inactive, skipping FCM push: ${notification_to}`,
      );
      return notification;
    }

    if (!user.fcmToken) {
      console.warn(`⚠️ No FCM token found for user: ${notification_to}`);
      return notification;
    }

    const messaging = admin.messaging();

    const fcmMessage = {
      token: user.fcmToken,
      notification: {
        title: titleText,
        body: bodyText,
      },
      data: {
        type: type,
        notification_id: notification._id.toString(),
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        title: titleText,
        body: bodyText,
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "high_importance_channel",
          priority: "high",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
        },
        payload: {
          aps: {
            alert: {
              title: titleText,
              body: bodyText,
            },
            sound: "default",
            badge: 1,
            contentAvailable: true,
            mutableContent: true,
          },
        },
      },
      // Web push configuration
      webpush: {
        notification: {
          title: titleText,
          body: bodyText,
          icon: "/icon.png",
        },
      },
    };

    const response = await messaging.send(fcmMessage);
    console.log(
      `✅ FCM push sent successfully to user ${notification_to}:`,
      response,
    );
  } catch (err) {
    console.error(`❌ FCM Error for user ${notification_to}:`, err.message);
    console.error("Full error:", err);
    // Don't throw - notification is already saved in DB
  }

  return notification;
};

export const GetUserNotificationsService = async ({ userId, page, limit }) => {
  const skip = (page - 1) * parseInt(limit);

  const [notifications, total] = await Promise.all([
    Notification.find({ notification_to: userId })
      .populate({
        path: "notification_by",
        select: "_id first_name last_name profile_picture",
      })
      .sort({ read: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Notification.countDocuments({ notification_to: userId }),
  ]);

  // ✅ Format createdAt here
  const formattedNotifications = notifications.map((n) => ({
    ...n,
    createdAt: dayjs(n.createdAt).format("MMM DD, YYYY"), // e.g. "Sep 17, 2025"
  }));

  const totalPages = Math.ceil(total / limit);
  const currentPage = parseInt(page);
  const hasMorePages = totalPages > currentPage;

  return {
    notifications,
    total,
    currentPage,
    totalPages,
    hasMorePages,
  };
};

export const MarkAllNotificationsAsReadService = async (userId) => {
  await Notification.updateMany(
    { notification_to: userId, read: false },
    { $set: { read: true } },
  );
};

export const MarkMultipleNotificationsAsReadService = async (
  notificationIds,
  userId,
) => {
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    throw new AppError("No notification IDs provided", 400);
  }

  const validIds = notificationIds.filter((id) =>
    mongoose.Types.ObjectId.isValid(id),
  );

  if (validIds.length === 0) {
    throw new AppError("No valid notification IDs provided", 400);
  }

  const notifications = await Notification.find({
    _id: { $in: validIds },
  }).select("_id notification_to");

  const unauthorized = notifications.some(
    (n) => n.notification_to.toString() !== userId.toString(),
  );

  if (unauthorized) {
    throw new AppError(
      "Unauthorized: Some notifications don't belong to you",
      403,
    );
  }

  const result = await Notification.updateMany(
    {
      _id: { $in: validIds },
      notification_to: userId,
      read: false,
    },
    { $set: { read: true } },
  );

  return { modifiedCount: result.modifiedCount };
};

export const HasUnreadNotificationsService = async (userId) => {
  const count = await Notification.countDocuments({
    notification_to: userId,
    read: false,
  });

  return {
    hasUnread: count > 0,
    unreadCount: count,
  };
};

/**
 * Test function to send push notification to all users with FCM tokens
 * This is for testing purposes only - does not save to notification logs
 */
export const SendTestNotificationToAllUsersService = async () => {
  try {
    // Get all active users with FCM tokens
    const users = await Users.find({
      is_active: true,
      fcmToken: { $exists: true, $ne: null, $ne: "" },
    }).select("_id fcmToken first_name last_name");

    if (users.length === 0) {
      return {
        success: false,
        message: "No users with FCM tokens found",
        sentCount: 0,
        totalUsers: 0,
      };
    }

    console.log(`📱 Found ${users.length} users with FCM tokens`);

    const messaging = admin.messaging();
    let successCount = 0;
    let failureCount = 0;

    // Send notifications individually to track each user's result
    for (const user of users) {
      try {
        const fcmMessage = {
          token: user.fcmToken,
          notification: {
            title: "Test Notification",
            body: "This is a test notification from the system",
          },
          data: {
            type: "test",
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            title: "Test Notification",
            body: "This is a test notification from the system",
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId: "high_importance_channel",
              priority: "high",
              clickAction: "FLUTTER_NOTIFICATION_CLICK",
            },
          },
          apns: {
            headers: {
              "apns-priority": "10",
              "apns-push-type": "alert",
            },
            payload: {
              aps: {
                alert: {
                  title: "Test Notification",
                  body: "This is a test notification from the system",
                },
                sound: "default",
                badge: 1,
                contentAvailable: true,
                mutableContent: true,
              },
            },
          },
          webpush: {
            notification: {
              title: "Test Notification",
              body: "This is a test notification from the system",
              icon: "/icon.png",
            },
          },
        };

        const response = await messaging.send(fcmMessage);
        successCount++;
        console.log(
          `✅ Test notification sent to user ${user._id} (${user.first_name} ${user.last_name})`,
        );
      } catch (err) {
        failureCount++;
        console.error(
          `❌ Failed to send test notification to user ${user._id}:`,
          err.message,
        );
      }
    }

    console.log(
      `✅ Test notification sent: ${successCount} successful, ${failureCount} failed`,
    );

    return {
      success: true,
      message: `Test notifications sent to ${successCount} users`,
      sentCount: successCount,
      failedCount: failureCount,
      totalUsers: users.length,
    };
  } catch (err) {
    console.error("❌ Error in SendTestNotificationToAllUsersService:", err);
    throw new AppError(
      `Failed to send test notifications: ${err.message}`,
      500,
    );
  }
};
