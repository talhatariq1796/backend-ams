import * as CompanyService from "../services/company.service.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import AppError from "../middlewares/error.middleware.js";
import { isAdmin, checkUserAuthorization } from "../utils/getUserRole.util.js";
import { getCompanyEnums } from "../utils/getModelEnums.util.js";
import Company from "../models/company.model.js";
import CompanyRegistrationRequests from "../models/companyRegistrationRequest.model.js";

// ============= PUBLIC - COMPANY REGISTRATION =============

export const GetCompanyEnums = async (req, res) => {
  try {
    const enums = getCompanyEnums(Company, CompanyRegistrationRequests);

    return AppResponse({
      res,
      statusCode: 200,
      message: "Company enums retrieved successfully",
      data: enums,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to retrieve company enums",
      success: false,
    });
  }
};

export const RegisterCompany = async (req, res) => {
  try {
    const registrationData = req.body;

    const result =
      await CompanyService.RegisterCompanyService(registrationData);

    return AppResponse({
      res,
      statusCode: 201,
      message: result.message,
      data: {
        request_id: result.registration_request._id,
        status: result.registration_request.status,
        company_name: result.registration_request.company_name,
        contact_email: result.registration_request.contact_email,
      },
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to register company",
      success: false,
    });
  }
};

// ============= REGISTRATION REQUEST MANAGEMENT =============

export const GetPendingRegistrations = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    // Check if user is super admin
    if (!req.user.is_super_admin && req.user.role !== "super_admin") {
      throw new AppError("Unauthorized: Super admin access required", 403);
    }

    const { page, limit, industry, country_region, search } = req.query;

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      industry,
      country_region,
      search,
    };

    const result = await CompanyService.GetPendingRegistrationsService(filters);

    return AppResponse({
      res,
      statusCode: 200,
      message: "Pending registration requests retrieved successfully",
      data: result,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to retrieve pending registrations",
      success: false,
    });
  }
};

export const ApproveCompanyRegistration = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    if (!req.user.is_super_admin && req.user.role !== "super_admin") {
      throw new AppError("Unauthorized: Super admin access required", 403);
    }

    const { id } = req.params;

    const result = await CompanyService.ApproveCompanyRegistrationService(
      id,
      req.user._id,
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: result.message,
      data: {
        company: result.company,
        admin_user: result.admin_user,
        registration_request: result.registration_request,
      },
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to approve company registration",
      success: false,
    });
  }
};

export const RejectCompanyRegistration = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    if (!req.user.is_super_admin && req.user.role !== "super_admin") {
      throw new AppError("Unauthorized: Super admin access required", 403);
    }

    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new AppError("Rejection reason is required", 400);
    }

    const result = await CompanyService.RejectCompanyRegistrationService(
      id,
      req.user._id,
      reason,
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: result.message,
      data: {
        registration_request: result.registration_request,
      },
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to reject company registration",
      success: false,
    });
  }
};

// ============= SUPER ADMIN - COMPANY MANAGEMENT =============

export const GetAllCompanies = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    // Check if user is super admin
    if (!req.user.is_super_admin && req.user.role !== "super_admin") {
      throw new AppError("Unauthorized: Super admin access required", 403);
    }

    const { status, subscription_tier, page, limit } = req.query;

    const filters = {
      status,
      subscription_tier,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const result = await CompanyService.GetAllCompaniesService(filters);

    return AppResponse({
      res,
      statusCode: 200,
      message: "Companies retrieved successfully",
      data: result,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to retrieve companies",
      success: false,
    });
  }
};

export const GetCompanyById = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    if (!req.user.is_super_admin && req.user.role !== "super_admin") {
      throw new AppError("Unauthorized: Super admin access required", 403);
    }

    const { id } = req.params;
    const company = await CompanyService.GetCompanyByIdService(id);

    return AppResponse({
      res,
      statusCode: 200,
      message: "Company retrieved successfully",
      data: company,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to retrieve company",
      success: false,
    });
  }
};

export const ApproveCompany = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    if (!req.user.is_super_admin && req.user.role !== "super_admin") {
      throw new AppError("Unauthorized: Super admin access required", 403);
    }

    const { id } = req.params;
    const company = await CompanyService.ApproveCompanyService(
      id,
      req.user._id,
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Company approved successfully",
      data: company,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to approve company",
      success: false,
    });
  }
};

export const SuspendCompany = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    if (!req.user.is_super_admin && req.user.role !== "super_admin") {
      throw new AppError("Unauthorized: Super admin access required", 403);
    }

    const { id } = req.params;
    const { reason } = req.body;

    const company = await CompanyService.SuspendCompanyService(
      id,
      req.user._id,
      reason,
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Company suspended successfully",
      data: company,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to suspend company",
      success: false,
    });
  }
};

export const ActivateCompany = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    if (!req.user.is_super_admin && req.user.role !== "super_admin") {
      throw new AppError("Unauthorized: Super admin access required", 403);
    }

    const { id } = req.params;
    const company = await CompanyService.ActivateCompanyService(
      id,
      req.user._id,
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Company activated successfully",
      data: company,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to activate company",
      success: false,
    });
  }
};

export const UpdateCompanySubscription = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    if (!req.user.is_super_admin && req.user.role !== "super_admin") {
      throw new AppError("Unauthorized: Super admin access required", 403);
    }

    const { id } = req.params;
    const subscriptionData = req.body;

    const company = await CompanyService.UpdateCompanySubscriptionService(
      id,
      subscriptionData,
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Company subscription updated successfully",
      data: company,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to update company subscription",
      success: false,
    });
  }
};

export const GetCompanyStats = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    if (!req.user.is_super_admin && req.user.role !== "super_admin") {
      throw new AppError("Unauthorized: Super admin access required", 403);
    }

    const { id } = req.params;
    const stats = await CompanyService.GetCompanyStatsService(id);

    return AppResponse({
      res,
      statusCode: 200,
      message: "Company statistics retrieved successfully",
      data: stats,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to retrieve company statistics",
      success: false,
    });
  }
};
