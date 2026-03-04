import * as PermissionService from "../services/permission.service.js";
import { isAdmin, checkUserAuthorization } from "../utils/getUserRole.util.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import AppError from "../middlewares/error.middleware.js";
import { getCompanyId } from "../utils/company.util.js";

/**
 * GET /permissions/definitions
 * Returns all permission definitions grouped by category (for Role & Permissions UI).
 */
export const getPermissionDefinitions = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const data = PermissionService.getPermissionDefinitions();
    return AppResponse({
      res,
      statusCode: 200,
      message: "Permission definitions retrieved successfully",
      data,
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
