import OfficeConfig from "../models/config.model.js";
import AppError from "../middlewares/error.middleware.js";
import { SyncAllLeaveStatsService } from "./leaveStats.service.js";

export const GetOfficeConfigService = async () => {
  const config = await OfficeConfig.findOne();
  return config;
};

export const UpdateOfficeConfigService = async (updatedData) => {
  const config = await OfficeConfig.findOne();
  if (!config) throw new AppError("Office configuration does not exist", 404);

  const updatePayload = {};
  const updatedTypes = [];

  for (const key in updatedData) {
    if (
      typeof updatedData[key] === "object" &&
      updatedData[key] !== null &&
      !Array.isArray(updatedData[key])
    ) {
      for (const subKey in updatedData[key]) {
        updatePayload[`${key}.${subKey}`] = updatedData[key][subKey];
      }
      if (key === "general_leave_types") updatedTypes.push("general");
      if (key === "business_leave_types") updatedTypes.push("business");
    } else {
      updatePayload[key] = updatedData[key];
    }
  }

  const updatedConfig = await OfficeConfig.findOneAndUpdate(
    {},
    { $set: updatePayload },
    { new: true, runValidators: true }
  );

  // 🔹 Sync leave stats based on what was updated
  if (updatedTypes.length > 0) {
    await SyncAllLeaveStatsService(null, updatedTypes);
  }

  return updatedConfig;
};

export const CreateOfficeConfigService = async (configData) => {
  if (
    !configData.office_location?.latitude ||
    !configData.office_location?.longitude
  ) {
    throw new AppError("Office location coordinates are required", 400);
  }

  if (
    !configData.working_hours?.checkin_time ||
    !configData.working_hours?.checkout_time
  ) {
    throw new AppError("Working hours are required", 400);
  }

  const existingConfig = await OfficeConfig.findOne();
  if (existingConfig) {
    throw new AppError(
      "Office configuration already exists. Try to update instead.",
      400
    );
  }

  const newConfig = new OfficeConfig(configData);
  await newConfig.save();
  return newConfig;
};

export const GetAllowedIPsService = async () => {
  const config = await OfficeConfig.findOne();
  if (!config) throw new AppError("Office config not found", 404);

  return Object.fromEntries(config.allowed_ips || []);
};

export const AddOrUpdateAllowedIPService = async (name, ip) => {
  const config = await OfficeConfig.findOne();
  if (!config) throw new AppError("Office config not found", 404);

  if (!config.allowed_ips) {
    config.allowed_ips = new Map();
  }

  config.allowed_ips.set(name, ip);

  await config.save();

  return Object.fromEntries(config.allowed_ips);
};

export const DeleteAllowedIPService = async (name) => {
  const config = await OfficeConfig.findOne();
  if (!config) throw new AppError("Office config not found", 404);

  if (!config.allowed_ips.has(name)) {
    throw new AppError("IP with this name does not exist", 404);
  }

  config.allowed_ips.delete(name);
  await config.save();
  return Object.fromEntries(config.allowed_ips);
};

export const GetSignupStatusService = async () => {
  const config = await OfficeConfig.findOne().select("isSignup");
  if (!config) {
    throw new AppError("Office configuration not found", 404);
  }
  return { isSignup: config.isSignup };
};
