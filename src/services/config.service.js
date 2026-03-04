import CompanyConfigs from "../models/config.model.js";
import AppError from "../middlewares/error.middleware.js";
import { SyncAllLeaveStatsService } from "./leaveStats.service.js";
import { getCompanyId } from "../utils/company.util.js";

export const GetCompanyConfigService = async (companyId) => {
  if (!companyId) {
    throw new AppError("Company ID is required", 400);
  }

  const config = await CompanyConfigs.findOne({ company_id: companyId });
  if (!config) {
    throw new AppError("Company configuration not found", 404);
  }
  return config;
};

export const UpdateCompanyConfigService = async (companyId, updatedData) => {
  if (!companyId) {
    throw new AppError("Company ID is required", 400);
  }

  const config = await CompanyConfigs.findOne({ company_id: companyId });
  if (!config) throw new AppError("Company configuration does not exist", 404);

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

  const updatedConfig = await CompanyConfigs.findOneAndUpdate(
    { company_id: companyId },
    { $set: updatePayload },
    { new: true, runValidators: true }
  );

  // 🔹 Sync leave stats based on what was updated
  if (updatedTypes.length > 0) {
    // Create a mock req object with company_id for SyncAllLeaveStatsService
    const mockReq = {
      company_id: companyId,
      user: {
        company_id: companyId,
      },
    };
    await SyncAllLeaveStatsService(mockReq, null, updatedTypes);
  }

  return updatedConfig;
};

export const CreateCompanyConfigService = async (companyId, configData) => {
  if (!companyId) {
    throw new AppError("Company ID is required", 400);
  }

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

  const existingConfig = await CompanyConfigs.findOne({
    company_id: companyId,
  });
  if (existingConfig) {
    throw new AppError(
      "Company configuration already exists. Try to update instead.",
      400
    );
  }

  const newConfig = new CompanyConfigs({
    ...configData,
    company_id: companyId,
  });
  await newConfig.save();
  return newConfig;
};

export const GetAllowedIPsService = async (companyId) => {
  if (!companyId) {
    throw new AppError("Company ID is required", 400);
  }

  const config = await CompanyConfigs.findOne({ company_id: companyId });
  if (!config) throw new AppError("Company config not found", 404);

  return Object.fromEntries(config.allowed_ips || []);
};

export const AddOrUpdateAllowedIPService = async (companyId, name, ip) => {
  if (!companyId) {
    throw new AppError("Company ID is required", 400);
  }

  const config = await CompanyConfigs.findOne({ company_id: companyId });
  if (!config) throw new AppError("Company config not found", 404);

  if (!config.allowed_ips) {
    config.allowed_ips = new Map();
  }

  config.allowed_ips.set(name, ip);

  await config.save();

  return Object.fromEntries(config.allowed_ips);
};

export const DeleteAllowedIPService = async (companyId, name) => {
  if (!companyId) {
    throw new AppError("Company ID is required", 400);
  }

  const config = await CompanyConfigs.findOne({ company_id: companyId });
  if (!config) throw new AppError("Company config not found", 404);

  if (!config.allowed_ips.has(name)) {
    throw new AppError("IP with this name does not exist", 404);
  }

  config.allowed_ips.delete(name);
  await config.save();
  return Object.fromEntries(config.allowed_ips);
};

export const GetSignupStatusService = async (companyId) => {
  if (!companyId) {
    throw new AppError("Company ID is required", 400);
  }

  const config = await CompanyConfigs.findOne({ company_id: companyId }).select(
    "isSignup"
  );
  if (!config) {
    throw new AppError("Company configuration not found", 404);
  }
  return { isSignup: config.isSignup };
};
