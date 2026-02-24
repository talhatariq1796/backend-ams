import * as WorkingHoursService from "../services/workingHours.service.js";
import { checkUserAuthorization, isAdmin } from "../utils/getUserRole.util.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import AppError from "../middlewares/error.middleware.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";

export const UpsertWorkingHours = async (req, res) => {
  try {
    isAdmin(req.user);
    const { userId } = req.params;
    if (!userId) {
      throw new AppError("UserID is required", 400);
    }
    const data = req.body;
    const updatedWorkingHours =
      await WorkingHoursService.UpsertWorkingHoursService(userId, data);

    if (updatedWorkingHours) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: userId,
        type: NOTIFICATION_TYPES.WORKING_HOURS,
        message: `updated working hours`,
        notifyAdmins: false,
      });
    }

    AppResponse({
      res,
      statusCode: 200,
      message: "Office configuration updated successfully",
      data: updatedWorkingHours,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode,
      message: error.message,
      success: false,
    });
  }
};

export const UpsertWorkingHoursForMultipleUsers = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const { userIds, workingHoursData } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new AppError("A list of userIds is required", 400);
    }

    if (!workingHoursData) {
      throw new AppError("Working hours data is required", 400);
    }

    const results = await WorkingHoursService.UpsertWorkingHoursForUsersService(
      userIds,
      workingHoursData
    );

    await createLogsAndNotification({
      notification_by: req.user._id,
      type: NOTIFICATION_TYPES.WORKING_HOURS,
      message: `updated working hours`,
      notifyAdmins: false,
      moreUsers: userIds,
    });

    AppResponse({
      res,
      statusCode: 200,
      message: "Working hours updated successfully for all users",
      data: results,
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

export const GetWorkingHoursByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user?._id;
    const isSelf = requesterId === userId;
    if (!isSelf) isAdmin(req.user);

    const workingHours =
      await WorkingHoursService.GetWorkingHoursByUserIdService(userId);

    AppResponse({
      res,
      statusCode: 200,
      message: `Working hours retrieved successfully`,
      data: workingHours,
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

export const ResetWorkingHours = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const respone = await WorkingHoursService.ResetAllWorkingHoursService();
    if (respone) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.WORKING_HOURS,
        message: `Reset working hours to default.`,
        notifyOthers: true,
        notifyAdmins: false,
      });
    }

    AppResponse({
      res,
      statusCode: 200,
      message: "All working hours reset successfully",
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to reset working hours",
      success: false,
    });
  }
};
