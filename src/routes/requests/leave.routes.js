import express from "express";
import * as LeaveController from "../../controllers/requests/leave.controller.js";
import { authenticateToken } from "../../middlewares/user.middleware.js";

const LeaveRouter = express.Router();

LeaveRouter.post("/leave/apply", authenticateToken, LeaveController.ApplyLeave);
LeaveRouter.put(
  "/leave/:leave_id/status",
  authenticateToken,
  LeaveController.UpdateLeaveStatus
);
LeaveRouter.put(
  "/leave/edit_leave/:leave_id",
  authenticateToken,
  LeaveController.EditLeave
);
LeaveRouter.delete(
  "/leave/:leave_id",
  authenticateToken,
  LeaveController.DeleteLeave
);
LeaveRouter.get(
  "/leaves/requests",
  authenticateToken,
  LeaveController.GetAllLeaveRequests
);
LeaveRouter.get(
  "/leaves/stats",
  authenticateToken,
  LeaveController.GetLeaveStats
);
LeaveRouter.get(
  "/leaves/types",
  authenticateToken,
  LeaveController.GetAvailableLeaveTypes
);
LeaveRouter.get(
  "/leaves/pending-count",
  authenticateToken,
  LeaveController.GetPendingLeaveCount
);

export { LeaveRouter };
