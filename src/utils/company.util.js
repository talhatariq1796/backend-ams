import AppError from "../middlewares/error.middleware.js";

/**
 * Helper function to add company_id filter to any query
 * This ensures tenant isolation in all database queries
 */
export const addCompanyFilter = (query, companyId, allowSuperAdmin = true) => {
  if (!companyId) {
    throw new AppError("Company context is required for this operation", 403);
  }

  return {
    ...query,
    company_id: companyId,
  };
};

/**
 * Helper function to add company_id to new document data
 */
export const addCompanyToData = (data, companyId) => {
  if (!companyId) {
    throw new AppError("Company context is required for this operation", 403);
  }

  return {
    ...data,
    company_id: companyId,
  };
};

/**
 * Helper function to validate that user can only access their company's data
 */
export const validateCompanyAccess = (req, targetCompanyId) => {
  // Super admins can access all companies
  if (req.user?.is_super_admin || req.user?.role === "super_admin") {
    return true;
  }

  // Regular users can only access their own company
  const userCompanyId = req.company_id || req.user?.company_id;

  if (!userCompanyId) {
    throw new AppError("Company context required", 403);
  }

  if (userCompanyId.toString() !== targetCompanyId.toString()) {
    throw new AppError(
      "Unauthorized: Cannot access data from another company",
      403
    );
  }

  return true;
};

/**
 * Get company_id from request (for use in services)
 */
export const getCompanyId = (req) => {
  // Super admins can optionally have company_id for context switching
  // But for regular operations, they don't need it
  if (req.user?.is_super_admin || req.user?.role === "super_admin") {
    // If super admin has company_id, use it; otherwise return null
    return req.company_id || req.user?.company_id || null;
  }

  // For regular users, company_id is required
  const companyId = req.company_id || req.user?.company_id;

  if (!companyId) {
    console.error("⚠️  Missing company_id in request:", {
      hasCompanyId: !!req.company_id,
      hasUserCompanyId: !!req.user?.company_id,
      userId: req.user?._id,
      userRole: req.user?.role,
    });
  }

  return companyId;
};
