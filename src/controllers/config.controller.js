import * as ConfigService from "../services/config.service.js";
import * as PermissionService from "../services/permission.service.js";
import { isAdmin, checkUserAuthorization } from "../utils/getUserRole.util.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import AppError from "../middlewares/error.middleware.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import { getCompanyId } from "../utils/company.util.js";

export const GetOfficeConfig = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);

    const config = await ConfigService.GetCompanyConfigService(companyId);

    return AppResponse({
      res,
      statusCode: 200,
      message: "Office configuration retrieved successfully",
      data: config,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode,
      message: error.message,
      success: false,
    });
  }
};

export const UpdateOfficeConfig = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const updatedData = req.body;
    if (!updatedData || Object.keys(updatedData).length === 0) {
      throw new AppError("No data provided to update", 400);
    }

    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);

    const updatedConfig = await ConfigService.UpdateCompanyConfigService(
      companyId,
      updatedData
    );

    if (updatedConfig) {
      createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.CONFIG,
        message: `updated office configurations.`,
        notifyAdmins: false,
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Office configuration updated",
      data: updatedConfig,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode,
      message: error.message,
      success: false,
    });
  }
};

export const CreateOfficeConfig = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const configData = req.body;
    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);

    const newConfig = await ConfigService.CreateCompanyConfigService(
      companyId,
      configData
    );

    return AppResponse({
      res,
      statusCode: 201,
      message: "Office configuration created successfully",
      data: newConfig,
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

export const GetAllowedIPs = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);

    const allowedIPs = await ConfigService.GetAllowedIPsService(companyId);

    return AppResponse({
      res,
      statusCode: 200,
      message: "Allowed IPs retrieved successfully",
      data: allowedIPs,
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

export const AddOrUpdateAllowedIP = async (req, res) => {
  try {
    isAdmin(req.user);

    const { name, ip } = req.body;

    if (!name || !ip) {
      throw new AppError("Both name and IP are required", 400);
    }

    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);

    const updated = await ConfigService.AddOrUpdateAllowedIPService(
      companyId,
      name,
      ip
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "IP added/updated successfully",
      data: updated,
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

export const DeleteAllowedIP = async (req, res) => {
  try {
    isAdmin(req.user);
    const { name } = req.params;

    if (!name) {
      throw new AppError("IP name is required for deletion", 400);
    }

    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);

    const updated = await ConfigService.DeleteAllowedIPService(companyId, name);

    return AppResponse({
      res,
      statusCode: 200,
      message: "IP deleted successfully",
      data: updated,
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

export const ToggleIPCheck = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const { enable } = req.body;

    if (typeof enable !== "boolean") {
      throw new AppError(
        "Invalid value for enable. Please use true or false.",
        400
      );
    }

    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);

    const updatedConfig = await ConfigService.UpdateCompanyConfigService(
      companyId,
      {
        enable_ip_check: enable,
      }
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: `IP check ${enable ? "enabled" : "disabled"} successfully`,
      data: updatedConfig,
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

export const GetSignupStatus = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);

    const result = await ConfigService.GetSignupStatusService(companyId);

    return AppResponse({
      res,
      statusCode: 200,
      message: "Signup status retrieved successfully",
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

/**
 * GET /config/role-permissions
 * Get role default permissions for the current company (office config).
 */
export const GetRolePermissions = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);
    const data = await PermissionService.getOfficeRolePermissions(companyId);
    return AppResponse({
      res,
      statusCode: 200,
      message: "Role permissions retrieved successfully",
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

/**
 * PUT /config/role-permissions
 * Update role default permissions in office config. Body: { role_permissions: { employee: [...], admin: [...], ... } }.
 */
export const UpdateRolePermissions = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);
    const { role_permissions } = req.body;
    if (!role_permissions || typeof role_permissions !== "object") {
      throw new AppError("role_permissions object is required", 400);
    }
    const data = await PermissionService.updateOfficeRolePermissions(
      companyId,
      role_permissions,
      req.user._id
    );
    createLogsAndNotification({
      notification_by: req.user._id,
      type: NOTIFICATION_TYPES.CONFIG,
      message: "updated role permissions in office config.",
      company_id: companyId,
    });
    return AppResponse({
      res,
      statusCode: 200,
      message: "Role permissions updated successfully",
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
