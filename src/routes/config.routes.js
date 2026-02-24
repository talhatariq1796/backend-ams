import express from "express";
import * as ConfigController from "../controllers/config.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const ConfigRouter = express.Router();

ConfigRouter.get(
  "/get-config",
  authenticateToken,
  ConfigController.GetOfficeConfig
);

ConfigRouter.put(
  "/update-config",
  authenticateToken,
  ConfigController.UpdateOfficeConfig
);

ConfigRouter.post(
  "/create-config",
  authenticateToken,
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
  ConfigController.AddOrUpdateAllowedIP
);

ConfigRouter.delete(
  "/allowed-ips/:name",
  authenticateToken,
  ConfigController.DeleteAllowedIP
);
ConfigRouter.put(
  "/toggle-ip-check",
  authenticateToken,
  ConfigController.ToggleIPCheck
);
ConfigRouter.get("/signup-status", ConfigController.GetSignupStatus);

export { ConfigRouter };
