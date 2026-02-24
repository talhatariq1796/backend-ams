import User from "../models/user.model.js";
import Department from "../models/department.model.js";
import Team from "../models/team.model.js";
import { CheckValidation } from "../utils/validation.util.js";
import { CreateTeamService } from "./team.service.js";
import AppError from "../middlewares/error.middleware.js";
import { invalidateCache } from "../utils/cache.util.js";

export const CreateDepartmentService = async (departmentData, user) => {
  //updateddd 3
  const { name, teams } = departmentData;
  //updateddd 4
  const validationError = CheckValidation(["name"], {
    body: departmentData,
  });
  if (validationError) throw new AppError(validationError, 400);

  const existingDepartment = await Department.findOne({ name });
  if (existingDepartment)
    throw new AppError(`Department ${name} already exists`, 409);
  const existingTeams = await Team.find({ name: { $in: teams } });
  if (existingTeams.length > 0) {
    const existingTeamNames = existingTeams.map((team) => team.name).join(", ");
    throw new AppError(
      `The following teams already exist: ${existingTeamNames}`,
      409
    );
  }

  const newDepartment = new Department({ name });
  await newDepartment.save();
  const createdTeams = await Promise.all(
    teams.map(async (team) => {
      try {
        const teamData = { department: newDepartment._id, name: team };
        const newTeam = await CreateTeamService(teamData, user);
        return newTeam._id;
      } catch (error) {
        console.error(`Failed to create team ${team}:`, error);
        return null;
      }
    })
  );
  const validTeamIds = createdTeams.filter((id) => id !== null);
  const department = await Department.findByIdAndUpdate(
    newDepartment._id,
    { teams: validTeamIds },
    { new: true }
  ).populate("teams");
  // await invalidateCache("department_");
  // await invalidateCache("departments_");
  // await invalidateCache("department_stats_");
  return department;
};

export const GetAllDepartmentsService = async () => {
  const departments = await Department.find()
    .sort({ createdAt: -1 })
    .populate({
      path: "teams",
      populate: {
        path: "members",
        select: "profile_picture first_name last_name _id",
        match: { is_active: true },
      },
    });
  if (departments.length === 0) {
    throw new AppError("No departments found", 400);
  }
  return departments;
};

export const GetDepartmentByIdService = async (departmentId) => {
  const department = await Department.findById(departmentId).populate({
    path: "teams",
    populate: {
      path: "members",
      select: "profile_picture first_name last_name _id",
      match: { is_active: true },
    },
  });
  if (!department) {
    throw new AppError("Department not found", 400);
  }
  return department;
};

export const GetDepartmentStatsService = async () => {
  const [
    departmentCount,
    employeesCount,
    permanentEmployeesCount,
    probationEmployeesCount,
    internshipEmployeesCount,
  ] = await Promise.all([
    Department.countDocuments(),
    User.countDocuments({ role: { $ne: "admin" }, is_active: true }),
    User.countDocuments({
      employment_status: "permanent",
      role: { $ne: "admin" },
      is_active: true,
    }),
    User.countDocuments({
      employment_status: "probation",
      role: { $ne: "admin" },
      is_active: true,
    }),
    User.countDocuments({
      employment_status: "internship",
      role: { $ne: "admin" },
      is_active: true,
    }),
  ]);

  return {
    departmentCount,
    employeesCount,
    employmentStats: {
      permanentEmployeesCount,
      probationEmployeesCount,
      internshipEmployeesCount,
    },
  };
};

export const UpdateDepartmentService = async (departmentId, body) => {
  //updateddd 5
  const { name, team_ids } = body;

  if (!name && !team_ids) {
    throw new AppError("At least one field is required", 400);
  }
  const updatedDepartmentData = {};
  if (name) {
    updatedDepartmentData.name = name;
  }
  if (team_ids && team_ids.length > 0) {
    updatedDepartmentData.$pull = { teams: { $in: team_ids } };
  }

  const updatedDepartment = await Department.findByIdAndUpdate(
    departmentId,
    updatedDepartmentData,
    { new: true }
  ).populate({
    path: "teams",
    populate: {
      path: "members",
      select: "profile_picture first_name last_name _id",
      match: { is_active: true },
    },
  });
  if (!updatedDepartment) {
    throw new AppError("Department not found", 400);
  }
  // await invalidateCache("department_");
  // await invalidateCache("departments_");
  // await invalidateCache("department_stats_");
  return updatedDepartment.toObject();
};

export const DeleteDepartmentService = async (departmentId) => {
  const department = await Department.findById(departmentId);
  if (!department) {
    throw new AppError("Department not found", 400);
  }
  const hasTeamWithMembers = department?.teams?.some(
    (team) => team?.members?.length > 0
  );
  if (hasTeamWithMembers) {
    throw new AppError(
      "Department should not have any team members inside the teams before deletion.",
      400
    );
  }
  const teamIds = department.teams;
  await Team.deleteMany({ _id: { $in: teamIds } });
  const deletedDepartment = await Department.findByIdAndDelete(departmentId);
  return deletedDepartment;
};
