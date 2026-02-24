import express from "express";
import * as LeaveStatsController from "../controllers/leaveStats.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const LeaveStatsRouter = express.Router();

LeaveStatsRouter.get(
  "/leave-stats",
  authenticateToken,
  LeaveStatsController.GetUserLeaveStats
);

LeaveStatsRouter.get(
  "/leave-stats/all",
  authenticateToken,
  LeaveStatsController.GetAllLeaveStats
);

LeaveStatsRouter.put(
  "/leave-stats/:user_id",
  authenticateToken,
  LeaveStatsController.UpdateLeaveStats
);

LeaveStatsRouter.post(
  "/leave-stats/sync",
  authenticateToken,
  LeaveStatsController.SyncAllLeaveStats
);

LeaveStatsRouter.patch(
  "/leave-stats/:user_id",
  authenticateToken,
  LeaveStatsController.EditLeaveStats
);

LeaveStatsRouter.patch(
  "/leave-stats",
  authenticateToken,
  LeaveStatsController.EditLeaveStats
);

export { LeaveStatsRouter };
