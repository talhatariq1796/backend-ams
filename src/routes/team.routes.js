import express from "express";
import * as TeamController from "../controllers/team.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const TeamRouter = express.Router();

TeamRouter.post(
  "/team",
  authenticateToken,
  requirePermission("manage_teams"),
  TeamController.CreateTeam,
);

TeamRouter.get(
  "/teams",
  authenticateToken,
  requirePermission("view_teams"),
  TeamController.GetAllTeams,
);

TeamRouter.get(
  "/teams/:teamId",
  authenticateToken,
  requirePermission("view_teams"),
  TeamController.GetTeamById,
);

TeamRouter.get(
  "/teams/:teamId/leads",
  authenticateToken,
  requirePermission("view_teams"),
  // cacheMiddleware("teams_"),
  TeamController.GetTeamLeads,
);

TeamRouter.get(
  "/team-leads",
  authenticateToken,
  requirePermission("view_teams"),
  TeamController.GetAllTeamLeads,
);

TeamRouter.get(
  "/teams/:teamId/members",
  authenticateToken,
  requirePermission("view_team_members"),
  TeamController.GetTeamMembers,
);

TeamRouter.put(
  "/teams/:teamId",
  authenticateToken,
  requirePermission("manage_teams"),
  TeamController.UpdateTeam,
);

TeamRouter.delete(
  "/teams/:teamId",
  authenticateToken,
  requirePermission("manage_teams"),
  TeamController.DeleteTeam,
);

TeamRouter.put(
  "/teams/:teamId/members",
  authenticateToken,
  requirePermission("manage_teams"),
  TeamController.AddMemberToTeam,
);

TeamRouter.delete(
  "/teams/:teamId/members/:memberId",
  authenticateToken,
  requirePermission("manage_teams"),
  TeamController.RemoveMemberFromTeam,
);

export default TeamRouter;
