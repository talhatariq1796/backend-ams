import express from "express";
import * as BugController from "../controllers/bug.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const BugRouter = express.Router();

BugRouter.post(
  "/bugs/report-bug",
  authenticateToken,
  requirePermission("report_bug"),
  BugController.ReportBug
);

BugRouter.get(
  "/bugs",
  authenticateToken,
  requirePermission("view_bugs"),
  BugController.GetAllBugs
);
BugRouter.patch(
  "/bugs/:id/status",
  authenticateToken,
  requirePermission("manage_bugs"),
  BugController.UpdateBugStatus
);
BugRouter.delete(
  "/bugs/:id",
  authenticateToken,
  requirePermission("manage_bugs"),
  BugController.DeleteBug
);

export { BugRouter };
