import express from "express";
import { authenticateToken } from "../../middlewares/user.middleware.js";
import * as WorkingHoursController from "../../controllers/requests/workinghours.controller.js";

const WorkingHoursRequestRouter = express.Router();

WorkingHoursRequestRouter.post(
  "/working-hours/request",
  authenticateToken,
  WorkingHoursController.CreateRequest
);
WorkingHoursRequestRouter.get(
  "/all-working-hours/request/",
  authenticateToken,
  WorkingHoursController.GetAllUserRequests
);

WorkingHoursRequestRouter.get(
  "/working-hours/request/user/:userId",
  authenticateToken,
  WorkingHoursController.GetUserRequestsById
);

WorkingHoursRequestRouter.delete(
  "/working-hours/request/:id",
  authenticateToken,
  WorkingHoursController.DeleteRequest
);
WorkingHoursRequestRouter.put(
  "/working-hours/request/:id",
  authenticateToken,
  WorkingHoursController.UpdateWorkingHoursRequestStatus
);
WorkingHoursRequestRouter.get(
  "/working-hours/pending-count",
  authenticateToken,
  WorkingHoursController.GetPendingWorkingHoursCount
);
WorkingHoursRequestRouter.patch(
  "/working-hours/request/admin-edit/:id",
  authenticateToken,
  WorkingHoursController.AdminEditWorkingHoursRequest
);
WorkingHoursRequestRouter.patch(
  "/working-hours/request/user-edit/:id",
  authenticateToken,
  WorkingHoursController.UserEditWorkingHoursRequest
);
export { WorkingHoursRequestRouter };
