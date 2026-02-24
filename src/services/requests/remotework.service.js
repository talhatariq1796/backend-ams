import RemoteWork from "../../models/requests/remotework.model.js";
import { getDateRangeFromFilter } from "../../utils/dateFilters.utils.js";
import { CheckValidation } from "../../utils/validation.util.js";
import AppError from "../../middlewares/error.middleware.js";
import mongoose from "mongoose";
import Leave from "../../models/requests/leave.model.js";
import Teams from "../../models/team.model.js";

export const RequestRemoteWorkService = async (body) => {
  const validationError = CheckValidation(
    ["user_id", "start_date", "end_date", "reason"],
    { body }
  );
  if (validationError) {
    throw new AppError(validationError, 400);
  }

  const { start_date, end_date, reason, user_id, total_days } = body;

  if (new Date(start_date) > new Date(end_date)) {
    throw new AppError("Start date cannot be after end date.", 400);
  }

  const overlappingLeave = await Leave.find({
    user_id,
    status: { $in: ["approved", "pending"] },
    $or: [
      {
        start_date: { $lte: new Date(end_date) },
        end_date: { $gte: new Date(start_date) },
      },
    ],
  });
  if (overlappingLeave.length > 0) {
    throw new AppError(
      "You already have leave applied for the selected date range.",
      400
    );
  }

  const overlappingRemoteWork = await RemoteWork.find({
    user_id,
    status: { $in: ["approved", "pending"] },
    $or: [
      {
        start_date: { $lte: new Date(end_date) },
        end_date: { $gte: new Date(start_date) },
      },
    ],
  });
  if (overlappingRemoteWork.length > 0) {
    throw new AppError(
      "You already have a remote work request for the selected date range.",
      400
    );
  }

  // const total_days = Math.ceil(
  //   (new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24) + 1
  // );

  const newRequest = new RemoteWork({
    user_id,
    start_date,
    end_date,
    total_days,
    reason,
  });

  await newRequest.save();

  return newRequest;
};

export const GetApprovedRemoteWorkByDateService = async (user_id, date) => {
  const targetDate = new Date(date);
  const remoteWork = await RemoteWork.findOne({
    user_id,
    status: "approved",
    start_date: { $lte: targetDate },
    end_date: { $gte: targetDate },
  }).populate("user_id", "-password");
  return remoteWork;
};

export const EditOwnRemoteWorkRequestService = async (
  user_id,
  request_id,
  updateData
) => {
  const request = await RemoteWork.findById(request_id);
  if (!request) throw new AppError("Remote work request not found", 404);

  if (request.user_id.toString() !== user_id.toString()) {
    throw new AppError("Unauthorized to edit this request", 403);
  }

  if (request.status !== "pending") {
    throw new AppError("You can only edit pending requests", 400);
  }

  const allowedFields = ["start_date", "end_date", "reason"];
  const sanitizedUpdate = {};

  for (const key of allowedFields) {
    if (updateData[key] !== undefined) {
      sanitizedUpdate[key] = updateData[key];
    }
  }

  if (Object.keys(sanitizedUpdate).length === 0) {
    throw new AppError(
      "Only start_date, end_date, and reason can be updated",
      400
    );
  }

  if (sanitizedUpdate.reason && !/^.{10,250}$/.test(sanitizedUpdate.reason)) {
    throw new AppError("Reason must be 10-250 characters", 400);
  }

  let newStartDate = sanitizedUpdate.start_date
    ? new Date(sanitizedUpdate.start_date)
    : request.start_date;

  let newEndDate = sanitizedUpdate.end_date
    ? new Date(sanitizedUpdate.end_date)
    : request.end_date;

  if (isNaN(newStartDate)) throw new AppError("Invalid start date format", 400);
  if (isNaN(newEndDate)) throw new AppError("Invalid end date format", 400);
  if (newStartDate > newEndDate) {
    throw new AppError("Start date cannot be after end date", 400);
  }

  if (sanitizedUpdate.start_date || sanitizedUpdate.end_date) {
    sanitizedUpdate.total_days =
      Math.ceil((newEndDate - newStartDate) / (1000 * 60 * 60 * 24)) + 1;
  }

  await checkForDateConflicts(user_id, newStartDate, newEndDate, request_id);

  const updatedRequest = await RemoteWork.findByIdAndUpdate(
    request_id,
    sanitizedUpdate,
    { new: true, runValidators: true }
  );

  return updatedRequest;
};

export const UpdateRemoteWorkStatusService = async (
  request_id,
  status,
  adminName,
  rejection_reason
) => {
  if (!["approved", "rejected"].includes(status)) {
    throw new AppError("Request already processed.", 400);
  }

  const updateFields = {
    status,
    action_taken_by: adminName,
  };

  if (status === "rejected") {
    updateFields.rejection_reason = rejection_reason;
  }

  let request = await RemoteWork.findOneAndUpdate(
    { _id: request_id, status: "pending" },
    updateFields,
    { new: true }
  );

  if (!request) {
    throw new AppError("Request not found or already processed", 404);
  }

  request = await request.populate({
    path: "user_id",
    select: "_id first_name last_name employee_id team profile_picture",
    populate: {
      path: "team",
      select: "name",
    },
  });

  return {
    _id: request._id,
    start_date: request.start_date,
    end_date: request.end_date,
    total_days: request.total_days,
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt,
    sortStatus: request.status === "pending" ? 0 : 1,
    user: {
      _id: request.user_id._id,
      first_name: request.user_id.first_name,
      last_name: request.user_id.last_name,
      employee_id: request.user_id.employee_id,
      team_name: request.user_id.team?.name || null,
    },
  };
};

export const DeleteRemoteWorkRequestService = async (
  user_id,
  request_id,
  user_role
) => {
  const request = await RemoteWork.findById(request_id);

  if (!request) {
    throw new AppError("Request not found", 400);
  }

  const isOwner = request.user_id.toString() === user_id.toString();
  const isAdmin = user_role === "admin";

  if (!isOwner && !isAdmin) {
    throw new AppError("Unauthorized to delete this request", 403);
  }

  if (!isAdmin && request.status !== "pending") {
    throw new AppError("Cannot delete request after approval/rejection", 400);
  }

  await RemoteWork.findByIdAndDelete(request_id);
  return request;
};

export const GetRemoteWorkRequestsService = async ({
  userInfo,
  view_scope = "self",
  filter_type,
  start_date,
  end_date,
  status,
  user_id,
  page = 1,
  limit = 10,
  search = "",
  department_id,
}) => {
  try {
    const filter = {};

    // Role-based view_scope logic
    if (userInfo.role === "admin") {
      // If user_id is provided, use it regardless of view_scope
      if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
        filter.user_id = new mongoose.Types.ObjectId(user_id);
      } else if (view_scope === "all") {
        // all users - only if no specific user_id provided
        // If no search and no user_id, show all (no filter.user_id set)
      } else if (view_scope === "self") {
        filter.user_id = new mongoose.Types.ObjectId(userInfo._id);
      } else {
        throw new AppError("Invalid view_scope for admin", 400);
      }
    } else if (userInfo.role === "manager") {
      // Manager: Find all teams where this user is a manager
      const teamsManagedByUser = await Teams.find({
        managers: userInfo._id,
      }).select("members");

      if (!teamsManagedByUser || teamsManagedByUser.length === 0) {
        throw new AppError("No teams found for this manager", 404);
      }

      // Collect all team member IDs from all teams managed by this user
      let teamMemberIds = [];
      teamsManagedByUser.forEach((team) => {
        if (team.members && team.members.length > 0) {
          teamMemberIds.push(
            ...team.members.map((m) => new mongoose.Types.ObjectId(m))
          );
        }
      });

      // Remove duplicates
      teamMemberIds = [
        ...new Set(teamMemberIds.map((id) => id.toString())),
      ].map((id) => new mongoose.Types.ObjectId(id));

      if (view_scope === "team") {
        // Exclude manager's own ID from the list
        teamMemberIds = teamMemberIds.filter((id) => !id.equals(userInfo._id));

        if (teamMemberIds.length === 0) {
          return {
            remote_work_requests: [],
            total: 0,
            currentPage: parseInt(page),
            totalPages: 0,
            hasMorePages: false,
          };
        }

        filter.user_id = { $in: teamMemberIds };
      } else if (view_scope === "self") {
        filter.user_id = new mongoose.Types.ObjectId(userInfo._id);
      } else {
        throw new AppError("Invalid scope for manager", 400);
      }
    } else if (userInfo.role === "teamLead") {
      // FIX: Find all teams where this user is the lead
      const teamsLedByUser = await Teams.find({
        leads: userInfo._id,
      }).select("members");

      if (!teamsLedByUser || teamsLedByUser.length === 0) {
        throw new AppError("No teams found for this team lead", 404);
      }

      // Collect all team member IDs from all teams led by this user
      let teamMemberIds = [];
      teamsLedByUser.forEach((team) => {
        if (team.members && team.members.length > 0) {
          teamMemberIds.push(
            ...team.members.map((m) => new mongoose.Types.ObjectId(m))
          );
        }
      });

      // Remove duplicates
      teamMemberIds = [
        ...new Set(teamMemberIds.map((id) => id.toString())),
      ].map((id) => new mongoose.Types.ObjectId(id));

      if (view_scope === "team") {
        // Exclude team lead's own ID from the list
        teamMemberIds = teamMemberIds.filter((id) => !id.equals(userInfo._id));

        if (teamMemberIds.length === 0) {
          return {
            remote_work_requests: [],
            total: 0,
            currentPage: parseInt(page),
            totalPages: 0,
            hasMorePages: false,
          };
        }

        filter.user_id = { $in: teamMemberIds };
      } else if (view_scope === "self") {
        filter.user_id = new mongoose.Types.ObjectId(userInfo._id);
      } else {
        throw new AppError("Invalid scope for team lead", 400);
      }
    } else {
      if (view_scope !== "self") {
        throw new AppError(
          "Users can only view their own remote work requests",
          403
        );
      }
      filter.user_id = new mongoose.Types.ObjectId(userInfo._id);
    }

    // Date filtering
    if (filter_type) {
      const { startDate, endDate } = getDateRangeFromFilter(
        filter_type,
        start_date,
        end_date
      );
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Status filtering
    if (status) {
      filter.status =
        status === "processed" ? { $in: ["approved", "rejected"] } : status;
    }

    // Pagination
    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    // Aggregation Pipeline
    const pipeline = [
      { $match: filter },
      {
        $addFields: {
          sortStatus: { $cond: [{ $eq: ["$status", "pending"] }, 0, 1] },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "teams",
          localField: "user.team",
          foreignField: "_id",
          as: "team_info",
        },
      },
      { $unwind: { path: "$team_info", preserveNullAndEmptyArrays: true } },
      { $addFields: { "user.team_name": "$team_info.name" } },
      { $unset: "team_info" },
    ];

    // Department filter
    if (department_id && mongoose.Types.ObjectId.isValid(department_id)) {
      const teamsInDept = await Teams.find({
        department: department_id,
      }).select("members");
      const userIdsInDept = teamsInDept.flatMap((team) =>
        team.members.map((m) => new mongoose.Types.ObjectId(m))
      );

      if (userIdsInDept.length === 0) {
        return {
          remote_work_requests: [],
          total: 0,
          currentPage: parsedPage,
          totalPages: 0,
          hasMorePages: false,
        };
      }

      pipeline.push({
        $match: { "user._id": { $in: userIdsInDept } },
      });
    }

    // Search
    if (search.trim()) {
      // Escape special regex characters and search in concatenated full name
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");
      pipeline.push({
        $match: {
          $or: [
            { "user.first_name": searchRegex },
            { "user.last_name": searchRegex },
            { "user.employee_id": searchRegex },
            // Search in concatenated full name for queries like "zeeshan ali"
            {
              $expr: {
                $regexMatch: {
                  input: {
                    $concat: [
                      { $ifNull: ["$user.first_name", ""] },
                      " ",
                      { $ifNull: ["$user.last_name", ""] },
                    ],
                  },
                  regex: escapedSearch,
                  options: "i",
                },
              },
            },
          ],
        },
      });
    }

    // Count
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await RemoteWork.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Final data fetch
    pipeline.push(
      { $sort: { sortStatus: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: parsedLimit },
      {
        $project: {
          _id: 1,
          status: 1,
          reason: 1,
          rejection_reason: 1,
          start_date: 1,
          end_date: 1,
          createdAt: 1,
          total_days: 1,
          action_taken_by: 1,
          user: {
            _id: 1,
            first_name: 1,
            last_name: 1,
            employee_id: 1,
            profile_picture: 1,
            team_name: 1,
          },
        },
      }
    );

    const requests = await RemoteWork.aggregate(pipeline);
    const totalPages = Math.ceil(total / parsedLimit);
    const hasMorePages = parsedPage < totalPages;

    return {
      remote_work_requests: requests,
      total,
      currentPage: parsedPage,
      totalPages,
      hasMorePages,
    };
  } catch (error) {
    console.error("GetRemoteWorkRequestsService error:", error);
    if (error instanceof AppError) throw error;
    throw new AppError("Error fetching remote work requests", 500);
  }
};

export const GetPendingRemoteWorkCountService = async (user) => {
  const filter = { status: "pending" };

  if (user.role === "admin") {
    // Admin → all
  } else if (user.role === "manager") {
    // Manager → pending requests from their managed teams
    const teamsManagedByUser = await Teams.find({ managers: user._id }).select(
      "members"
    );

    let memberIds = [];
    teamsManagedByUser.forEach((team) => {
      if (team.members?.length) {
        memberIds.push(
          ...team.members.map((id) => new mongoose.Types.ObjectId(id))
        );
      }
    });

    memberIds = [...new Set(memberIds.map((id) => id.toString()))]
      .map((id) => new mongoose.Types.ObjectId(id))
      .filter((id) => id.toString() !== user._id.toString());

    filter.user_id = { $in: memberIds };
  } else if (user.role === "teamLead") {
    const teamsLedByUser = await Teams.find({ leads: user._id }).select(
      "members"
    );

    let memberIds = [];
    teamsLedByUser.forEach((team) => {
      if (team.members?.length) {
        memberIds.push(
          ...team.members.map((id) => new mongoose.Types.ObjectId(id))
        );
      }
    });

    memberIds = [...new Set(memberIds.map((id) => id.toString()))]
      .map((id) => new mongoose.Types.ObjectId(id))
      .filter((id) => id.toString() !== user._id.toString());

    filter.user_id = { $in: memberIds };
  } else {
    filter.user_id = user._id;
  }

  const count = await RemoteWork.countDocuments(filter);
  return { count };
};

export const AssignRemoteWorkToUsersService = async (
  userIds,
  { start_date, end_date, total_days, reason, admin_name }
) => {
  try {
    const results = [];

    for (const userId of userIds) {
      const alreadyApproved = await RemoteWork.exists({
        user_id: userId,
        status: "approved",
        start_date: { $lte: new Date(end_date) },
        end_date: { $gte: new Date(start_date) },
      });

      if (alreadyApproved) {
        results.push({
          userId,
          status: "skipped_already_approved",
          message: "User already has approved remote work in this date range",
        });
        continue;
      }

      const conflictingPendingRequests = await RemoteWork.find({
        user_id: userId,
        status: "pending",
        start_date: { $lte: new Date(end_date) },
        end_date: { $gte: new Date(start_date) },
      });

      for (const request of conflictingPendingRequests) {
        await RemoteWork.findByIdAndUpdate(request._id, {
          status: "rejected",
          rejection_reason: "Rejected by admin due to override",
          action_taken_by: admin_name,
        });
      }

      const request = await RemoteWork.create({
        user_id: userId,
        start_date,
        end_date,
        total_days,
        reason,
        status: "approved",
        created_by: admin_name,
        action_taken_by: admin_name,
      });

      results.push({
        userId,
        status: "created_and_approved",
        requestId: request._id,
        rejectedConflicts: conflictingPendingRequests.map((r) => r._id),
      });
    }

    return results;
  } catch (error) {
    throw new AppError("Error fetching remote work requests", 500);
  }
};

export const AdminUpdateRemoteWorkRequestService = async (
  request_id,
  updateData,
  adminName
) => {
  const request = await RemoteWork.findById(request_id);
  if (!request) throw new AppError("Remote work request not found", 404);

  if (updateData.reason && !/^.{10,250}$/.test(updateData.reason)) {
    throw new AppError("Reason must be 10-250 characters", 400);
  }

  if (updateData.status) {
    if (updateData.status === "rejected" && !updateData.rejection_reason) {
      throw new AppError(
        "Rejection reason is required when rejecting a request",
        400
      );
    }

    if (updateData.status === "approved" && request.status === "rejected") {
      updateData.rejection_reason = null;
    }

    updateData.action_taken_by = adminName;
  }

  let newStartDate = request.start_date;
  let newEndDate = request.end_date;
  let datesChanged = false;

  if (updateData.start_date || updateData.end_date) {
    newStartDate = updateData.start_date
      ? new Date(updateData.start_date)
      : request.start_date;
    newEndDate = updateData.end_date
      ? new Date(updateData.end_date)
      : request.end_date;

    if (isNaN(newStartDate))
      throw new AppError("Invalid start date format", 400);
    if (isNaN(newEndDate)) throw new AppError("Invalid end date format", 400);
    if (newStartDate > newEndDate) {
      throw new AppError("Start date cannot be after end date", 400);
    }

    datesChanged = true;

    updateData.total_days = Math.ceil(
      (newEndDate - newStartDate) / (1000 * 60 * 60 * 24) + 1
    );
  }

  const newStatus = updateData.status || request.status;

  if (newStatus !== "rejected" && (datesChanged || newStatus === "approved")) {
    await checkForDateConflicts(
      request.user_id,
      newStartDate,
      newEndDate,
      request._id
    );
  }

  const updatedRequest = await RemoteWork.findByIdAndUpdate(
    request_id,
    updateData,
    { new: true, runValidators: true }
  );

  return updatedRequest;
};

async function checkForDateConflicts(
  userId,
  startDate,
  endDate,
  excludeRequestId = null
) {
  const leaveConflict = await Leave.findOne({
    user_id: userId,
    status: { $in: ["approved", "pending"] },
    $or: [{ start_date: { $lte: endDate }, end_date: { $gte: startDate } }],
  });

  if (leaveConflict) {
    throw new AppError("User has conflicting approved/pending leave", 400);
  }

  const remoteFilter = {
    user_id: userId,
    status: { $in: ["approved", "pending"] },
    $or: [{ start_date: { $lte: endDate }, end_date: { $gte: startDate } }],
  };

  if (excludeRequestId) {
    remoteFilter._id = { $ne: excludeRequestId };
  }

  const remoteConflict = await RemoteWork.findOne(remoteFilter);

  if (remoteConflict) {
    throw new AppError(
      "User has conflicting approved/pending remote work",
      400
    );
  }
}
