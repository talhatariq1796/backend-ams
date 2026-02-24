import express from "express";
import * as TeamController from "../controllers/team.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
// import { cacheMiddleware } from "../middlewares/cache.middleware.js";

const TeamRouter = express.Router();

TeamRouter.post("/team", authenticateToken, TeamController.CreateTeam);

TeamRouter.get(
  "/teams",
  authenticateToken,
  // cacheMiddleware("teams_"),
  TeamController.GetAllTeams
);

TeamRouter.get(
  "/teams/:teamId",
  authenticateToken,
  // cacheMiddleware("teams_"),
  TeamController.GetTeamById
);

TeamRouter.get(
  "/teams/:teamId/leads",
  authenticateToken,
  // cacheMiddleware("teams_"),
  TeamController.GetTeamLeads
);

TeamRouter.get(
  "/team-leads",
  authenticateToken,
  // cacheMiddleware("teams_"),
  TeamController.GetAllTeamLeads
);

TeamRouter.get(
  "/teams/:teamId/members",
  authenticateToken,
  // cacheMiddleware("teams_"),
  TeamController.GetTeamMembers
);

TeamRouter.put("/teams/:teamId", authenticateToken, TeamController.UpdateTeam);

TeamRouter.delete(
  "/teams/:teamId",
  authenticateToken,
  TeamController.DeleteTeam
);

TeamRouter.put(
  "/teams/:teamId/members",
  authenticateToken,
  TeamController.AddMemberToTeam
);

TeamRouter.delete(
  "/teams/:teamId/members/:memberId",
  authenticateToken,
  TeamController.RemoveMemberFromTeam
);

export default TeamRouter;
