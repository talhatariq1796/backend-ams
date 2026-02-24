import express from "express";
import { GetDashboardCounts } from "../../controllers/requests/requestsDashboard.controller.js";
import { authenticateToken } from "../../middlewares/user.middleware.js";

const RequestDashboardRouter = express.Router();
RequestDashboardRouter.get(
  "/request-dashboard-counts",
  authenticateToken,
  GetDashboardCounts
);

export { RequestDashboardRouter };
