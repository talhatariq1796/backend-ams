import * as ManagerService from "../services/manager.service.js";
import { checkUserAuthorization } from "../utils/getUserRole.util.js";
import { AppResponse } from "../middlewares/error.middleware.js";

/**
 * GET /managers
 * Get all users with manager role
 */
export const GetAllManagers = async (req, res) => {
  try {
    const managers = await ManagerService.GetAllManagersService();
    return AppResponse({
      res,
      statusCode: 200,
      message: "Managers fetched successfully",
      data: managers,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

/**
 * GET /managers/:managerId/teams
 * Get all teams managed by a specific manager
 * Authorization: Manager can view their own teams, Admin can view any manager's teams
 */
export const GetManagedTeams = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const { managerId } = req.params;
    const teams = await ManagerService.GetManagedTeamsService(
      managerId,
      req.user
    );
    return AppResponse({
      res,
      statusCode: 200,
      message: "Managed teams fetched successfully",
      data: teams,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

/**
 * GET /managers/:managerId/team-members
 * Get all team members managed by a specific manager
 * Authorization: Manager can view their own members, Admin can view any manager's members
 * Returns: Only active members (is_active: true)
 */
export const GetManagedTeamMembers = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const { managerId } = req.params;
    const members = await ManagerService.GetManagedTeamMembersService(
      managerId,
      req.user
    );
    return AppResponse({
      res,
      statusCode: 200,
      message: "Managed team members fetched successfully",
      data: members,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

/**
 * GET /teams/:teamId/managers
 * Get all managers for a specific team
 */
export const GetTeamManagers = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const { teamId } = req.params;
    const managers = await ManagerService.GetTeamManagersService(teamId);
    return AppResponse({
      res,
      statusCode: 200,
      message: "Team managers fetched successfully",
      data: managers,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

/**
 * GET /my-teams
 * Get all teams where logged-in user is a lead or manager
 */
export const GetMyTeams = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const userRole = req.user.role;

    if (!["teamLead", "manager"].includes(userRole)) {
      return AppResponse({
        res,
        statusCode: 403,
        message: "Only team leads and managers can access this endpoint",
        success: false,
      });
    }

    const teams = await ManagerService.GetTeamsWhereUserIsLeadOrManagerService(
      req.user._id,
    );
    return AppResponse({
      res,
      statusCode: 200,
      message: "Your teams fetched successfully",
      data: teams,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

/**
 * GET /my-team-members
 * Get all team members managed by logged-in manager/team lead
 */
export const GetMyTeamMembers = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const userRole = req.user.role;

    if (!["teamLead", "manager"].includes(userRole)) {
      return AppResponse({
        res,
        statusCode: 403,
        message: "Only team leads and managers can access this endpoint",
        success: false,
      });
    }

    const members = await ManagerService.GetManagedTeamMembersService(
      req.user._id,
    );
    return AppResponse({
      res,
      statusCode: 200,
      message: "Your team members fetched successfully",
      data: members,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};
