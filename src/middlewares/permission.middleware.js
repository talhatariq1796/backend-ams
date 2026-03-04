import * as PermissionService from "../services/permission.service.js";
import { getCompanyId } from "../utils/company.util.js";

/**
 * Middleware: require that the authenticated user has the given permission.
 * Super admins bypass the check. Use after authenticateToken.
 *
 * @param {string} permissionKey - Permission key (e.g. 'manage_office_config', 'can_edit_all_attendance')
 */
export const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (req.user.is_super_admin === true || req.user.role === "super_admin") {
        return next();
      }
      const companyId = getCompanyId(req) || req.user.company_id;
      if (!companyId) {
        return res.status(403).json({ message: "Company context required" });
      }
      const hasIt = await PermissionService.hasPermission(
        req.user,
        permissionKey,
        companyId
      );
      if (!hasIt) {
        return res.status(403).json({
          message: "You do not have permission to perform this action",
          requiredPermission: permissionKey,
        });
      }
      next();
    } catch (err) {
      return res.status(500).json({ message: err.message || "Permission check failed" });
    }
  };
};

/**
 * Middleware: require that the user has at least one of the given permissions.
 * Super admins bypass. Use for actions allowed by multiple roles (e.g. manage_departments OR manage_own_department).
 *
 * @param {string[]} permissionKeys - Array of permission keys
 */
export const requireAnyPermission = (permissionKeys) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (req.user.is_super_admin === true || req.user.role === "super_admin") {
        return next();
      }
      const companyId = getCompanyId(req) || req.user.company_id;
      if (!companyId) {
        return res.status(403).json({ message: "Company context required" });
      }
      for (const key of permissionKeys) {
        const hasIt = await PermissionService.hasPermission(
          req.user,
          key,
          companyId
        );
        if (hasIt) return next();
      }
      return res.status(403).json({
        message: "You do not have permission to perform this action",
        requiredPermission: permissionKeys,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message || "Permission check failed" });
    }
  };
};
