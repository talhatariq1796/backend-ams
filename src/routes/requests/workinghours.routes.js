import express from "express";
import { authenticateToken } from "../../middlewares/user.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import * as WorkingHoursController from "../../controllers/requests/workinghours.controller.js";

const WorkingHoursRequestRouter = express.Router();

WorkingHoursRequestRouter.post(
  "/working-hours/request",
  authenticateToken,
  requirePermission("request_working_hours"),
  WorkingHoursController.CreateRequest
);
WorkingHoursRequestRouter.get(
  "/all-working-hours/request/",
  authenticateToken,
  requirePermission("view_working_hours_requests"),
  WorkingHoursController.GetAllUserRequests
);

WorkingHoursRequestRouter.get(
  "/working-hours/request/user/:userId",
  authenticateToken,
  requirePermission("view_working_hours_requests"),
  WorkingHoursController.GetUserRequestsById
);

WorkingHoursRequestRouter.delete(
  "/working-hours/request/:id",
  authenticateToken,
  requirePermission("view_working_hours_requests"),
  WorkingHoursController.DeleteRequest
);
WorkingHoursRequestRouter.put(
  "/working-hours/request/:id",
  authenticateToken,
  requirePermission("approve_working_hours_requests"),
  WorkingHoursController.UpdateWorkingHoursRequestStatus
);
WorkingHoursRequestRouter.get(
  "/working-hours/pending-count",
  authenticateToken,
  requirePermission("view_working_hours_requests"),
  WorkingHoursController.GetPendingWorkingHoursCount
);
WorkingHoursRequestRouter.patch(
  "/working-hours/request/admin-edit/:id",
  authenticateToken,
  requirePermission("configure_staff_schedules"),
  WorkingHoursController.AdminEditWorkingHoursRequest
);
WorkingHoursRequestRouter.patch(
  "/working-hours/request/user-edit/:id",
  authenticateToken,
  requirePermission("view_working_hours_requests"),
  WorkingHoursController.UserEditWorkingHoursRequest
);
export { WorkingHoursRequestRouter };
