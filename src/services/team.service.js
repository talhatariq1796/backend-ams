import Departments from "../models/department.model.js";
import Users from "../models/user.model.js";
import Teams from "../models/team.model.js";
import { CheckValidation } from "../utils/validation.util.js";
import AppError from "../middlewares/error.middleware.js";
import Attendances from "../models/attendance.model.js";
import { format } from "date-fns";
import { GetAttendanceStatusByDateService } from "./attendance.service.js";
import mongoose from "mongoose";
import { getCompanyId } from "../utils/company.util.js";

/**
 * Create a team. Supports company_id (multi-tenant), and leads/managers (multiple leads).
 * @param {Object} req - request (for getCompanyId)
 * @param {Object} body - { name, department, members?, leads?, managers?, company_id? }
 */
export const CreateTeamService = async (req, body) => {
  const {
    name,
    department,
    members = [],
    leads: leadsInput = [],
    managers: managersInput = [],
    company_id: bodyCompanyId,
  } = body;
  const companyId = bodyCompanyId || getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const leads = Array.isArray(leadsInput) ? leadsInput : [];
  const managers = Array.isArray(managersInput) ? managersInput : [];

  const validationError = CheckValidation(["name", "department"], { body });
  if (validationError) throw new AppError(validationError, 400);

  const teamDepartment = await Departments.findOne({
    _id: department,
    company_id: companyId,
  });
  if (!teamDepartment) throw new AppError("Department does not exist!", 400);

  const existingTeam = await Teams.findOne({
    company_id: companyId,
    name,
    department,
  });
  if (existingTeam)
    throw new AppError(`Team '${name}' already exists in this department`, 409);

  const leadIds = [
    ...new Set(leads.map((id) => id?.toString()).filter(Boolean)),
  ];
  for (const leadId of leadIds) {
    const leadUser = await Users.findOne({
      _id: leadId,
      company_id: companyId,
    });
    if (!leadUser)
      throw new AppError(
        "Team lead does not exist or is not in your company!",
        400
      );
  }

  const managerIds = [
    ...new Set(managers.map((id) => id?.toString()).filter(Boolean)),
  ];
  for (const managerId of managerIds) {
    const managerUser = await Users.findOne({
      _id: managerId,
      company_id: companyId,
    });
    if (!managerUser)
      throw new AppError(
        "Manager does not exist or is not in your company!",
        400
      );
  }

  const memberIdStrs = [
    ...new Set(
      [...members.map((m) => m?.toString()), ...leadIds, ...managerIds].filter(
        Boolean,
      ),
    ),
  ];
  const leadsArr = leadIds.map((id) =>
    mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id,
  );
  const managersArr = managerIds.map((id) =>
    mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id,
  );
  const membersArr = memberIdStrs.map((id) =>
    mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id,
  );

  const newTeam = new Teams({
    company_id: companyId,
    name,
    department,
    leads: leadsArr,
    managers: managersArr,
    members: membersArr,
  });
  await newTeam.save();

  if (membersArr.length > 0) {
    await Promise.all(
      membersArr.map(async (memberId) => {
        const idStr = memberId?.toString?.() ?? memberId;
        if (leadIds.includes(idStr) || managerIds.includes(idStr)) return;

        const user = await Users.findById(memberId);
        if (!user) return;

        if (user.team) {
          await Teams.findByIdAndUpdate(user.team, {
            $pull: { members: memberId },
          });
        }

        await Users.findByIdAndUpdate(memberId, { team: newTeam._id });

        await Teams.findByIdAndUpdate(newTeam._id, {
          $addToSet: { members: memberId },
        });
      }),
    );
  }

  // ✅ Add team to department
  await Departments.findByIdAndUpdate(department, {
    $addToSet: { teams: newTeam._id },
  });

  // ✅ Return populated team data
  return await Teams.findById(newTeam._id).populate([
    {
      path: "members",
      select:
        "_id first_name last_name email employee_id joining_date attendance_status designation profile_picture",
    },
    { path: "leads", select: "first_name last_name _id" },
    { path: "managers", select: "first_name last_name _id email" },
  ]);
};

export const GetAllTeamsService = async (companyId) => {
  const teams = await Teams.find({ company_id: companyId });
  if (teams.length === 0) throw new AppError("No teams found", 400);
  return teams;
};

export const GetTeamByIdService = async (
  companyId,
  teamId,
  date = new Date()
) => {
  const team = await Teams.findOne({
    _id: teamId,
    company_id: companyId,
  }).populate([
    { path: "department" },
    {
      path: "members",
      select:
        "_id first_name last_name email employee_id profile_picture designation joining_date employment_status",
    },
    {
      path: "leads",
      select: "first_name last_name _id",
    },
  ]);

  if (!team) throw new AppError("Team not found", 400);

  const today = new Date();
  const queryDate = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  const memberIds = team.members.map((member) => member._id);

  const attendanceRecords = await Attendances.find({
    company_id: companyId,
    user_id: { $in: memberIds },
    date: queryDate,
  });

  const attendanceMap = new Map();
  attendanceRecords.forEach((record) => {
    attendanceMap.set(record.user_id.toString(), record.status);
  });

  const membersWithStatus = team.members.map((member) => {
    return {
      ...member.toObject(),
      attendance_status: attendanceMap.get(member._id.toString()) || "Awaiting",
    };
  });

  return {
    ...team.toObject(),
    members: membersWithStatus,
  };
};

export const GetAllTeamLeadsService = async (companyId) => {
  const teams = await Teams.find({
    company_id: companyId,
    leads: { $exists: true, $ne: [] },
  })
    .select("leads")
    .populate({
      path: "leads",
      select: "first_name last_name designation email _id",
    })
    .lean();

  const leadMap = new Map();
  teams.forEach((team) => {
    (team.leads || []).forEach((lead) => {
      if (lead && lead._id) {
        const leadId = lead._id.toString();
        if (!leadMap.has(leadId)) leadMap.set(leadId, lead);
      }
    });
  });

  const usersWithTeamLeadRole = await Users.find({
    company_id: companyId,
    role: "teamLead",
  })
    .select("first_name last_name designation email _id")
    .lean();

  usersWithTeamLeadRole.forEach((user) => {
    const userId = user._id.toString();
    if (!leadMap.has(userId)) leadMap.set(userId, user);
  });

  const teamLeads = Array.from(leadMap.values());

  if (!teamLeads || teamLeads.length === 0) {
    throw new AppError("No team leads found", 200);
  }

  return teamLeads;
};

export const GetTeamLeadService = async (companyId, teamId) => {
  const team = await Teams.findOne({ _id: teamId, company_id: companyId }).populate(
    "leads",
    "first_name last_name _id",
  );
  if (!team) {
    throw new AppError("Team not found", 400);
  }
  return team.leads || [];
};

/**
 * Update a team. Only `leads` and `managers` (arrays of user IDs) are accepted for assignment.
 * @param {string} teamId
 * @param {Object} updateTeamData - { name?, new_department_id?, members?, removed_members?, leads?, managers? }
 * @param {string[]} [updateTeamData.leads] - Array of user IDs to set as team leads; if omitted, existing leads are kept.
 * @param {string[]} [updateTeamData.managers] - Array of user IDs to set as team managers; if omitted, existing managers are kept.
 */
export const UpdateTeamService = async (teamId, updateTeamData, companyId) => {
  if (!companyId) throw new AppError("Company context required", 403);
  const {
    members = [],
    removed_members = [],
    new_department_id,
    name,
  } = updateTeamData;
  const leadsInput = Array.isArray(updateTeamData.leads)
    ? updateTeamData.leads
    : undefined;
  const managersInput = Array.isArray(updateTeamData.managers)
    ? updateTeamData.managers
    : undefined;

  const team = await Teams.findOne({ _id: teamId, company_id: companyId });
  if (!team) throw new AppError("Team not found", 400);

  const oldDepartmentId = team.department;
  const departmentChanged =
    new_department_id &&
    new_department_id.toString() !== oldDepartmentId.toString();

  if (departmentChanged) {
    const newDepartment = await Departments.findOne({
      _id: new_department_id,
      company_id: companyId,
    });
    if (!newDepartment) throw new AppError("New department not found", 400);
  }

  if (name) {
    const existingTeam = await Teams.findOne({
      company_id: companyId,
      name,
      department: new_department_id || oldDepartmentId,
    });
    if (existingTeam && existingTeam._id.toString() !== teamId) {
      throw new AppError(
        `Team '${name}' already exists in this department`,
        409,
      );
    }
  }

  // ✅ Validate leads and build final leads array
  let finalLeads = (team.leads || []).map((id) => id.toString());
  if (leadsInput && leadsInput.length >= 0) {
    const leadIds = [
      ...new Set(leadsInput.map((id) => id?.toString()).filter(Boolean)),
    ];
    for (const leadId of leadIds) {
      const leadUser = await Users.findById(leadId);
      if (!leadUser) throw new AppError("Team lead does not exist!", 400);
    }
    finalLeads = leadIds;
  }
  const leadIdsToKeepStr = new Set(finalLeads);

  // ✅ Validate managers and build final managers array
  let finalManagers = (team.managers || []).map((id) => id.toString());
  if (managersInput && managersInput.length >= 0) {
    const managerIds = [
      ...new Set(managersInput.map((id) => id?.toString()).filter(Boolean)),
    ];
    for (const managerId of managerIds) {
      const managerUser = await Users.findById(managerId);
      if (!managerUser) throw new AppError("Manager does not exist!", 400);
    }
    finalManagers = managerIds;
  }
  const managerIdsToKeepStr = new Set(finalManagers);

  // ✅ Remove members (except leads and managers); also remove from leads/managers if they're being removed
  if (removed_members.length > 0) {
    await Promise.all(
      removed_members.map(async (memberId) => {
        if (
          leadIdsToKeepStr.has(memberId.toString()) ||
          managerIdsToKeepStr.has(memberId.toString())
        )
          return;

        const user = await Users.findById(memberId);
        if (!user) return;

        await Teams.findByIdAndUpdate(teamId, {
          $pull: { members: memberId, leads: memberId, managers: memberId },
        });

        const unassignedTeam = await Teams.findOne({ name: "Unassigned" });
        if (unassignedTeam) {
          await Users.findByIdAndUpdate(memberId, { team: unassignedTeam._id });
          await Teams.findByIdAndUpdate(unassignedTeam._id, {
            $addToSet: { members: memberId },
          });
        }
      }),
    );
  }

  // ✅ Update team members (excluding leads and managers — we don't change their user.team)
  if (members.length > 0) {
    await Promise.all(
      members.map(async (memberId) => {
        if (
          leadIdsToKeepStr.has(memberId.toString()) ||
          managerIdsToKeepStr.has(memberId.toString())
        )
          return;

        const user = await Users.findById(memberId);
        if (!user) return;

        if (user.team && user.team.toString() !== teamId) {
          await Teams.findByIdAndUpdate(user.team, {
            $pull: { members: memberId },
          });
        }

        await Users.findByIdAndUpdate(memberId, { team: teamId });

        await Teams.findByIdAndUpdate(teamId, {
          $addToSet: { members: memberId },
        });
      }),
    );
  }

  // ✅ Handle department change
  if (departmentChanged) {
    await Departments.findByIdAndUpdate(oldDepartmentId, {
      $pull: { teams: teamId },
    });

    await Departments.findByIdAndUpdate(new_department_id, {
      $addToSet: { teams: teamId },
    });
  }

  const leadsObjectIds = finalLeads.map((id) =>
    mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id,
  );

  const managersObjectIds = finalManagers.map((id) =>
    mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id,
  );

  // ✅ Final team update: name, department, leads, managers; ensure leads and managers are in members
  const allLeadsAndManagers = [
    ...new Set([...leadsObjectIds, ...managersObjectIds]),
  ];
  const updatedTeam = await Teams.findByIdAndUpdate(
    teamId,
    {
      $set: {
        name: name || team.name,
        department: new_department_id || team.department,
        leads: leadsObjectIds,
        managers: managersObjectIds,
      },
      $addToSet: { members: { $each: allLeadsAndManagers } },
    },
    { new: true },
  ).populate([
    {
      path: "members",
      select:
        "_id first_name last_name email employee_id joining_date attendance_status designation profile_picture",
    },
    { path: "department" },
    { path: "leads", select: "first_name last_name _id" },
    { path: "managers", select: "first_name last_name _id email" },
  ]);

  if (!updatedTeam) throw new AppError("Failed to update team", 500);

  return updatedTeam;
};

// fix it
export const GetTeamMembersService = async ({
  teamId,
  search = "",
  page = 1,
  limit = 10,
  requestingUserId,
  userRole,
}) => {
  let memberIds = [];
  let department = null;

  // ✅ If user is a Team Lead → ignore teamId and fetch all teams they lead
  if (userRole === "teamLead") {
    const teamsLed = await Teams.find({ leads: requestingUserId }).select(
      "members department",
    );

    if (!teamsLed || teamsLed.length === 0) {
      throw new AppError("No teams found for this team lead", 404);
    }

    teamsLed.forEach((team) => {
      if (team.members?.length) {
        memberIds.push(...team.members.map((m) => m.toString()));
      }
    });

    // For team leads with multiple teams, department might be null or from first team
    if (teamsLed.length === 1 && teamsLed[0].department) {
      department = await Departments.findById(teamsLed[0].department).select(
        "_id name",
      );
    }
  }

  // ✅ If Admin or HR → use teamId to fetch specific team
  else if (["admin", "hr"].includes(userRole)) {
    if (!teamId) throw new AppError("Team ID is required for admin/hr", 400);
    const team = await Teams.findById(teamId).populate(
      "department",
      "_id name",
    );
    if (!team) throw new AppError("Team not found", 400);

    memberIds = team.members.map((m) => m.toString());
    department = team.department;
  }

  // ✅ If Employee → fetch their own team members
  else if (userRole === "employee") {
    const requestingUser =
      await Users.findById(requestingUserId).select("team");
    if (!requestingUser || !requestingUser.team) {
      throw new AppError("User is not assigned to any team", 404);
    }

    const team = await Teams.findById(requestingUser.team).populate(
      "department",
      "_id name",
    );
    if (!team) throw new AppError("Team not found", 400);

    memberIds = team.members.map((m) => m.toString());
    department = team.department;
  }

  // ✅ If neither → not authorized
  else {
    throw new AppError("Unauthorized access", 403);
  }

  // Remove duplicates and exclude the requesting user
  const requestingUserIdStr = requestingUserId.toString();
  memberIds = [...new Set(memberIds)].filter(
    (id) => id !== requestingUserIdStr,
  );

  if (!memberIds.length) {
    return {
      members: [],
      department,
      total: 0,
      currentPage: parseInt(page),
      totalPages: 0,
      hasMorePages: false,
    };
  }

  // 🔍 Build search query
  const query = {
    _id: { $in: memberIds.map((id) => new mongoose.Types.ObjectId(id)) },
    is_active: true,
  };

  if (search.trim()) {
    // Escape special regex characters and search in concatenated full name
    const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = new RegExp(escapedSearch, "i");
    query.$or = [
      { first_name: searchRegex },
      { last_name: searchRegex },
      { employee_id: searchRegex },
      // Search in concatenated full name for queries like "zia ali"
      {
        $expr: {
          $regexMatch: {
            input: {
              $concat: [
                { $ifNull: ["$first_name", ""] },
                " ",
                { $ifNull: ["$last_name", ""] },
              ],
            },
            regex: escapedSearch,
            options: "i",
          },
        },
      },
    ];
  }

  // 📄 Pagination setup
  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);

  const members = await Users.find(query)
    .select(
      "_id first_name last_name email employee_id joining_date designation team profile_picture role employment_status is_active",
    )
    .populate("team", "name _id")
    .skip((parsedPage - 1) * parsedLimit)
    .limit(parsedLimit)
    .lean();

  const total = await Users.countDocuments(query);
  const totalPages = Math.ceil(total / parsedLimit);
  const hasMorePages = parsedPage < totalPages;

  // 🕒 Attendance check for today
  const today = new Date();
  const queryDate = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  const userIds = members.map((m) => m._id);
  const attendanceRecords = await Attendances.find({
    user_id: { $in: userIds },
    date: queryDate,
  });

  const attendanceMap = new Map();
  attendanceRecords.forEach((record) => {
    attendanceMap.set(record.user_id.toString(), record.status);
  });

  const membersWithAttendance = members.map((member) => ({
    ...member,
    attendance_status: attendanceMap.get(member._id.toString()) || "Awaiting",
  }));

  return {
    members: membersWithAttendance,
    department,
    total,
    currentPage: parsedPage,
    totalPages,
    hasMorePages,
  };
};

export const DeleteTeamService = async (teamId, companyId) => {
  if (!companyId) throw new AppError("Company context required", 403);
  const team = await Teams.findOne({ _id: teamId, company_id: companyId });
  if (!team) throw new AppError("Team not found", 400);

  if (team.members.length > 0) {
    throw new AppError(
      "Cannot delete a team that still has members. Remove all members first.",
      400,
    );
  }
  await Departments.findByIdAndUpdate(team.department, {
    $pull: { teams: teamId },
  });
  await Teams.findByIdAndDelete(teamId);
  return team;
};

export const AddMemberToTeamService = async (teamId, memberId, companyId) => {
  if (!companyId) throw new AppError("Company context required", 403);
  const team = await Teams.findOne({ _id: teamId, company_id: companyId });
  if (!team) throw new AppError("Team not found", 400);

  const member = await Users.findOne({ _id: memberId, company_id: companyId });
  if (!member) throw new AppError("User not found", 400);

  if (member.team)
    throw new AppError("User is already assigned to another team", 400);

  team.members.push(memberId);
  member.team = teamId;

  await team.save();
  await member.save();

  return team;
};

export const RemoveMemberFromTeamService = async (teamId, memberId, companyId) => {
  if (!companyId) throw new AppError("Company context required", 403);
  const team = await Teams.findOne({ _id: teamId, company_id: companyId });
  if (!team) throw new AppError("Team not found", 400);

  const member = await Users.findOne({ _id: memberId, company_id: companyId });
  if (!member) throw new AppError("User not found", 400);

  if (!team.members.includes(memberId)) {
    throw new AppError("Member not found in this team", 400);
  }

  // If member is a lead of this team, remove from leads array
  const leads = team.leads || [];
  const leadsWithoutMember = leads.filter(
    (lid) => lid && lid.toString() !== memberId.toString(),
  );
  if (leadsWithoutMember.length !== leads.length) {
    team.leads = leadsWithoutMember;
  }

  // Check if user's current team is this team
  if (member.team?.toString() === teamId.toString()) {
    // Remove the team reference from user
    await Users.findByIdAndUpdate(memberId, { $unset: { team: "" } });

    // Remove member from this team's members array
    team.members.pull(memberId);
    await team.save();
  } else {
    // User’s current team is different; only remove from this team’s member list
    team.members.pull(memberId);
    await team.save();
  }

  return { message: "Member successfully removed from the team", team };
};
