import AppError from "../middlewares/error.middleware.js";
import Companies from "../models/company.model.js";
import Users from "../models/user.model.js";
import CompanyConfigs from "../models/config.model.js";
import Departments from "../models/department.model.js";
import Teams from "../models/team.model.js";
import CompanyRegistrationRequests from "../models/companyRegistrationRequest.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ============= COMPANY REGISTRATION =============

export const RegisterCompanyService = async (registrationData) => {
  try {
    const {
      company_name,
      company_domain,
      contact_person_name,
      contact_email,
      contact_phone,
      industry,
      country_region,
      subscription_tier,
      subscription_billing,
      company_size,
      auto_renewal,
      logo_url,
      admin_user_data,
    } = registrationData;

    // Validate required fields
    if (
      !company_name ||
      !company_domain ||
      !contact_person_name ||
      !contact_email ||
      !contact_phone ||
      !industry ||
      !country_region ||
      !subscription_tier ||
      !subscription_billing ||
      !company_size
    ) {
      throw new AppError("Missing required company information", 400);
    }

    // Check if company name already exists
    const existingCompany = await Companies.findOne({
      company_name: { $regex: new RegExp(`^${company_name}$`, "i") },
    });

    if (existingCompany) {
      throw new AppError("Company name already exists", 409);
    }

    // Check if company domain already exists
    const existingDomain = await Companies.findOne({
      company_domain: company_domain.trim().toLowerCase(),
    });

    if (existingDomain) {
      throw new AppError("Company domain already exists", 409);
    }

    // Check if there's already a pending request with this contact email
    const existingRequest = await CompanyRegistrationRequests.findOne({
      contact_email: { $regex: new RegExp(`^${contact_email}$`, "i") },
      status: "pending",
    });

    if (existingRequest) {
      throw new AppError(
        "A pending registration request already exists for this email",
        409,
      );
    }

    // Validate admin_user_data if provided
    if (admin_user_data && admin_user_data.createAdmin) {
      if (!admin_user_data.email) {
        throw new AppError(
          "admin_user_data.email is required when creating admin account",
          400,
        );
      }

      if (!admin_user_data.password) {
        throw new AppError(
          "admin_user_data.password is required when creating admin account",
          400,
        );
      }

      // Verify email is unique
      const existingUser = await Users.findOne({
        email: { $regex: new RegExp(`^${admin_user_data.email}$`, "i") },
      });

      if (existingUser) {
        throw new AppError("Admin email already registered", 409);
      }
    }

    // Create registration request
    const registrationRequest = await CompanyRegistrationRequests.create({
      company_name: company_name.trim(),
      company_domain: company_domain.trim().toLowerCase(),
      contact_person_name: contact_person_name.trim(),
      contact_email: contact_email.trim().toLowerCase(),
      contact_phone: contact_phone.trim(),
      industry: industry.trim(),
      country_region: country_region.trim(),
      subscription_tier,
      subscription_billing,
      company_size,
      auto_renewal: auto_renewal || false,
      logo_url,
      admin_user_data: admin_user_data || null,
      status: "pending",
    });

    return {
      registration_request: registrationRequest,
      message:
        "Company registration request submitted successfully. Awaiting admin approval.",
    };
  } catch (error) {
    console.error("Error registering company:", error);
    throw error;
  }
};

// ============= REGISTRATION REQUEST MANAGEMENT =============

export const GetPendingRegistrationsService = async (filters = {}) => {
  try {
    const { page = 1, limit = 20, industry, country_region, search } = filters;
    const skip = (page - 1) * limit;

    const query = { status: "pending" };

    // Add filters
    if (industry) query.industry = industry;
    if (country_region) query.country_region = country_region;
    if (search) {
      query.$or = [
        { company_name: { $regex: search, $options: "i" } },
        { contact_email: { $regex: search, $options: "i" } },
        { contact_person_name: { $regex: search, $options: "i" } },
      ];
    }

    const requests = await CompanyRegistrationRequests.find(query)
      .populate("reviewed_by_superadmin", "first_name last_name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await CompanyRegistrationRequests.countDocuments(query);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Error fetching pending registrations:", error);
    throw error;
  }
};

export const ApproveCompanyRegistrationService = async (
  registrationRequestId,
  superAdminId,
) => {
  try {
    const registrationRequest = await CompanyRegistrationRequests.findById(
      registrationRequestId,
    );

    if (!registrationRequest) {
      throw new AppError("Registration request not found", 404);
    }

    if (registrationRequest.status !== "pending") {
      throw new AppError(
        `Registration request is already ${registrationRequest.status}`,
        400,
      );
    }

    // Create company
    const newCompany = await Companies.create({
      company_name: registrationRequest.company_name,
      company_domain: registrationRequest.company_domain,
      contact_person_name: registrationRequest.contact_person_name,
      contact_email: registrationRequest.contact_email,
      contact_phone: registrationRequest.contact_phone,
      industry: registrationRequest.industry,
      country_region: registrationRequest.country_region,
      subscription_tier: registrationRequest.subscription_tier,
      subscription_billing: registrationRequest.subscription_billing,
      company_size: registrationRequest.company_size,
      auto_renewal: registrationRequest.auto_renewal,
      logo_url: registrationRequest.logo_url,
      status: "approved",
      is_active: true,
      approved_by_superadmin: superAdminId,
      approved_at: new Date(),
      current_employees_count: 0,
    });

    // Set subscription dates
    const now = new Date();
    newCompany.subscription_start_date = now;

    const subscriptionDuration = {
      starter: 30, // 30 days
      pro: 365, // 1 year
      enterprise: 365, // 1 year
    };
    const days = subscriptionDuration[newCompany.subscription_tier] || 30;
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days);
    newCompany.subscription_end_date = endDate;

    await newCompany.save();

    // Create admin user if admin_user_data provided with createAdmin flag
    let adminUser = null;
    if (
      registrationRequest.admin_user_data &&
      registrationRequest.admin_user_data.createAdmin &&
      registrationRequest.admin_user_data.email
    ) {
      const {
        email,
        password,
        first_name,
        last_name,
        gender,
        contact_number,
        address,
        city,
        state,
        cnic,
        designation,
        employment_status,
        joining_date,
      } = registrationRequest.admin_user_data;

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create admin user with defaults for optional fields
      adminUser = await Users.create({
        company_id: newCompany._id,
        first_name: first_name || email.split("@")[0],
        last_name: last_name || "",
        email,
        password: hashedPassword,
        gender: gender || "Not Specified",
        contact_number: contact_number || "",
        address: address || "",
        city: city || "",
        state: state || "",
        cnic: cnic || "",
        designation: designation || "Company Admin",
        employment_status: employment_status || "Permanent",
        joining_date: joining_date || new Date(),
        employee_id: "TEMP-ADMIN",
        role: "admin",
        is_super_admin: false,
        is_active: true,
      });

      // Update company with admin user ID
      newCompany.admin_user_id = adminUser._id;
      await newCompany.save();

      // Set employee_id to proper format
      const employeeId = `WB-${adminUser._id.toString().slice(-3)}`;
      adminUser.employee_id = employeeId;
      await adminUser.save();
    }

    // Create default company configuration
    await CompanyConfigs.create({
      company_id: newCompany._id,
      working_hours: {
        checkin_time: new Date("1970-01-01T09:00:00.000Z"),
        checkout_time: new Date("1970-01-01T16:00:00.000Z"), // Updated to 4 PM for Ramadan
      },
      bd_working_hours: {
        checkin_time: new Date("1970-01-01T09:00:00.000Z"),
        checkout_time: new Date("1970-01-01T16:00:00.000Z"), // Updated to 4 PM for Ramadan
      },
      office_location: {
        latitude: 31.5204, // Default (Karachi)
        longitude: 74.3587,
      },
      allowed_ips: new Map(),
      general_leave_types: {
        annual: 10,
        casual: 7,
        demise: 5,
        "hajj/umrah": 5,
        marriage: 5,
        maternity: 90,
        paternity: 5,
        probation: 3,
        sick: 7,
        unpaid: 10,
      },
      business_leave_types: {
        annual: 10,
        casual: 7,
        demise: 5,
        "hajj/umrah": 5,
        marriage: 5,
        maternity: 90,
        paternity: 5,
        probation: 3,
        sick: 7,
        unpaid: 10,
      },
      allowedLeaveForPermanentEmployees: 24,
      allowedLeaveForPermanentBusinessDevelopers: 24,
      allowedLeaveForProbationInternshipEmployees: 3,
      working_days: [1, 2, 3, 4, 5],
    });

    // Update registration request status
    registrationRequest.status = "approved";
    registrationRequest.reviewed_by_superadmin = superAdminId;
    registrationRequest.reviewed_at = new Date();
    registrationRequest.created_company_id = newCompany._id;
    if (adminUser) {
      registrationRequest.created_admin_user_id = adminUser._id;
    }
    await registrationRequest.save();

    return {
      company: newCompany,
      admin_user: adminUser,
      registration_request: registrationRequest,
      message: `Company "${newCompany.company_name}" approved successfully${
        adminUser ? ` with admin user ${adminUser.email}` : ""
      }`,
    };
  } catch (error) {
    console.error("Error approving company registration:", error);
    throw error;
  }
};

export const RejectCompanyRegistrationService = async (
  registrationRequestId,
  superAdminId,
  rejectionReason,
) => {
  try {
    const registrationRequest = await CompanyRegistrationRequests.findById(
      registrationRequestId,
    );

    if (!registrationRequest) {
      throw new AppError("Registration request not found", 404);
    }

    if (registrationRequest.status !== "pending") {
      throw new AppError(
        `Registration request is already ${registrationRequest.status}`,
        400,
      );
    }

    if (!rejectionReason) {
      throw new AppError("Rejection reason is required", 400);
    }

    // Update registration request status
    registrationRequest.status = "rejected";
    registrationRequest.reviewed_by_superadmin = superAdminId;
    registrationRequest.reviewed_at = new Date();
    registrationRequest.rejection_reason = rejectionReason.trim();
    await registrationRequest.save();

    return {
      registration_request: registrationRequest,
      message: `Registration request for "${registrationRequest.company_name}" has been rejected`,
    };
  } catch (error) {
    console.error("Error rejecting company registration:", error);
    throw error;
  }
};

// ============= SUPER ADMIN - COMPANY MANAGEMENT =============

export const GetAllCompaniesService = async (filters = {}) => {
  try {
    const { status, subscription_tier, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;
    if (subscription_tier) query.subscription_tier = subscription_tier;

    const companies = await Companies.find(query)
      .populate("admin_user_id", "first_name last_name email employee_id")
      .populate("created_by_superadmin", "first_name last_name")
      .populate("approved_by_superadmin", "first_name last_name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Companies.countDocuments(query);

    return {
      companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error("Error fetching companies:", error);
    throw error;
  }
};

export const GetCompanyByIdService = async (companyId) => {
  try {
    const company = await Companies.findById(companyId)
      .populate("admin_user_id", "first_name last_name email employee_id role")
      .populate("created_by_superadmin", "first_name last_name")
      .populate("approved_by_superadmin", "first_name last_name")
      .lean();

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    return company;
  } catch (error) {
    console.error("Error fetching company:", error);
    throw error;
  }
};

export const ApproveCompanyService = async (companyId, superAdminId) => {
  try {
    const company = await Companies.findById(companyId);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    if (company.status === "approved") {
      throw new AppError("Company is already approved", 400);
    }

    // Update company status
    company.status = "approved";
    company.approved_by_superadmin = superAdminId;
    company.approved_at = new Date();
    company.is_active = true;

    // Set subscription dates
    const now = new Date();
    company.subscription_start_date = now;

    // Set subscription end date based on tier
    const subscriptionDuration = {
      basic: 30, // 30 days
      premium: 365, // 1 year
      enterprise: 365, // 1 year
    };
    const days = subscriptionDuration[company.subscription_tier] || 30;
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days);
    company.subscription_end_date = endDate;

    await company.save();

    // Create default company configuration
    await CompanyConfigs.create({
      company_id: company._id,
      // Default working hours (can be updated by company admin)
      working_hours: {
        checkin_time: new Date("1970-01-01T09:00:00.000Z"),
        checkout_time: new Date("1970-01-01T18:00:00.000Z"),
      },
      bd_working_hours: {
        checkin_time: new Date("1970-01-01T09:00:00.000Z"),
        checkout_time: new Date("1970-01-01T18:00:00.000Z"),
      },
      office_location: {
        latitude: 31.5204, // Default (Karachi)
        longitude: 74.3587,
      },
      allowed_ips: new Map(),
      general_leave_types: {
        annual: 10,
        casual: 7,
        demise: 5,
        "hajj/umrah": 5,
        marriage: 5,
        maternity: 90,
        paternity: 5,
        probation: 3,
        sick: 7,
        unpaid: 10,
      },
      business_leave_types: {
        annual: 10,
        casual: 7,
        demise: 5,
        "hajj/umrah": 5,
        marriage: 5,
        maternity: 90,
        paternity: 5,
        probation: 3,
        sick: 7,
        unpaid: 10,
      },
      allowedLeaveForPermanentEmployees: 24,
      allowedLeaveForPermanentBusinessDevelopers: 24,
      allowedLeaveForProbationInternshipEmployees: 3,
      working_days: [1, 2, 3, 4, 5],
    });

    // Create default departments and teams
    // You can customize this based on your needs
    // For now, we'll create a single department and team

    return company;
  } catch (error) {
    console.error("Error approving company:", error);
    throw error;
  }
};

export const SuspendCompanyService = async (
  companyId,
  superAdminId,
  reason,
) => {
  try {
    const company = await Companies.findById(companyId);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    if (company.status === "suspended") {
      throw new AppError("Company is already suspended", 400);
    }

    company.status = "suspended";
    company.is_active = false;
    company.notes = reason || company.notes;
    await company.save();

    // Optionally, deactivate all users of this company
    await Users.updateMany({ company_id: companyId }, { is_active: false });

    return company;
  } catch (error) {
    console.error("Error suspending company:", error);
    throw error;
  }
};

export const ActivateCompanyService = async (companyId, superAdminId) => {
  try {
    const company = await Companies.findById(companyId);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    company.status = "approved";
    company.is_active = true;
    await company.save();

    return company;
  } catch (error) {
    console.error("Error activating company:", error);
    throw error;
  }
};

export const UpdateCompanySubscriptionService = async (
  companyId,
  subscriptionData,
) => {
  try {
    const { subscription_tier, company_size, auto_renewal, extension_days } =
      subscriptionData;

    const company = await Companies.findById(companyId);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    if (subscription_tier) {
      company.subscription_tier = subscription_tier;
    }
    if (company_size) {
      company.company_size = company_size;
    }
    if (auto_renewal !== undefined) {
      company.auto_renewal = auto_renewal;
    }
    if (extension_days) {
      const newEndDate = new Date(company.subscription_end_date);
      newEndDate.setDate(newEndDate.getDate() + extension_days);
      company.subscription_end_date = newEndDate;
    }

    await company.save();
    return company;
  } catch (error) {
    console.error("Error updating company subscription:", error);
    throw error;
  }
};

export const GetCompanyStatsService = async (companyId) => {
  try {
    const company = await Companies.findById(companyId);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const totalUsers = await Users.countDocuments({ company_id: companyId });
    const activeUsers = await Users.countDocuments({
      company_id: companyId,
      is_active: true,
    });

    return {
      total_users: totalUsers,
      active_users: activeUsers,
      company_size: company.company_size,
      subscription_tier: company.subscription_tier,
      subscription_end_date: company.subscription_end_date,
      auto_renewal: company.auto_renewal,
    };
  } catch (error) {
    console.error("Error getting company stats:", error);
    throw error;
  }
};
