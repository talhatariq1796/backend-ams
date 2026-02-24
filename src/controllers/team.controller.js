import * as TeamService from "../services/team.service.js";
import { checkUserAuthorization } from "../utils/getUserRole.util.js";
import { isAdmin } from "../utils/getUserRole.util.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import redisClient from "../utils/redisClient.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";

export const CreateTeam = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const newTeam = await TeamService.CreateTeamService(req.body);
    if (newTeam) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.TEAM,
        message: `created the team "${newTeam.name}".`,
        notifyAdmins: false,
      });
    }
    await clearTeamCache();
    return AppResponse({
      res,
      statusCode: 201,
      message: "Team created successfully",
      data: newTeam,
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

export const GetAllTeams = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const teams = await TeamService.GetAllTeamsService();
    return AppResponse({
      res,
      statusCode: 200,
      message: "Teams fetched successfully",
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

export const GetTeamById = async (req, res) => {
  const { teamId } = req.params;
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const team = await TeamService.GetTeamByIdService(teamId);
    return AppResponse({
      res,
      statusCode: 200,
      message: "Team fetched successfully",
      data: team,
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

export const GetAllTeamLeads = async (req, res) => {
  try {
    const teamLeads = await TeamService.GetAllTeamLeadsService();
    return AppResponse({
      res,
      statusCode: 200,
      message: "Team leads fetched successfully",
      data: teamLeads,
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

export const GetTeamLeads = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const teamLeads = await TeamService.GetTeamLeadsService(req.params.teamId);
    return AppResponse({
      res,
      statusCode: 200,
      message: "Team leads fetched successfully",
      data: teamLeads,
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

export const UpdateTeam = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const team = await TeamService.UpdateTeamService(
      req?.params?.teamId,
      req.body
    );

    if (team) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.TEAM,
        message: `updated the team "${team.name}".`,
        notifyAdmins: false,
      });
    }
    await clearTeamCache();

    return AppResponse({
      res,
      statusCode: 200,
      message: "Team updated successfully",
      data: team,
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
// fix it
export const GetTeamMembers = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const { teamId } = req.params;
    const { search = "", page = 1, limit = 5 } = req.query;

    const result = await TeamService.GetTeamMembersService({
      teamId,
      search,
      page,
      limit,
      requestingUserId: req.user._id,
      userRole: req.user.role,
    });

    return AppResponse({
      res,
      statusCode: 200,
      message: "Team members retrieved successfully",
      data: result,
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

export const DeleteTeam = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const deletedTeam = await TeamService.DeleteTeamService(
      req?.params?.teamId
    );
    if (deletedTeam) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.TEAM,
        message: `deleted the team "${deletedTeam.name}".`,
        notifyAdmins: false,
      });
    }
    await clearTeamCache();
    return AppResponse({
      res,
      statusCode: 200,
      message: "Team deleted successfully",
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

export const AddMemberToTeam = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const updatedTeam = await TeamService.AddMemberToTeamService(
      req?.params?.teamId,
      req.body.memberId
    );

    if (updatedTeam) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.TEAM,
        message: `added a new member to the team "${updatedTeam.name}".`,
        notifyAdmins: false,
      });
    }
    await clearTeamCache();

    return AppResponse({
      res,
      statusCode: 200,
      message: "Member added to team successfully",
      data: updatedTeam,
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

export const RemoveMemberFromTeam = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const updatedTeam = await TeamService.RemoveMemberFromTeamService(
      req?.params?.teamId,
      req.params.memberId
    );
    if (updatedTeam) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.TEAM,
        message: `removed a member from the team "${updatedTeam.name}".`,
        notifyAdmins: false,
      });
    }
    await clearTeamCache();

    return AppResponse({
      res,
      statusCode: 200,
      message: "Member removed from team successfully",
      data: updatedTeam,
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

export const clearTeamCache = async () => {
  try {
    const keys = await redisClient.keys("teams_*");
    if (keys.length) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error("❌ Error clearing team cache:", error);
  }
};
