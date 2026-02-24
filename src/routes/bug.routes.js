import express from "express";
import * as BugController from "../controllers/bug.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const BugRouter = express.Router();

BugRouter.post("/bugs/report-bug", authenticateToken, BugController.ReportBug);

BugRouter.get("/bugs", authenticateToken, BugController.GetAllBugs);
BugRouter.patch(
  "/bugs/:id/status",
  authenticateToken,
  BugController.UpdateBugStatus
);
BugRouter.delete("/bugs/:id", authenticateToken, BugController.DeleteBug);

export { BugRouter };
