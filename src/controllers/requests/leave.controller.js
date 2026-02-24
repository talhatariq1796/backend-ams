import * as LeaveService from "../../services/requests/leave.service.js";
import {
  checkUserAuthorization,
  isAdmin,
  isAdminOrTeamLead,
} from "../../utils/getUserRole.util.js";
import { AppResponse } from "../../middlewares/error.middleware.js";
import { createLogsAndNotification } from "../../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../../constants/notificationTypes.js";
import RecentRequests from "../../models/requests/recentRequest.model.js";
import Teams from "../../models/team.model.js";
import Users from "../../models/user.model.js";

export const ApplyLeave = async (req, res) => {
  try {
    const isAdminApplyingForOther =
      req.user.role === "admin" &&
      req.body.user &&
      req.body.user !== req.user._id.toString();

    if (!isAdminApplyingForOther) {
      checkUserAuthorization(req.user);
      req.body.user = req.user._id;
    }

    const leaveApplication = await LeaveService.ApplyLeaveService(
      req.body,
      req.user
    );

    if (leaveApplication) {
      await RecentRequests.create({
        userId: isAdminApplyingForOther ? req.body.user : req.user._id,
        type: "leave",
        referenceId: leaveApplication._id,
        createdAt: new Date(),
        appliedByAdmin: isAdminApplyingForOther ? req.user._id : undefined,
      });

      let notifyAdmins = false;
      let notification_to = null;
      let moreUsers = [];
      let employeeName = "";

      if (!isAdminApplyingForOther) {
        employeeName = `${req.user.first_name} ${req.user.last_name}`;

        if (req.user.role === "employee") {
          const team = await Teams.findById(req.user.team).populate(
            "leads",
            "_id first_name last_name role"
          );

          const leads = (team && team.leads) ? team.leads : [];
          if (leads.length > 0) {
            notification_to = leads[0]._id;
            if (leads.length > 1) {
              moreUsers = leads.slice(1).map((l) => l._id);
            }
            notifyAdmins = true;
          } else {
            notifyAdmins = true;
          }
        } else if (req.user.role === "teamLead") {
          notifyAdmins = true;
        } else if (req.user.role === "admin") {
          notifyAdmins = true;
        }
      } else {
        const targetUser = await Users.findById(req.body.user).populate({
          path: "team",
          populate: { path: "leads", select: "_id first_name last_name role" },
        });

        if (targetUser) {
          employeeName = `${targetUser.first_name} ${targetUser.last_name}`;
          const leads = (targetUser.team && targetUser.team.leads) ? targetUser.team.leads : [];
          if (leads.length > 0) {
            notification_to = leads[0]._id;
            if (leads.length > 1) {
              moreUsers = leads.slice(1).map((l) => l._id);
            }
          }
        }

        notifyAdmins = true;
      }

      const messageForManagers = `has applied for leave`;

      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to,
        moreUsers,
        type: NOTIFICATION_TYPES.LEAVE_REQUEST,
        message: isAdminApplyingForOther
          ? `admin applied leave for ${employeeName || "user"}`
          : messageForManagers,
        adminMessage: messageForManagers,
        notifyAdmins,
        data: {
          leave_id: leaveApplication._id,
          admin_action: isAdminApplyingForOther,
        },
        role: "admin",
      });
    }

    return AppResponse({
      res,
      statusCode: 201,
      message: isAdminApplyingForOther
        ? "Leave applied successfully for user"
        : "Leave application submitted successfully",
      data: leaveApplication,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const UpdateLeaveStatus = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdminOrTeamLead(req.user);
    const { leave_id } = req.params;
    const { status, rejection_reason } = req.body;

    const response = await LeaveService.UpdateLeaveStatusService(
      leave_id,
      status,
      req.user,
      rejection_reason
    );
    if (response) {
      console.log("response", response);
      // Create specific message based on status
      const statusMessage =
        status === "approved"
          ? "approved your leave request."
          : "rejected your leave request.";

      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: response.user._id,
        type: NOTIFICATION_TYPES.LEAVE_REQUEST,
        message: statusMessage,
        notifyAdmins: false,
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: `Leave request ${status} successfully`,
      data: response,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const EditLeave = async (req, res) => {
  try {
    const editedLeave = await LeaveService.EditLeaveService(
      req.params.leave_id,
      req.body,
      req.user
    );

    await createLogsAndNotification({
      notification_by: req.user._id,
      type: NOTIFICATION_TYPES.LEAVE,
      message:
        req.user.role === "admin"
          ? `Admin edited your leave request`
          : `You updated your leave request`,
      notifyUser: req.user.role === "admin" ? editedLeave.user : req.user._id,
      data: {
        leave_id: editedLeave._id,
        ...(req.user.role === "admin" && { admin: req.user._id }),
      },
    });

    return AppResponse({
      res,
      statusCode: 200,
      message: "Leave updated successfully",
      data: editedLeave,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const DeleteLeave = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const { leave_id } = req.params;

    const response = await LeaveService.DeleteLeaveService(req.user, leave_id);

    if (response) {
      await RecentRequests.deleteOne({
        referenceId: leave_id,
        type: "leave",
      });

      await createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.LEAVE_REQUEST,
        message: `deleted the leave request.`,
        notifyAdmins: false,
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Leave request deleted successfully",
      data: response,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetAllLeaveRequests = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const {
      view_scope = "self",
      filter_type,
      start_date,
      end_date,
      status,
      user_id,
      department_id,
      search,
      leave_type,
      page = 1,
      limit = 10,
    } = req.query;

    const response = await LeaveService.GetAllLeaveRequestsService(
      req.user,
      view_scope,
      filter_type,
      start_date,
      end_date,
      status,
      user_id,
      department_id,
      search,
      leave_type,
      page,
      limit
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Leave requests retrieved successfully",
      data: response,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetLeaveStats = async (req, res) => {
  try {
    const { user_id } = req.query;
    const stats = await LeaveService.GetLeaveStatsService(req.user, user_id);
    return AppResponse({
      res,
      statusCode: 200,
      message: "Leave stats fetched successfully",
      data: stats,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};
export const GetAvailableLeaveTypes = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const leaveTypes = await LeaveService.GetAvailableLeaveTypesService(
      req.user
    );
    return AppResponse({
      res,
      statusCode: 200,
      message: "Leave types fetched successfully",
      data: leaveTypes,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetPendingLeaveCount = async (req, res, next) => {
  try {
    const count = await LeaveService.GetPendingLeavesCountService(req.user);
    return AppResponse({
      res,
      message: "Pending leave count fetched successfully",
      data: { count },
      statusCode: 200,
      success: true,
    });
  } catch (error) {
    return next(error);
  }
};
