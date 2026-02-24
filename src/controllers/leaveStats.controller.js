import * as LeaveStatsService from "../services/leaveStats.service.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import { checkUserAuthorization, isAdmin } from "../utils/getUserRole.util.js";

export const GetUserLeaveStats = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const { user_id, year } = req.query;
    const stats = await LeaveStatsService.GetLeaveStatsService(
      req.user,
      user_id,
      year
    );
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

export const GetAllLeaveStats = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const { year, department_id, page = 1, limit = 10 } = req.query;
    const stats = await LeaveStatsService.GetAllLeaveStatsService(
      year,
      department_id,
      parseInt(page),
      parseInt(limit)
    );
    return AppResponse({
      res,
      statusCode: 200,
      message: "All leave stats fetched successfully",
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

export const UpdateLeaveStats = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const { user_id } = req.params;
    const updatedStats = await LeaveStatsService.UpdateLeaveStatsService(
      user_id
    );
    return AppResponse({
      res,
      statusCode: 200,
      message: "Leave stats updated successfully",
      data: updatedStats,
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

export const SyncAllLeaveStats = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const { year } = req.query;
    const result = await LeaveStatsService.SyncAllLeaveStatsService(year);
    return AppResponse({
      res,
      statusCode: 200,
      message: "All leave stats synchronized successfully",
      data: result,
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

export const EditLeaveStats = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const { user_id } = req.params;
    const { year, updates } = req.body;

    if (!updates || typeof updates !== "object") {
      throw new AppError("No updates provided", 400);
    }

    const result = await LeaveStatsService.EditLeaveStatsService(
      user_id,
      year,
      updates
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: user_id
        ? "User leave stats updated successfully"
        : "Company leave configuration updated successfully",
      data: result,
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
