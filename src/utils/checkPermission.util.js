/**
 * Central permission check utility for the full permission flow.
 * Use this before performing any action: attendance, leave, remote work, config, etc.
 *
 * - In routes: use requirePermission(permissionKey) middleware from permission.middleware.js
 * - In controllers/services: use checkPermission(req, permissionKey) when permission depends on body/params
 */

import * as PermissionService from "../services/permission.service.js";
import { getCompanyId } from "./company.util.js";
import AppError from "../middlewares/error.middleware.js";

/**
 * Check if the current user (from req) has the given permission in their company context.
 * Throws AppError 403 if they don't. Use in controllers or services when you have req.
 * Super admins always pass.
 *
 * @param {object} req - Express request (must have req.user set by authenticateToken)
 * @param {string} permissionKey - Permission key from constants/permissions.js (e.g. 'check_in', 'can_approve_leave_requests')
 * @throws {AppError} 403 when user does not have the permission
 */
export const checkPermission = async (req, permissionKey) => {
  if (!req?.user) {
    throw new AppError("Unauthorized", 401);
  }
  if (req.user.is_super_admin === true || req.user.role === "super_admin") {
    return;
  }
  const companyId = getCompanyId(req) || req.user.company_id;
  if (!companyId) {
    throw new AppError("Company context required", 403);
  }
  const hasIt = await PermissionService.hasPermission(
    req.user,
    permissionKey,
    companyId
  );
  if (!hasIt) {
    throw new AppError(
      "You do not have permission to perform this action",
      403
    );
  }
};

/**
 * Same as checkPermission but returns boolean instead of throwing. Use when you need conditional logic.
 *
 * @param {object} req - Express request with req.user
 * @param {string} permissionKey - Permission key
 * @returns {Promise<boolean>}
 */
export const hasPermissionAsync = async (req, permissionKey) => {
  if (!req?.user) return false;
  if (req.user.is_super_admin === true || req.user.role === "super_admin") {
    return true;
  }
  const companyId = getCompanyId(req) || req.user.company_id;
  if (!companyId) return false;
  return PermissionService.hasPermission(req.user, permissionKey, companyId);
};
