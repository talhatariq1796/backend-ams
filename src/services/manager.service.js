import Users from "../models/user.model.js";
import Teams from "../models/team.model.js";
import Departments from "../models/department.model.js";
import AppError from "../middlewares/error.middleware.js";
import mongoose from "mongoose";

/**
 * Get all users with role 'manager'
 */
export const GetAllManagersService = async () => {
  const managers = await Users.find({ role: "manager" }).select(
    "_id first_name last_name email employee_id profile_picture",
  );

  if (managers.length === 0) throw new AppError("No managers found", 400);
  return managers;
};

/**
 * Get all teams managed by a specific manager
 * Authorization: Manager can only view their own teams, Admin can view any manager's teams
 */
export const GetManagedTeamsService = async (managerId, requestingUser) => {
  if (!mongoose.Types.ObjectId.isValid(managerId)) {
    throw new AppError("Invalid manager ID", 400);
  }

  // Authorization check: Manager can only view their own, Admin can view anyone
  if (requestingUser.role === "manager" && requestingUser._id.toString() !== managerId) {
    throw new AppError("You can only view your own teams", 403);
  }

  const manager = await Users.findById(managerId);
  if (!manager) throw new AppError("Manager does not exist", 400);

  const teams = await Teams.find({ managers: managerId })
    .populate("department", "name")
    .populate("leads", "first_name last_name _id")
    .populate({
      path: "members",
      select: "first_name last_name _id employee_id is_active",
      match: { is_active: true }
    })
    .populate("managers", "first_name last_name _id email");

  if (teams.length === 0)
    throw new AppError("No teams found for this manager", 404);
  return teams;
};

/**
 * Get team members managed by a manager (across all his managed teams)
 * Authorization: Manager can only view their own team members, Admin can view any manager's members
 * Returns: Only active members (is_active: true)
 */
export const GetManagedTeamMembersService = async (managerId, requestingUser) => {
  if (!mongoose.Types.ObjectId.isValid(managerId)) {
    throw new AppError("Invalid manager ID", 400);
  }

  // Authorization check: Manager can only view their own, Admin can view anyone
  if (requestingUser.role === "manager" && requestingUser._id.toString() !== managerId) {
    throw new AppError("You can only view your own team members", 403);
  }

  const manager = await Users.findById(managerId);
  if (!manager) throw new AppError("Manager does not exist", 400);

  // Find all teams managed by this manager
  const managedTeams = await Teams.find({ managers: managerId }).select("members");

  if (managedTeams.length === 0) {
    throw new AppError("Manager is not managing any team", 404);
  }

  // Collect all unique member IDs
  const memberIds = new Set();
  managedTeams.forEach((team) => {
    team.members.forEach((memberId) => {
      memberIds.add(memberId.toString());
    });
  });

  if (memberIds.size === 0) {
    throw new AppError("No members found in managed teams", 404);
  }

  // Fetch only active member details (exclude the requesting manager)
  const members = await Users.find({
    _id: { $in: Array.from(memberIds), $ne: requestingUser._id },
    is_active: true
  }).select(
    "first_name last_name email employee_id designation profile_picture team employment_status is_active"
  );

  if (members.length === 0) {
    throw new AppError("No active members found in managed teams", 404);
  }

  return members;
};

/**
 * Get all managers for a specific team
 */
export const GetTeamManagersService = async (teamId) => {
  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    throw new AppError("Invalid team ID", 400);
  }

  const team = await Teams.findById(teamId).populate(
    "managers",
    "first_name last_name _id email",
  );

  if (!team) throw new AppError("Team does not exist", 400);

  return team.managers || [];
};

/**
 * Verify if a user is a manager of a team
 */
export const IsManagerOfTeamService = async (userId, teamId) => {
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(teamId)
  ) {
    throw new AppError("Invalid user or team ID", 400);
  }

  const team = await Teams.findById(teamId);
  if (!team) throw new AppError("Team does not exist", 400);

  const isManager = team.managers.some((m) => m.equals(userId));
  return isManager;
};

/**
 * Get all teams where user is either a lead or manager
 */
export const GetTeamsWhereUserIsLeadOrManagerService = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError("Invalid user ID", 400);
  }

  const teams = await Teams.find({
    $or: [{ leads: userId }, { managers: userId }],
  })
    .populate("department", "name")
    .populate("leads", "first_name last_name _id")
    .populate("managers", "first_name last_name _id")
    .populate("members", "first_name last_name _id employee_id");

  return teams;
};

/**
 * Get all member IDs from teams managed by a user (manager or lead)
 * Used for permission checks
 */
export const GetAllManagedMemberIdsService = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError("Invalid user ID", 400);
  }

  // Find all teams where user is lead or manager
  const teams = await Teams.find({
    $or: [{ leads: userId }, { managers: userId }],
  }).select("members");

  if (teams.length === 0) {
    return [];
  }

  // Collect all unique member IDs
  const memberIds = new Set();
  teams.forEach((team) => {
    team.members.forEach((memberId) => {
      memberIds.add(memberId.toString());
    });
  });

  return Array.from(memberIds).map((id) => new mongoose.Types.ObjectId(id));
};
