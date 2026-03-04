import WorkingHours from "../models/workingHours.model.js";
import Users from "../models/user.model.js";
import AppError from "../middlewares/error.middleware.js";
import CompanyConfigs from "../models/config.model.js";
import { getCompanyId } from "../utils/company.util.js";

export const UpsertWorkingHoursService = async (req, userId, data) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const workingHours = await WorkingHours.findOneAndUpdate(
    { company_id: companyId, user_id: userId },
    { $set: { ...data, company_id: companyId } },
    { upsert: true, new: true }
  );
  await Users.findOneAndUpdate(
    { _id: userId, company_id: companyId },
    {
      is_default_working_hours: data.is_default_working_hours,
    }
  );
  return workingHours;
};

export const UpsertWorkingHoursForUsersService = async (req, userIds, data) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const results = [];

  for (const userId of userIds) {
    const workingHours = await WorkingHours.findOneAndUpdate(
      { company_id: companyId, user_id: userId },
      { $set: { ...data, company_id: companyId } },
      { upsert: true, new: true }
    ).populate(
      "user_id",
      "_id first_name last_name employee_id team profile_picture"
    );

    await Users.findOneAndUpdate(
      { _id: userId, company_id: companyId },
      {
        is_default_working_hours: data.is_default_working_hours,
      }
    );

    results.push({
      _id: workingHours._id,
      start_date: workingHours.start_date || null,
      end_date: workingHours.end_date || null,
      total_days: workingHours.total_days || null,
      is_week_custom_working_hours: workingHours.is_week_custom_working_hours,
      checkin_time: workingHours.checkin_time,
      checkout_time: workingHours.checkout_time,
      custom_working_hours: workingHours.custom_working_hours,
      status: "approved",
      action_taken_by: "System",
      rejection_reason: null,
      createdAt: workingHours.createdAt,
      updatedAt: workingHours.updatedAt,
      expiry_date: workingHours.expiry_date,
      until_i_change: workingHours.until_i_change,
      user: {
        _id: workingHours.user_id._id,
        first_name: workingHours.user_id.first_name,
        last_name: workingHours.user_id.last_name,
        profile_picture: workingHours.user_id.profile_picture || null,
        employee_id: workingHours.user_id.employee_id || null,
        team_name: workingHours.user_id.team?.name || null,
      },
    });
  }

  return results;
};

export const GetWorkingHoursByUserIdService = async (req, userId) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const user = await Users.findOne({ _id: userId, company_id: companyId });
  if (!user) throw new AppError("User not found", 400);

  const config = await CompanyConfigs.findOne({ company_id: companyId });
  if (!config) throw new AppError("Company configuration not found", 400);

  // Business Developers get bd_working_hours if role includes "business"
  const isBusinessDeveloper = user.role?.toLowerCase().includes("business");

  if (user.is_default_working_hours) {
    if (isBusinessDeveloper) {
      if (!config.bd_working_hours) {
        throw new AppError(
          "Business developer working hours not configured",
          400
        );
      }
      return {
        checkin_time: config.bd_working_hours.checkin_time,
        checkout_time: config.bd_working_hours.checkout_time,
      };
    } else {
      if (!config.working_hours) {
        throw new AppError("Default working hours not configured", 400);
      }
      return {
        checkin_time: config.working_hours.checkin_time,
        checkout_time: config.working_hours.checkout_time,
      };
    }
  }

  const workingHours = await WorkingHours.findOne({
    company_id: companyId,
    user_id: userId,
  });
  if (!workingHours) {
    throw new AppError("Working hours not configured for this user", 404);
  }

  return {
    checkin_time: workingHours.checkin_time,
    checkout_time: workingHours.checkout_time,
    custom_working_hours: workingHours.custom_working_hours,
    is_week_custom_working_hours: workingHours.is_week_custom_working_hours,
  };
};

export const ResetAllWorkingHoursService = async (req) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const deleteResult = await WorkingHours.deleteMany({ company_id: companyId });
  const updateResult = await Users.updateMany(
    { company_id: companyId, role: { $ne: "admin" } },
    { $set: { is_default_working_hours: true } }
  );

  const isDeleteSuccessful = deleteResult.acknowledged === true;
  const isUpdateSuccessful = updateResult.acknowledged === true;

  return isDeleteSuccessful && isUpdateSuccessful;
};
