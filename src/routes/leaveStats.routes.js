import express from "express";
import * as LeaveStatsController from "../controllers/leaveStats.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const LeaveStatsRouter = express.Router();

LeaveStatsRouter.get(
  "/leave-stats",
  authenticateToken,
  requirePermission("view_leave_balance"),
  LeaveStatsController.GetUserLeaveStats
);

LeaveStatsRouter.get(
  "/leave-stats/all",
  authenticateToken,
  requirePermission("manage_leave_rules"),
  LeaveStatsController.GetAllLeaveStats
);

LeaveStatsRouter.put(
  "/leave-stats/:user_id",
  authenticateToken,
  requirePermission("manage_leave_rules"),
  LeaveStatsController.UpdateLeaveStats
);

LeaveStatsRouter.post(
  "/leave-stats/sync",
  authenticateToken,
  requirePermission("manage_leave_rules"),
  LeaveStatsController.SyncAllLeaveStats
);

LeaveStatsRouter.patch(
  "/leave-stats/:user_id",
  authenticateToken,
  requirePermission("manage_leave_rules"),
  LeaveStatsController.EditLeaveStats
);

LeaveStatsRouter.patch(
  "/leave-stats",
  authenticateToken,
  requirePermission("manage_leave_rules"),
  LeaveStatsController.EditLeaveStats
);

export { LeaveStatsRouter };
