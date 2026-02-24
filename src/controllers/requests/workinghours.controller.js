import * as workingHoursService from "../../services/requests/workinghours.service.js";
import {
  isAdmin,
  checkUserAuthorization,
  isAdminOrTeamLead,
} from "../../utils/getUserRole.util.js";
import { AppResponse } from "../../middlewares/error.middleware.js";
import AppError from "../../middlewares/error.middleware.js";
import { createLogsAndNotification } from "../../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../../constants/notificationTypes.js";
import RecentRequests from "../../models/requests/recentRequest.model.js";
import Teams from "../../models/team.model.js";
import Users from "../../models/user.model.js";

export const CreateRequest = async (req, res) => {
  checkUserAuthorization(req.user);
  try {
    const {
      is_week_custom_working_hours,
      checkin_time,
      checkout_time,
      custom_working_hours,
      start_date,
      end_date,
      total_days = 0,
      until_i_change,
    } = req.body;

    if (!start_date) {
      throw new AppError("Start date is required.", 400);
    }

    const start = new Date(start_date);
    const end = end_date ? new Date(end_date) : start;

    if (start > end) {
      throw new AppError("Start date cannot be after end date.", 400);
    }

    if (is_week_custom_working_hours) {
      if (
        !Array.isArray(custom_working_hours) ||
        custom_working_hours.length === 0
      ) {
        throw new AppError("Custom working hours are required.", 400);
      }
    } else {
      if (!checkin_time || !checkout_time) {
        throw new AppError("Check-in and check-out times are required.", 400);
      }
    }

    const existingOverlap = await workingHoursService.checkOverlappingRequest({
      user_id: req.user._id,
      start_date: start,
      end_date: end,
    });

    if (existingOverlap) {
      throw new AppError(
        "You already have a request for this date range.",
        400
      );
    }

    const requestData = {
      user_id: req.user._id,
      is_week_custom_working_hours,
      checkin_time,
      checkout_time,
      custom_working_hours,
      start_date,
      end_date,
      total_days,
      until_i_change,
      expiry_date: !until_i_change ? end_date : null,
    };

    const request = await workingHoursService.createRequest(requestData);

    if (request) {
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
        type: NOTIFICATION_TYPES.WORKING_HOURS_REQUEST,
        message: `applied for working hours request.`,
        notifyAdmins,
        role: "admin",
      });

      await RecentRequests.create({
        userId: req.user._id,
        type: "workingHours",
        referenceId: request._id,
        createdAt: new Date(),
      });
    }

    AppResponse({
      res,
      statusCode: 201,
      message: "Working Hours request created",
      data: request,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Internal server error",
      success: false,
    });
  }
};

export const DeleteRequest = async (req, res) => {
  checkUserAuthorization(req.user);
  try {
    const request = await workingHoursService.deleteRequest(
      req.params.id,
      req.user._id,
      req.user.role
    );

    if (request) {
      await RecentRequests.deleteOne({
        referenceId: req.params.id,
        type: "workingHours",
      });

      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: req.user.role === "admin" ? request.user_id : null,
        type: NOTIFICATION_TYPES.WORKING_HOURS_REQUEST,
        message: `deleted working hours request.`,
        notifyAdmins: false,
      });
    }

    AppResponse({
      res,
      statusCode: 200,
      message: "Request deleted successfully",
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

export const GetUserRequestsById = async (req, res) => {
  checkUserAuthorization(req.user);

  try {
    const { userId } = req.params;
    const {
      filter_type,
      start_date,
      end_date,
      status,
      page = 1,
      limit = 10,
    } = req.query;

    if (!userId) {
      throw new AppError("UserId is required", 400);
    }

    const response = await workingHoursService.getUserRequests(
      userId,
      filter_type,
      start_date,
      end_date,
      status,
      page,
      limit
    );
    AppResponse({
      res,
      statusCode: 200,
      message: "Working hours requests retrieved successfully",
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

export const UpdateWorkingHoursRequestStatus = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdminOrTeamLead(req.user);
    const { status, rejection_reason } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      throw new AppError(
        "Invalid status. Must be 'approved' or 'rejected'",
        400
      );
    }
    if (status === "rejected" && !rejection_reason) {
      throw new AppError(
        "Rejection reason is required when rejecting a request.",
        400
      );
    }

    const { id } = req.params;
    const adminName = req.user.first_name;

    const updatedRequest = await workingHoursService.changeRequestStatus(
      id,
      status,
      adminName,
      rejection_reason
    );
    if (updatedRequest) {
      // Create specific message based on status
      const statusMessage =
        status === "approved"
          ? "approved your working hours request."
          : "rejected your working hours request.";

      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: updatedRequest.user._id,
        type: NOTIFICATION_TYPES.WORKING_HOURS_REQUEST,
        message: statusMessage,
        notifyAdmins: false,
      });
    }
    AppResponse({
      res,
      statusCode: 200,
      message: `Working hours request ${status} successfully`,
      data: updatedRequest,
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

export const GetAllUserRequests = async (req, res) => {
  checkUserAuthorization(req.user);
  try {
    // isAdmin(req.user);

    const {
      view_scope = "self", // Default view_scope to self
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

    const requests = await workingHoursService.GetAllUserRequestsService(
      req.user, // Pass logged-in user info
      view_scope,
      filter_type,
      start_date,
      end_date,
      status,
      user_id,
      department_id,
      search,
      page,
      limit
    );

    AppResponse({
      res,
      statusCode: 200,
      message: "Working Hours request retrieved successfully",
      data: requests,
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

export const GetPendingWorkingHoursCount = async (req, res, next) => {
  try {
    const result = await workingHoursService.GetPendingWorkingHoursCountService(
      req.user
    );

    AppResponse({
      res,
      statusCode: 200,
      message: "Pending working hours count fetched successfully",
      data: { count: result.pending_count },
      success: true,
    });
  } catch (error) {
    next(error);
  }
};

export const AdminEditWorkingHoursRequest = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const { id } = req.params;
    const {
      is_week_custom_working_hours,
      checkin_time,
      checkout_time,
      custom_working_hours,
      status,
      rejection_reason,
      start_date,
      end_date,
      until_i_change,
    } = req.body;

    const expiry_date = !until_i_change ? end_date : null;

    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      throw new AppError("Start date cannot be after end date.", 400);
    }

    if (status && !["pending", "approved", "rejected"].includes(status)) {
      throw new AppError("Invalid status value", 400);
    }

    if (status === "rejected" && !rejection_reason) {
      throw new AppError("Rejection reason is required when rejecting", 400);
    }

    const editData = {
      is_week_custom_working_hours,
      checkin_time,
      checkout_time,
      custom_working_hours,
      status,
      rejection_reason,
      start_date,
      end_date,
      until_i_change,
      expiry_date,
    };

    Object.keys(editData).forEach(
      (key) => editData[key] === undefined && delete editData[key]
    );

    const updatedRequest =
      await workingHoursService.AdminEditWorkingHoursRequest(
        id,
        editData,
        req.user
      );

    await createLogsAndNotification({
      notification_by: req.user._id,
      notification_to: updatedRequest.user._id,
      type: NOTIFICATION_TYPES.WORKING_HOURS_REQUEST,
      message: `admin edited your working hours request`,
      notifyAdmins: false,
    });

    AppResponse({
      res,
      statusCode: 200,
      message: "Working hours request updated successfully",
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

export const UserEditWorkingHoursRequest = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { id } = req.params;
    const {
      is_week_custom_working_hours,
      checkin_time,
      checkout_time,
      custom_working_hours,
      start_date,
      end_date,
      until_i_change,
    } = req.body;

    // Basic validation
    if (!start_date) {
      throw new AppError("Start date is required.", 400);
    }

    const start = new Date(start_date);
    const end = end_date ? new Date(end_date) : start;

    if (start > end) {
      throw new AppError("Start date cannot be after end date.", 400);
    }

    if (is_week_custom_working_hours) {
      if (
        !Array.isArray(custom_working_hours) ||
        custom_working_hours.length === 0
      ) {
        throw new AppError("Custom working hours are required.", 400);
      }
    } else {
      if (!checkin_time || !checkout_time) {
        throw new AppError("Check-in and check-out times are required.", 400);
      }
    }

    const editData = {
      is_week_custom_working_hours,
      checkin_time,
      checkout_time,
      custom_working_hours,
      start_date,
      end_date,
      until_i_change,
      expiry_date: !until_i_change ? end_date : null,
    };

    // Remove undefined values
    Object.keys(editData).forEach(
      (key) => editData[key] === undefined && delete editData[key]
    );

    const updatedRequest =
      await workingHoursService.UserEditWorkingHoursRequest(
        id,
        editData,
        req.user
      );

    // Create notification for admin/team lead(s)
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
        notifyAdmins = true;
      }
    } else if (req.user.role === "teamLead") {
      notifyAdmins = true;
    }

    await createLogsAndNotification({
      notification_by: req.user._id,
      notification_to,
      moreUsers,
      type: NOTIFICATION_TYPES.WORKING_HOURS_REQUEST,
      message: `updated their working hours request`,
      notifyAdmins,
      role: "admin",
    });

    AppResponse({
      res,
      statusCode: 200,
      message: "Working hours request updated successfully",
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
