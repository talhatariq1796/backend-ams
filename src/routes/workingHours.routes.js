import express from "express";
import * as WorkingHoursController from "../controllers/workingHours.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const WorkingHoursRouter = express.Router();

WorkingHoursRouter.get(
  "/user-working-hours/:userId",
  authenticateToken,
  requirePermission("view_attendance_status"),
  WorkingHoursController.GetWorkingHoursByUserId
);

WorkingHoursRouter.put(
  "/update-multiple-user-working-hours",
  authenticateToken,
  requirePermission("configure_staff_schedules"),
  WorkingHoursController.UpsertWorkingHoursForMultipleUsers
);

WorkingHoursRouter.put(
  "/user-working-hours/upadte/:userId",
  authenticateToken,
  requirePermission("configure_staff_schedules"),
  WorkingHoursController.UpsertWorkingHours
);
WorkingHoursRouter.put(
  "/reset-working-hours",
  authenticateToken,
  requirePermission("configure_staff_schedules"),
  WorkingHoursController.ResetWorkingHours
);

export { WorkingHoursRouter };
