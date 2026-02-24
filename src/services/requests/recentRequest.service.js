import RequestLog from "../../models/requests/recentRequest.model.js";
import Leave from "../../models/requests/leave.model.js";
import RemoteWork from "../../models/requests/remotework.model.js";
import WorkingHours from "../../models/requests/workinghours.model.js";
import User from "../../models/user.model.js";
import Teams from "../../models/team.model.js";
import AppError from "../../middlewares/error.middleware.js";
import mongoose from "mongoose";

const modelMap = {
  leave: Leave,
  remoteWork: RemoteWork,
  workingHours: WorkingHours,
};
export const getRecentRequestsService = async (userInfo, scope = "self") => {
  let query = {};

  if (userInfo.role === "admin") {
    // Admin gets all recent requests
    query = {};
  } else if (userInfo.role === "manager") {
    // Manager → fetch all teams where this user is a manager
    const teamsManagedByUser = await Teams.find({ managers: userInfo._id }).select(
      "members"
    );

    let teamMemberIds = [];
    teamsManagedByUser.forEach((team) => {
      if (team.members?.length) {
        teamMemberIds.push(
          ...team.members.map((m) => new mongoose.Types.ObjectId(m))
        );
      }
    });

    // Remove duplicates
    teamMemberIds = [...new Set(teamMemberIds.map((id) => id.toString()))].map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    if (scope === "team") {
      // Exclude manager himself
      teamMemberIds = teamMemberIds.filter((id) => !id.equals(userInfo._id));
      if (teamMemberIds.length === 0)
        throw new AppError("No team members found for this manager", 404);
      query = { userId: { $in: teamMemberIds } };
    } else {
      // Self requests
      query = { userId: userInfo._id };
    }
  } else if (userInfo.role === "teamLead") {
    // ✅ Fetch all teams where this user is the lead
    const teamsLedByUser = await Teams.find({ leads: userInfo._id }).select(
      "members"
    );

    let teamMemberIds = [];
    teamsLedByUser.forEach((team) => {
      if (team.members?.length) {
        teamMemberIds.push(
          ...team.members.map((m) => new mongoose.Types.ObjectId(m))
        );
      }
    });

    // Remove duplicates
    teamMemberIds = [...new Set(teamMemberIds.map((id) => id.toString()))].map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    if (scope === "team") {
      // Exclude team lead himself
      teamMemberIds = teamMemberIds.filter((id) => !id.equals(userInfo._id));
      if (teamMemberIds.length === 0)
        throw new AppError("No team members found for this team lead", 404);
      query = { userId: { $in: teamMemberIds } };
    } else {
      // Self requests
      query = { userId: userInfo._id };
    }
  } else {
    // Regular user → only self
    query = { userId: userInfo._id };
  }

  const logs = await RequestLog.find(query)
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  const enriched = await Promise.all(
    logs.map(async (log) => {
      const Model = modelMap[log.type];
      if (!Model) return null;

      const requestData = await Model.findById(log.referenceId).lean();
      if (!requestData) return null;

      const user = await User.findById(log.userId)
        .select(
          "first_name last_name email profile_picture employee_id designation"
        )
        .lean();

      return {
        type: log.type,
        status: requestData.status,
        createdAt: log.createdAt,
        requestId: requestData._id,
        start_date: requestData.start_date,
        end_date: requestData.end_date,
        user: user
          ? {
              _id: user._id,
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email,
              profile_picture: user.profile_picture ?? null,
              employee_id: user.employee_id,
              designation: user.designation ?? null,
            }
          : null,
      };
    })
  );

  return enriched.filter(Boolean);
};
