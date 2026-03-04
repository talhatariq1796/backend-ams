import express from "express";
import * as LogsController from "../controllers/logs.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const LogsRouter = express.Router();

LogsRouter.get(
  "/logs",
  authenticateToken,
  requirePermission("view_audit_trail"),
  LogsController.GetLogs
);

export { LogsRouter };
