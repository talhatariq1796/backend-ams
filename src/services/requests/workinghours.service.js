import WorkingHoursRequest from "../../models/requests/workinghours.model.js";
import Users from "../../models/user.model.js";
import WorkingHours from "../../models/workingHours.model.js";
import { getDateRangeFromFilter } from "../../utils/dateFilters.utils.js";
import AppError from "../../middlewares/error.middleware.js";
import mongoose from "mongoose";
import Teams from "../../models/team.model.js";
import { getPagination } from "../../utils/pagination.util.js";

export const createRequest = async (workingHourData) => {
  return await WorkingHoursRequest.create(workingHourData);
};

export const deleteRequest = async (requestId, userId, userRole) => {
  const workingHour = await WorkingHoursRequest.findOne({ _id: requestId });

  if (!workingHour) {
    throw new AppError("Request not found", 400);
  }

  const isOwner = workingHour.user_id.toString() === userId.toString();
  const isAdmin = userRole === "admin";

  if (!isOwner && !isAdmin) {
    throw new AppError("Unauthorized to delete this request", 403);
  }

  if (!isAdmin && workingHour.status !== "pending") {
    throw new AppError("Cannot delete request after approval/rejection", 400);
  }

  return await WorkingHoursRequest.findByIdAndDelete(requestId);
};

export const changeRequestStatus = async (
  requestId,
  status,
  action_taken_by,
  rejectionReason
) => {
  const workingHourRequest = await WorkingHoursRequest.findOne({
    _id: requestId,
    status: "pending",
  });

  if (!workingHourRequest) {
    throw new AppError("Request not found or already processed", 400);
  }

  const updatedFields = {
    status,
    action_taken_by,
  };

  if (status === "rejected") {
    updatedFields.rejection_reason = rejectionReason;
  }

  if (status === "approved") {
    await Promise.all([
      WorkingHours.updateOne(
        {
          user_id: workingHourRequest.user_id,
          // start_date: workingHourRequest.start_date,
          // end_date: workingHourRequest.end_date,
        },
        {
          $set: {
            is_week_custom_working_hours:
              workingHourRequest.is_week_custom_working_hours,
            checkin_time: workingHourRequest.checkin_time,
            checkout_time: workingHourRequest.checkout_time,
            custom_working_hours: workingHourRequest.custom_working_hours,
            expiry_date: new Date(
              new Date(workingHourRequest.end_date).setHours(23, 59, 59, 999)
            ),
          },
        },
        { upsert: true }
      ),
      Users.updateOne(
        { _id: workingHourRequest.user_id },
        { $set: { is_default_working_hours: false } }
      ),
    ]);
  }

  const updatedRequest = await WorkingHoursRequest.findByIdAndUpdate(
    requestId,
    updatedFields,
    { new: true }
  ).populate({
    path: "user_id",
    select: "_id first_name last_name employee_id team profile_picture",
    populate: {
      path: "team",
      select: "name",
    },
  });

  return {
    _id: updatedRequest._id,
    start_date: updatedRequest.start_date,
    end_date: updatedRequest.end_date,
    is_week_custom_working_hours: updatedRequest.is_week_custom_working_hours,
    checkin_time: updatedRequest.checkin_time,
    checkout_time: updatedRequest.checkout_time,
    custom_working_hours: updatedRequest.custom_working_hours,
    status: updatedRequest.status,
    action_taken_by: updatedRequest.action_taken_by,
    rejection_reason: updatedRequest.rejection_reason,
    createdAt: updatedRequest.createdAt,
    updatedAt: updatedRequest.updatedAt,
    sortPriority: updatedRequest.status === "pending" ? 0 : 1,
    until_i_change: updatedRequest.until_i_change,
    expiry_date: updatedRequest.expiry_date,
    user: {
      _id: updatedRequest.user_id._id,
      first_name: updatedRequest.user_id.first_name,
      last_name: updatedRequest.user_id.last_name,
      profile_picture: updatedRequest.user_id.profile_picture,
      employee_id: updatedRequest.user_id.employee_id,
      team_name: updatedRequest.user_id.team?.name || null,
    },
  };
};

export const getUserRequests = async (
  userId,
  filter_type,
  start_date,
  end_date,
  statusType,
  page = 1,
  limit = 10
) => {
  if (!userId) {
    return { message: "User ID is required." };
  }

  try {
    const objectUserId = new mongoose.Types.ObjectId(userId);
    let filter = { user_id: objectUserId };

    if (filter_type) {
      try {
        const { startDate, endDate } = getDateRangeFromFilter(
          filter_type,
          start_date,
          end_date
        );
        filter.createdAt = { $gte: startDate, $lte: endDate };
      } catch (error) {
        throw new Error(error.message);
      }
    }

    if (statusType) {
      filter.status =
        statusType === "processed"
          ? { $in: ["approved", "rejected"] }
          : statusType;
    }

    const {
      page: parsedPage,
      limit: parsedLimit,
      skip,
    } = getPagination(page, limit);

    const requests = await WorkingHoursRequest.aggregate([
      { $match: filter },
      {
        $addFields: {
          isPending: {
            $cond: [{ $eq: [{ $ifNull: ["$status", ""] }, "pending"] }, 0, 1],
          },
        },
      },
      {
        $sort: {
          isPending: 1,
          createdAt: -1,
        },
      },
      { $skip: skip },
      { $limit: parsedLimit },
    ]);

    const total = await WorkingHoursRequest.countDocuments(filter);
    const totalPages = Math.ceil(total / parsedLimit);
    const hasMorePages = parsedPage < totalPages;

    return {
      requests,
      total,
      currentPage: parsedPage,
      totalPages,
      hasMorePages,
    };
  } catch (error) {
    throw new AppError("Internal server error", 500);
  }
};

export const GetAllUserRequestsService = async (
  userInfo,
  view_scope = "self",
  filter_type,
  start_date,
  end_date,
  statusType,
  user_id,
  department_id,
  search = "",
  page = 1,
  limit = 10
) => {
  try {
    const match = {};

    // Apply date filtering
    if (filter_type) {
      const { startDate, endDate } = getDateRangeFromFilter(
        filter_type,
        start_date,
        end_date
      );
      match.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Apply status filtering
    if (statusType) {
      match.status =
        statusType === "processed"
          ? { $in: ["approved", "rejected"] }
          : statusType;
    }

    // ** Apply View Scope **
    if (userInfo.role === "admin") {
      // If user_id is provided, use it regardless of view_scope
      if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
        match.user_id = new mongoose.Types.ObjectId(user_id);
      } else if (view_scope === "all") {
        // all users - only if no specific user_id provided
        // If no search and no user_id, show all (no match.user_id set)
      } else if (view_scope === "self") {
        match.user_id = new mongoose.Types.ObjectId(userInfo._id);
      } else {
        throw new AppError("Invalid scope for admin", 400);
      }
    } else if (userInfo.role === "manager") {
      // Manager: Find all teams where this user is a manager
      const teamsManagedByUser = await Teams.find({
        managers: userInfo._id,
      }).select("members");

      if (!teamsManagedByUser || teamsManagedByUser.length === 0) {
        throw new AppError("No teams found for this manager", 404);
      }

      // Collect all unique team member IDs from all teams managed by this user
      let teamMemberIds = [];
      teamsManagedByUser.forEach((team) => {
        if (team.members && team.members.length > 0) {
          teamMemberIds.push(
            ...team.members.map((m) => new mongoose.Types.ObjectId(m))
          );
        }
      });

      teamMemberIds = [
        ...new Set(teamMemberIds.map((id) => id.toString())),
      ].map((id) => new mongoose.Types.ObjectId(id));

      if (view_scope === "team") {
        // Exclude the manager themselves
        teamMemberIds = teamMemberIds.filter((id) => !id.equals(userInfo._id));

        if (teamMemberIds.length === 0) {
          return {
            requests: [],
            total: 0,
            currentPage: parseInt(page),
            totalPages: 0,
            hasMorePages: false,
          };
        }

        match.user_id = { $in: teamMemberIds };
      } else if (view_scope === "self") {
        match.user_id = new mongoose.Types.ObjectId(userInfo._id);
      } else {
        throw new AppError("Invalid scope for manager", 400);
      }
    } else if (userInfo.role === "teamLead") {
      // ✅ Find all teams where this user is the lead
      const teamsLedByUser = await Teams.find({ leads: userInfo._id }).select(
        "members"
      );

      if (!teamsLedByUser || teamsLedByUser.length === 0) {
        throw new AppError("No teams found for this team lead", 404);
      }

      // ✅ Collect all unique team member IDs from all teams led by this user
      let teamMemberIds = [];
      teamsLedByUser.forEach((team) => {
        if (team.members && team.members.length > 0) {
          teamMemberIds.push(
            ...team.members.map((m) => new mongoose.Types.ObjectId(m))
          );
        }
      });

      teamMemberIds = [
        ...new Set(teamMemberIds.map((id) => id.toString())),
      ].map((id) => new mongoose.Types.ObjectId(id));

      if (view_scope === "team") {
        // ✅ Exclude the team lead themselves
        teamMemberIds = teamMemberIds.filter((id) => !id.equals(userInfo._id));

        if (teamMemberIds.length === 0) {
          return {
            requests: [],
            total: 0,
            currentPage: parseInt(page),
            totalPages: 0,
            hasMorePages: false,
          };
        }

        match.user_id = { $in: teamMemberIds };
      } else if (view_scope === "self") {
        match.user_id = new mongoose.Types.ObjectId(userInfo._id);
      } else {
        throw new AppError("Invalid scope for team lead", 400);
      }
    } else {
      // Normal user
      if (view_scope !== "self") {
        throw new AppError("Users can only view their own working hours", 403);
      }
      match.user_id = new mongoose.Types.ObjectId(userInfo._id);
    }

    // Department filtering
    if (department_id && mongoose.Types.ObjectId.isValid(department_id)) {
      const teamsInDept = await Teams.find({
        department: department_id,
      }).select("members");
      const userIdsInDept = teamsInDept.flatMap((team) =>
        team.members.map(
          (member) => new mongoose.Types.ObjectId(member?.toString())
        )
      );

      if (userIdsInDept.length > 0) {
        if (!match.user_id) {
          match.user_id = { $in: userIdsInDept };
        } else if (match.user_id.$in) {
          match.user_id = {
            $in: userIdsInDept.filter((id) =>
              match.user_id.$in.some((uid) => uid.equals(id))
            ),
          };
        } else if (!userIdsInDept.some((id) => id.equals(match.user_id))) {
          match.user_id = { $in: [] };
        }
      } else {
        match.user_id = { $in: [] };
      }
    }

    // Pagination
    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          sortPriority: { $cond: [{ $eq: ["$status", "pending"] }, 0, 1] },
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

    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await WorkingHoursRequest.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    pipeline.push(
      { $sort: { sortPriority: 1, createdAt: -1 } },
      { $skip: skip },
      { $limit: parsedLimit },
      {
        $project: {
          _id: 1,
          checkin_time: 1,
          checkout_time: 1,
          is_week_custom_working_hours: 1,
          custom_working_hours: 1,
          status: 1,
          action_taken_by: 1,
          rejection_reason: 1,
          createdAt: 1,
          updatedAt: 1,
          sortPriority: 1,
          start_date: 1,
          end_date: 1,
          total_days: 1,
          expiry_date: 1,
          until_i_change: 1,
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

    const requests = await WorkingHoursRequest.aggregate(pipeline);
    const totalPages = Math.ceil(total / parsedLimit);
    const hasMorePages = parsedPage < totalPages;

    return {
      requests,
      total,
      currentPage: parsedPage,
      totalPages,
      hasMorePages,
    };
  } catch (error) {
    console.error("GetAllUserRequestsService error:", error);
    throw new AppError("Internal server error", 500);
  }
};

export const GetPendingWorkingHoursCountService = async (user) => {
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

  const count = await WorkingHoursRequest.countDocuments(filter);
  return { pending_count: count };
};

// Shared edit function for both admin and user edits
const editWorkingHoursRequest = async (
  requestId,
  editData,
  editorInfo,
  isAdminEdit = false
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const request = await WorkingHoursRequest.findById(requestId)
      .session(session)
      .populate(
        "user_id",
        "_id first_name last_name employee_id team profile_picture"
      );

    if (!request) {
      throw new AppError("Working hours request not found", 404);
    }

    // Authorization checks
    if (!isAdminEdit) {
      // User edit restrictions
      if (request.user_id._id.toString() !== editorInfo._id.toString()) {
        throw new AppError("You can only edit your own requests", 403);
      }
      if (request.status !== "pending") {
        throw new AppError("You can only edit pending requests", 400);
      }
    }
    // Admin edit doesn't need ownership check

    // Define allowed fields based on edit type
    const allowedFields = isAdminEdit
      ? [
          "is_week_custom_working_hours",
          "checkin_time",
          "checkout_time",
          "custom_working_hours",
          "start_date",
          "end_date",
          "until_i_change",
          "status",
          "rejection_reason",
        ]
      : [
          "is_week_custom_working_hours",
          "checkin_time",
          "checkout_time",
          "custom_working_hours",
          "start_date",
          "end_date",
          "until_i_change",
        ];

    // Filter editData to only include allowed fields
    const filteredEditData = {};
    Object.keys(editData).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredEditData[key] = editData[key];
      }
    });

    // Store old values for comparison (admin edit logic)
    const oldValues = isAdminEdit
      ? {
          is_week_custom_working_hours: request.is_week_custom_working_hours,
          checkin_time: request.checkin_time,
          checkout_time: request.checkout_time,
          custom_working_hours: request.custom_working_hours,
          start_date: request.start_date,
          end_date: request.end_date,
          until_i_change: request.until_i_change,
          status: request.status,
        }
      : null;

    // Check for date conflicts (exclude current request for user edits)
    if (filteredEditData.start_date || filteredEditData.end_date) {
      const newStartDate = filteredEditData.start_date
        ? new Date(filteredEditData.start_date)
        : request.start_date;
      const newEndDate = filteredEditData.end_date
        ? new Date(filteredEditData.end_date)
        : request.end_date;

      // Only check overlaps for user edits or when admin is changing dates
      if (!isAdminEdit) {
        const existingOverlap = await WorkingHoursRequest.findOne({
          _id: { $ne: requestId },
          user_id: request.user_id._id,
          status: { $ne: "rejected" },
          $or: [
            {
              start_date: { $lte: newEndDate },
              end_date: { $gte: newStartDate },
            },
          ],
        }).session(session);

        if (existingOverlap) {
          throw new AppError(
            "You already have another request for this date range.",
            400
          );
        }
      }
    }

    // Update request fields
    if (filteredEditData.start_date !== undefined) {
      request.start_date =
        filteredEditData.start_date === null
          ? null
          : new Date(filteredEditData.start_date);
    }

    if (filteredEditData.end_date !== undefined) {
      if (filteredEditData.end_date === null) {
        request.end_date = null;
        request.expiry_date = null; // also clear expiry
      } else {
        request.end_date = new Date(filteredEditData.end_date);
        if (!request.until_i_change) {
          request.expiry_date = new Date(
            new Date(request.end_date).setHours(23, 59, 59, 999)
          );
        }
      }
    }

    if (filteredEditData.is_week_custom_working_hours !== undefined) {
      request.is_week_custom_working_hours =
        filteredEditData.is_week_custom_working_hours;
    }
    if (filteredEditData.checkin_time !== undefined) {
      request.checkin_time = filteredEditData.checkin_time;
    }
    if (filteredEditData.checkout_time !== undefined) {
      request.checkout_time = filteredEditData.checkout_time;
    }
    if (filteredEditData.custom_working_hours !== undefined) {
      request.custom_working_hours = filteredEditData.custom_working_hours;
    }
    if (filteredEditData.until_i_change !== undefined) {
      request.until_i_change = filteredEditData.until_i_change;
      if (filteredEditData.until_i_change === true) {
        request.expiry_date = null;
      } else if (request.end_date) {
        request.expiry_date = new Date(
          new Date(request.end_date).setHours(23, 59, 59, 999)
        );
      }
    }

    // Admin-only fields
    if (isAdminEdit && filteredEditData.status !== undefined) {
      request.status = filteredEditData.status;
      request.action_taken_by = `${editorInfo.first_name} ${editorInfo.last_name}`;

      if (
        filteredEditData.status === "rejected" &&
        !filteredEditData.rejection_reason
      ) {
        throw new AppError("Rejection reason is required when rejecting", 400);
      }

      request.rejection_reason =
        filteredEditData.status === "rejected"
          ? filteredEditData.rejection_reason
          : filteredEditData.status === "approved"
          ? undefined
          : request.rejection_reason;
    }

    // Calculate total_days if dates are available
    if (request.start_date && request.end_date) {
      const timeDiff =
        request.end_date.getTime() - request.start_date.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      request.total_days = daysDiff;
    }

    // Validation
    if (request.is_week_custom_working_hours) {
      if (
        !Array.isArray(request.custom_working_hours) ||
        request.custom_working_hours.length === 0
      ) {
        throw new AppError(
          "Custom working hours must be provided and cannot be empty",
          400
        );
      }
    } else {
      if (!request.checkin_time || !request.checkout_time) {
        throw new AppError("Check-in and check-out times are required", 400);
      }
    }

    // Admin-specific: Update WorkingHours collection if approved
    if (isAdminEdit && oldValues) {
      const shouldUpdateDates =
        request.start_date?.toISOString() !==
          oldValues.start_date?.toISOString() ||
        request.end_date?.toISOString() !== oldValues.end_date?.toISOString();

      const shouldUpdateWorkingHours =
        request.status === "approved" &&
        (oldValues.status !== "approved" ||
          request.is_week_custom_working_hours !==
            oldValues.is_week_custom_working_hours ||
          request.checkin_time?.toString() !==
            oldValues.checkin_time?.toString() ||
          request.checkout_time?.toString() !==
            oldValues.checkout_time?.toString() ||
          JSON.stringify(request.custom_working_hours) !==
            JSON.stringify(oldValues.custom_working_hours) ||
          shouldUpdateDates);

      if (shouldUpdateWorkingHours) {
        await Promise.all([
          WorkingHours.updateOne(
            {
              user_id: request.user_id._id,
            },
            {
              $set: {
                is_week_custom_working_hours:
                  request.is_week_custom_working_hours,
                checkin_time: request.checkin_time,
                checkout_time: request.checkout_time,
                custom_working_hours: request.custom_working_hours,
                expiry_date: new Date(
                  new Date(request.end_date).setHours(23, 59, 59, 999)
                ),
              },
            },
            { upsert: true, session }
          ),
          Users.updateOne(
            { _id: request.user_id._id },
            { $set: { is_default_working_hours: false } },
            { session }
          ),
        ]);
      }
    }

    await request.save({ session });
    await session.commitTransaction();

    // Return populated request with team info for user edits
    const populatedRequest = !isAdminEdit
      ? await WorkingHoursRequest.findById(requestId).populate({
          path: "user_id",
          select: "_id first_name last_name employee_id team profile_picture",
          populate: {
            path: "team",
            select: "name",
          },
        })
      : request;

    return {
      _id: populatedRequest._id,
      start_date: populatedRequest.start_date,
      end_date: populatedRequest.end_date,
      total_days: populatedRequest.total_days,
      is_week_custom_working_hours:
        populatedRequest.is_week_custom_working_hours,
      checkin_time: populatedRequest.checkin_time,
      checkout_time: populatedRequest.checkout_time,
      custom_working_hours: populatedRequest.custom_working_hours,
      status: populatedRequest.status,
      action_taken_by: populatedRequest.action_taken_by,
      rejection_reason: populatedRequest.rejection_reason,
      createdAt: populatedRequest.createdAt,
      updatedAt: populatedRequest.updatedAt,
      expiry_date: populatedRequest.expiry_date,
      until_i_change: populatedRequest.until_i_change,
      user: {
        _id: populatedRequest.user_id._id,
        first_name: populatedRequest.user_id.first_name,
        last_name: populatedRequest.user_id.last_name,
        profile_picture: populatedRequest.user_id.profile_picture || null,
        employee_id: populatedRequest.user_id.employee_id || null,
        team_name: populatedRequest.user_id.team?.name || null,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Simplified Admin Edit function
export const AdminEditWorkingHoursRequest = async (
  requestId,
  editData,
  adminInfo
) => {
  return await editWorkingHoursRequest(requestId, editData, adminInfo, true);
};

// Simplified User Edit function
export const UserEditWorkingHoursRequest = async (
  requestId,
  editData,
  userInfo
) => {
  return await editWorkingHoursRequest(requestId, editData, userInfo, false);
};

// Keep the existing checkOverlappingRequest function as is
export const checkOverlappingRequest = async ({
  user_id,
  start_date,
  end_date,
}) => {
  return await WorkingHoursRequest.findOne({
    user_id,
    status: { $ne: "rejected" },
    $or: [
      {
        start_date: { $lte: end_date },
        end_date: { $gte: start_date },
      },
    ],
  });
};
