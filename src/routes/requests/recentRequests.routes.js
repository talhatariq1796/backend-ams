import express from "express";
import { getRecentRequestsController } from "../../controllers/requests/recentRequest.controller.js";
import { authenticateToken } from "../../middlewares/user.middleware.js";

const recentRequestRouter = express.Router();

recentRequestRouter.get(
  "/recent-requests",
  authenticateToken,
  getRecentRequestsController
);

export { recentRequestRouter };
