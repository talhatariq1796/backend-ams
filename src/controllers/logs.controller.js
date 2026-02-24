import * as LogsService from "../services/logs.service.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import AppError from "../middlewares/error.middleware.js";
import { isAdmin, checkUserAuthorization } from "../utils/getUserRole.util.js";

export const GetLogs = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const { page = 1, limit = 10 } = req.query;
    const userId = req.user._id;

    const logs = await LogsService.GetLogsService({
      userId,
      page,
      limit,
    });

    AppResponse({
      res,
      statusCode: 200,
      message: "Logs retrieved successfully",
      data: logs,
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
