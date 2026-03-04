import RequestLog from "../../models/requests/recentRequest.model.js";
import Leave from "../../models/requests/leave.model.js";
import RemoteWork from "../../models/requests/remotework.model.js";
import WorkingHours from "../../models/requests/workinghours.model.js";
import User from "../../models/user.model.js";
import Teams from "../../models/team.model.js";
import AppError from "../../middlewares/error.middleware.js";
import mongoose from "mongoose";
import { getCompanyId } from "../../utils/company.util.js";

const modelMap = {
  leave: Leave,
  remoteWork: RemoteWork,
  workingHours: WorkingHours,
};
export const getRecentRequestsService = async (req) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const userInfo = req.user;
  const scope = req.query?.scope || "self";
  let query = { company_id: companyId };

  if (userInfo.role === "admin") {
    query = { company_id: companyId };
  } else if (userInfo.role === "manager") {
    const teamsManagedByUser = await Teams.find({
      company_id: companyId,
      managers: userInfo._id,
    }).select("members");

    let teamMemberIds = [];
    teamsManagedByUser.forEach((team) => {
      if (team.members?.length) {
        teamMemberIds.push(
          ...team.members.map((m) => new mongoose.Types.ObjectId(m)),
        );
      }
    });
    teamMemberIds = [...new Set(teamMemberIds.map((id) => id.toString()))].map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    if (scope === "team") {
      teamMemberIds = teamMemberIds.filter((id) => !id.equals(userInfo._id));
      if (teamMemberIds.length === 0)
        throw new AppError("No team members found for this manager", 404);
      query = { company_id: companyId, userId: { $in: teamMemberIds } };
    } else {
      query = { company_id: companyId, userId: userInfo._id };
    }
  } else if (userInfo.role === "teamLead") {
    const teamsLedByUser = await Teams.find({
      company_id: companyId,
      leads: userInfo._id,
    }).select("members");

    let teamMemberIds = [];
    teamsLedByUser.forEach((team) => {
      if (team.members?.length) {
        teamMemberIds.push(
          ...team.members.map((m) => new mongoose.Types.ObjectId(m)),
        );
      }
    });
    teamMemberIds = [...new Set(teamMemberIds.map((id) => id.toString()))].map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    if (scope === "team") {
      teamMemberIds = teamMemberIds.filter((id) => !id.equals(userInfo._id));
      if (teamMemberIds.length === 0)
        throw new AppError("No team members found for this team lead", 404);
      query = { company_id: companyId, userId: { $in: teamMemberIds } };
    } else {
      query = { company_id: companyId, userId: userInfo._id };
    }
  } else {
    query = { company_id: companyId, userId: userInfo._id };
  }

  const logs = await RequestLog.find(query)
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

  const enriched = await Promise.all(
    logs.map(async (log) => {
      const Model = modelMap[log.type];
      if (!Model) return null;

      const requestData = await Model.findOne({
        _id: log.referenceId,
        company_id: companyId,
      }).lean();
      if (!requestData) return null;

      const user = await User.findOne({
        _id: log.userId,
        company_id: companyId,
      })
        .select(
          "first_name last_name email profile_picture employee_id designation",
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
    }),
  );

  return enriched.filter(Boolean);
};
