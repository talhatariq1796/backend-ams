import express from "express";
import * as WorkingHoursController from "../controllers/workingHours.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const WorkingHoursRouter = express.Router();

WorkingHoursRouter.get(
  "/user-working-hours/:userId",
  authenticateToken,
  WorkingHoursController.GetWorkingHoursByUserId
);

WorkingHoursRouter.put(
  "/update-multiple-user-working-hours",
  authenticateToken,
  WorkingHoursController.UpsertWorkingHoursForMultipleUsers
);

WorkingHoursRouter.put(
  "/user-working-hours/upadte/:userId",
  authenticateToken,
  WorkingHoursController.UpsertWorkingHours
);
WorkingHoursRouter.put(
  "/reset-working-hours",
  authenticateToken,
  WorkingHoursController.ResetWorkingHours
);

export { WorkingHoursRouter };
