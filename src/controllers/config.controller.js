import * as OfficeConfig from "../services/config.service.js";
import { isAdmin, checkUserAuthorization } from "../utils/getUserRole.util.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import AppError from "../middlewares/error.middleware.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";

export const GetOfficeConfig = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const config = await OfficeConfig.GetOfficeConfigService();

    AppResponse({
      res,
      statusCode: 200,
      message: "Office configuration retrieved successfully",
      data: config,
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

export const UpdateOfficeConfig = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const updatedData = req.body;
    if (!updatedData || Object.keys(updatedData).length === 0) {
      throw new AppError("No data provided to update", 400);
    }

    const updatedConfig = await OfficeConfig.UpdateOfficeConfigService(
      updatedData
    );

    if (updatedConfig) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.CONFIG,
        message: `updated office configurations.`,
        notifyAdmins: false,
      });
    }

    AppResponse({
      res,
      statusCode: 200,
      message: "Office configuration updated",
      data: updatedConfig,
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

export const CreateOfficeConfig = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const configData = req.body;
    const newConfig = await OfficeConfig.CreateOfficeConfigService(configData);

    AppResponse({
      res,
      statusCode: 201,
      message: "Office configuration created successfully",
      data: newConfig,
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

export const GetAllowedIPs = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const allowedIPs = await OfficeConfig.GetAllowedIPsService();

    AppResponse({
      res,
      statusCode: 200,
      message: "Allowed IPs retrieved successfully",
      data: allowedIPs,
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

export const AddOrUpdateAllowedIP = async (req, res) => {
  try {
    isAdmin(req.user);

    const { name, ip } = req.body;

    if (!name || !ip) {
      throw new AppError("Both name and IP are required", 400);
    }

    const updated = await OfficeConfig.AddOrUpdateAllowedIPService(name, ip);

    AppResponse({
      res,
      statusCode: 200,
      message: "IP added/updated successfully",
      data: updated,
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

export const DeleteAllowedIP = async (req, res) => {
  try {
    isAdmin(req.user);
    const { name } = req.params;

    if (!name) {
      throw new AppError("IP name is required for deletion", 400);
    }

    const updated = await OfficeConfig.DeleteAllowedIPService(name);

    AppResponse({
      res,
      statusCode: 200,
      message: "IP deleted successfully",
      data: updated,
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

    const updatedConfig = await OfficeConfig.UpdateOfficeConfigService({
      enable_ip_check: enable,
    });

    AppResponse({
      res,
      statusCode: 200,
      message: `IP check ${enable ? "enabled" : "disabled"} successfully`,
      data: updatedConfig,
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

export const GetSignupStatus = async (req, res) => {
  try {
    const result = await OfficeConfig.GetSignupStatusService();

    AppResponse({
      res,
      statusCode: 200,
      message: "Signup status retrieved successfully",
      data: result,
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
