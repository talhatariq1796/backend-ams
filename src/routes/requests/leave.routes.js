import express from "express";
import * as LeaveController from "../../controllers/requests/leave.controller.js";
import { authenticateToken } from "../../middlewares/user.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";

const LeaveRouter = express.Router();

LeaveRouter.post(
  "/leave/apply",
  authenticateToken,
  requirePermission("apply_for_leave"),
  LeaveController.ApplyLeave
);
LeaveRouter.put(
  "/leave/:leave_id/status",
  authenticateToken,
  requirePermission("can_approve_leave_requests"),
  LeaveController.UpdateLeaveStatus
);
LeaveRouter.put(
  "/leave/edit_leave/:leave_id",
  authenticateToken,
  requirePermission("cancel_leave_update_leave_request"),
  LeaveController.EditLeave
);
LeaveRouter.delete(
  "/leave/:leave_id",
  authenticateToken,
  requirePermission("cancel_leave_update_leave_request"),
  LeaveController.DeleteLeave
);
LeaveRouter.get(
  "/leaves/requests",
  authenticateToken,
  requirePermission("view_leave_requests"),
  LeaveController.GetAllLeaveRequests
);
LeaveRouter.get(
  "/leaves/stats",
  authenticateToken,
  requirePermission("view_leave_balance"),
  LeaveController.GetLeaveStats
);
LeaveRouter.get(
  "/leaves/types",
  authenticateToken,
  requirePermission("apply_for_leave"),
  LeaveController.GetAvailableLeaveTypes
);
LeaveRouter.get(
  "/leaves/pending-count",
  authenticateToken,
  requirePermission("view_leave_requests"),
  LeaveController.GetPendingLeaveCount
);

export { LeaveRouter };
