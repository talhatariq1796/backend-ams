import express from "express";
import * as ManagerController from "../controllers/manager.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const ManagerRouter = express.Router();

// Get all managers
ManagerRouter.get(
  "/managers",
  authenticateToken,
  ManagerController.GetAllManagers,
);

// Get all teams managed by a specific manager
ManagerRouter.get(
  "/managers/:managerId/teams",
  authenticateToken,
  ManagerController.GetManagedTeams,
);

// Get all team members managed by a specific manager
ManagerRouter.get(
  "/managers/:managerId/team-members",
  authenticateToken,
  ManagerController.GetManagedTeamMembers,
);

// Get all managers for a specific team
ManagerRouter.get(
  "/teams/:teamId/managers",
  authenticateToken,
  ManagerController.GetTeamManagers,
);

// Get all teams where logged-in user is a lead or manager
ManagerRouter.get("/my-teams", authenticateToken, ManagerController.GetMyTeams);

// Get all team members managed by logged-in manager/team lead
ManagerRouter.get(
  "/my-team-members",
  authenticateToken,
  ManagerController.GetMyTeamMembers,
);

export default ManagerRouter;
