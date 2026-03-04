import express from "express";
import { getRecentRequestsController } from "../../controllers/requests/recentRequest.controller.js";
import { authenticateToken } from "../../middlewares/user.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";

const recentRequestRouter = express.Router();

recentRequestRouter.get(
  "/recent-requests",
  authenticateToken,
  requirePermission("view_recent_requests"),
  getRecentRequestsController
);

export { recentRequestRouter };
