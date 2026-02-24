import * as RemoteWorkService from "../../services/requests/remotework.service.js";
import Teams from "../../models/team.model.js";
import {
  checkUserAuthorization,
  isAdmin,
  isAdminOrTeamLead,
} from "../../utils/getUserRole.util.js";
import AppError from "../../middlewares/error.middleware.js";
import { AppResponse } from "../../middlewares/error.middleware.js";
import { createLogsAndNotification } from "../../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../../constants/notificationTypes.js";
import RecentRequests from "../../models/requests/recentRequest.model.js";

export const RequestRemoteWork = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    if (!req.body) {
      throw new AppError("Request body is missing.", 400);
    }

    const request = await RemoteWorkService.RequestRemoteWorkService({
      ...req.body,
      user_id: req.user._id,
    });

    if (request) {
      await RecentRequests.create({
        userId: req.user._id,
        type: "remoteWork",
        referenceId: request._id,
        createdAt: new Date(),
      });

      // 🔹 Notification logic
      let notifyAdmins = false;
      let notification_to = null;
      let moreUsers = [];

      if (req.user.role === "employee") {
        const team = await Teams.findById(req.user.team).populate("leads");

        const leads = (team && team.leads) ? team.leads : [];
        if (leads.length > 0) {
          notification_to = leads[0]._id;
          if (leads.length > 1) {
            moreUsers = leads.slice(1).map((l) => l._id);
          }
        }
        notifyAdmins = true;
      } else if (req.user.role === "teamLead") {
        notifyAdmins = true;
      }

      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to,
        moreUsers,
        type: NOTIFICATION_TYPES.REMOTE_WORK_REQUEST,
        message: `applied for remote work request.`,
        notifyAdmins,
        role: "admin",
      });
    }

    AppResponse({
      res,
      statusCode: 201,
      message: "Remote work requests submitted successfully",
      data: request,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetApprovedRemoteWorkByDate = async (req, res) => {
  try {
    const { user_id, date } = req.query;
    if (!user_id || !date) {
      throw new AppError("User ID and date are required.", 400);
    }
    const remoteWork =
      await RemoteWorkService.GetApprovedRemoteWorkByDateService(user_id, date);

    AppResponse({
      res,
      statusCode: 200,
      message: "Approved request retrieved successfully",
      data: remoteWork,
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

export const EditOwnRemoteWorkRequest = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const { request_id } = req.params;
    const updateData = req.body;

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new AppError("At least one field to update is required", 400);
    }

    const updatedRequest =
      await RemoteWorkService.EditOwnRemoteWorkRequestService(
        req.user._id,
        request_id,
        updateData
      );

    await createLogsAndNotification({
      notification_by: req.user._id,
      notification_to: null,
      type: NOTIFICATION_TYPES.REMOTE_WORK_REQUEST,
      message: `edited their own remote work request.`,
      notifyAdmins: false,
    });

    AppResponse({
      res,
      statusCode: 200,
      message: "Remote work request updated successfully",
      data: updatedRequest,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const UpdateRemoteWorkStatus = async (req, res) => {
  try {
    isAdminOrTeamLead(req.user);
    const { request_id } = req.params;
    const { status, rejection_reason } = req.body;
    const adminName = req.user.first_name;

    if (status === "rejected" && !rejection_reason) {
      throw new AppError(
        "Rejection reason is required when rejecting a request.",
        400
      );
    }

    const response = await RemoteWorkService.UpdateRemoteWorkStatusService(
      request_id,
      status,
      adminName,
      rejection_reason
    );

    if (response) {
      // Create specific message based on status
      const statusMessage =
        status === "approved"
          ? "approved your remote work request."
          : "rejected your remote work request.";

      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: response.user._id,
        type: NOTIFICATION_TYPES.REMOTE_WORK_REQUEST,
        message: statusMessage,
        notifyAdmins: false,
      });
    }

    AppResponse({
      res,
      statusCode: 200,
      message: `Remote work request ${status} successfully`,
      data: response,
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

export const DeleteRemoteWorkRequest = async (req, res) => {
  try {
    const { request_id } = req.params;

    const response = await RemoteWorkService.DeleteRemoteWorkRequestService(
      req.user._id,
      request_id,
      req.user.role
    );

    if (response) {
      await RecentRequests.deleteOne({
        referenceId: request_id,
        type: "remoteWork",
      });

      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: req.user.role === "admin" ? response.user_id : null,
        type: NOTIFICATION_TYPES.REMOTE_WORK_REQUEST,
        message: `deleted remote work request.`,
        notifyAdmins: false,
      });
    }
    AppResponse({
      res,
      statusCode: 200,
      message: "Remote work request deleted successfully",
      data: response,
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

export const GetRemoteWorkRequests = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const {
      view_scope = "self",
      filter_type,
      start_date,
      end_date,
      status,
      user_id,
      page = 1,
      limit = 10,
      search = "",
      department_id,
    } = req.query;

    const requests = await RemoteWorkService.GetRemoteWorkRequestsService({
      userInfo: req.user, // Pass user info
      view_scope,
      filter_type,
      start_date,
      end_date,
      status,
      user_id,
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      department_id,
    });

    AppResponse({
      res,
      statusCode: 200,
      message: "Remote work requests retrieved successfully",
      data: requests,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch remote work requests",
      success: false,
    });
  }
};

export const GetPendingRemoteWorkCount = async (req, res, next) => {
  try {
    const result = await RemoteWorkService.GetPendingRemoteWorkCountService(
      req.user
    );

    AppResponse({
      res,
      statusCode: 200,
      message: "Pending remote work count fetched successfully",
      data: result,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

export const AssignRemoteWorkToUsers = async (req, res) => {
  try {
    isAdmin(req.user);

    const { userIds, start_date, end_date, total_days, reason } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new AppError("No users have been selected", 400);
    }

    if (!userIds || !start_date || !end_date || !total_days || !reason) {
      throw new AppError("Missing required fields", 400);
    }

    const admin_name = req.user.first_name + " " + req.user.last_name;

    const result = await RemoteWorkService.AssignRemoteWorkToUsersService(
      userIds,
      {
        start_date,
        end_date,
        total_days,
        reason,
        admin_name,
      }
    );

    const allSkipped = result.every(
      (r) => r.status === "skipped_already_approved"
    );
    const allAssigned = result.every(
      (r) => r.status === "created_and_approved"
    );

    let message = "";
    if (allSkipped) {
      message =
        "All selected users already have approved remote work in this date range";
    } else if (allAssigned) {
      message = "Remote work assigned to all selected users successfully";
    } else {
      message =
        "Remote work assigned to some users; others already had approved requests";
    }

    const createdAny = result.some((r) => r.status === "created_and_approved");
    if (createdAny) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        moreUsers: userIds,
        type: NOTIFICATION_TYPES.REMOTE_WORK_REQUEST,
        message: `assigned remote work.`,
        notifyAdmins: false,
      });
    }

    AppResponse({
      res,
      statusCode: 200,
      message,
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

export const AdminUpdateRemoteWorkRequest = async (req, res) => {
  try {
    isAdmin(req.user);
    const { request_id } = req.params;
    const updateData = req.body;
    const adminName = req.user.first_name;

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new AppError("At least one field to update is required", 400);
    }

    const updatedRequest =
      await RemoteWorkService.AdminUpdateRemoteWorkRequestService(
        request_id,
        updateData,
        adminName
      );

    // Create specific message based on what was updated
    let notificationMessage = "edited your remote work request.";
    if (updateData.status) {
      if (updateData.status === "approved") {
        notificationMessage = "approved your remote work request.";
      } else if (updateData.status === "rejected") {
        notificationMessage = "rejected your remote work request.";
      }
    }

    await createLogsAndNotification({
      notification_by: req.user._id,
      notification_to: updatedRequest.user_id,
      type: NOTIFICATION_TYPES.REMOTE_WORK_REQUEST,
      message: notificationMessage,
      notifyAdmins: false,
    });

    AppResponse({
      res,
      statusCode: 200,
      message: "Remote work request updated successfully",
      data: updatedRequest,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};
