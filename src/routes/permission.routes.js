import express from "express";
import * as PermissionController from "../controllers/permission.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const PermissionRouter = express.Router();

PermissionRouter.get(
  "/permissions/definitions",
  authenticateToken,
  PermissionController.getPermissionDefinitions
);

export { PermissionRouter };
