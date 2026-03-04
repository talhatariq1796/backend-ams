import express from "express";
import * as ConfigController from "../controllers/config.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const ConfigRouter = express.Router();

ConfigRouter.get(
  "/get-config",
  authenticateToken,
  ConfigController.GetOfficeConfig
);

ConfigRouter.put(
  "/update-config",
  authenticateToken,
  requirePermission("manage_office_config"),
  ConfigController.UpdateOfficeConfig
);

ConfigRouter.post(
  "/create-config",
  authenticateToken,
  requirePermission("manage_office_config"),
  ConfigController.CreateOfficeConfig
);

ConfigRouter.get(
  "/allowed-ips",
  authenticateToken,
  ConfigController.GetAllowedIPs
);

ConfigRouter.post(
  "/allowed-ips",
  authenticateToken,
  requirePermission("manage_office_config"),
  ConfigController.AddOrUpdateAllowedIP
);

ConfigRouter.delete(
  "/allowed-ips/:name",
  authenticateToken,
  requirePermission("manage_office_config"),
  ConfigController.DeleteAllowedIP
);
ConfigRouter.put(
  "/toggle-ip-check",
  authenticateToken,
  requirePermission("manage_office_config"),
  ConfigController.ToggleIPCheck
);
ConfigRouter.get("/signup-status", ConfigController.GetSignupStatus);

ConfigRouter.get(
  "/config/role-permissions",
  authenticateToken,
  requirePermission("manage_roles"),
  ConfigController.GetRolePermissions
);
ConfigRouter.put(
  "/config/role-permissions",
  authenticateToken,
  requirePermission("manage_roles"),
  ConfigController.UpdateRolePermissions
);

export { ConfigRouter };
