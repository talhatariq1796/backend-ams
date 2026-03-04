import express from "express";
import { GetDashboardCounts } from "../../controllers/requests/requestsDashboard.controller.js";
import { authenticateToken } from "../../middlewares/user.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";

const RequestDashboardRouter = express.Router();
RequestDashboardRouter.get(
  "/request-dashboard-counts",
  authenticateToken,
  requirePermission("view_request_dashboard"),
  GetDashboardCounts
);

export { RequestDashboardRouter };
