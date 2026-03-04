import Suggestion from "../models/suggestion.model.js";
import Team from "../models/team.model.js";
import Departments from "../models/department.model.js";
import Users from "../models/user.model.js";
import { CheckValidation } from "../utils/validation.util.js";
import { getDateRangeFromFilter } from "../utils/dateFilters.utils.js";
import AppError from "../middlewares/error.middleware.js";
import mongoose from "mongoose";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import Like from "../models/likes.model.js";
import Comment from "../models/comments.model.js";
import { getCompanyId } from "../utils/company.util.js";

export const CreateSuggestionService = async (req, suggestionData) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const user = req.user;
  const {
    title,
    description,
    image,
    category,
    is_identity_hidden,
    is_visible_to_admin_only,
    is_public,
    visible_to_departments,
  } = suggestionData;

  const validationError = CheckValidation(
    ["title", "description", "category"],
    { body: suggestionData }
  );
  if (validationError) {
    throw new AppError(validationError, 400);
  }
  if (title.length > 100) {
    throw new AppError("Title must be 100 characters or fewer.", 400);
  }

  let allowedVisibility = [];

  if (is_visible_to_admin_only) {
    allowedVisibility = [];
  } else if (is_public) {
    allowedVisibility = []; // Everyone sees it
  } else if (user.role === "admin") {
    allowedVisibility = visible_to_departments || [];

    if (allowedVisibility.length > 0) {
      const validDepartments = await Departments.find({
        company_id: companyId,
        _id: { $in: allowedVisibility },
      });

      if (validDepartments.length !== allowedVisibility.length) {
        throw new AppError("Invalid department IDs provided", 400);
      }
    }
  } else {
    const userTeam = await Team.findOne({
      _id: user.team,
      company_id: companyId,
    }).populate("department");
    if (!userTeam?.department?._id) {
      throw new AppError("User's department not found", 400);
    }
    allowedVisibility = [userTeam.department._id];
  }

  const newSuggestion = new Suggestion({
    company_id: companyId,
    title,
    description,
    image,
    category,
    is_identity_hidden,
    is_visible_to_admin_only,
    is_public: is_public || false,
    visible_to_departments: allowedVisibility,
    likes_count: 0,
    comments_count: 0,
    ...(is_identity_hidden
      ? {}
      : {
          created_by: user._id,
          updated_by: user._id,
        }),
  });

  await newSuggestion.save();

  return await Suggestion.findOne({
    _id: newSuggestion._id,
    company_id: companyId,
  })
    .populate("created_by", "first_name last_name")
    .populate("visible_to_departments", "name");
};

// Toggle like/unlike for a suggestion
export const toggleLikeSuggestionService = async (req, suggestionId) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const user = req.user;
  const suggestion = await Suggestion.findOne({
    _id: suggestionId,
    company_id: companyId,
  });
  if (!suggestion) throw new AppError("Suggestion not found", 404);

  const existingLike = await Like.findOne({
    company_id: companyId,
    suggestion: suggestionId,
    user: user._id,
  });

  if (existingLike) {
    // Remove like
    await Like.deleteOne({ _id: existingLike._id });

    suggestion.likes = suggestion.likes.filter(
      (id) => String(id) !== String(user._id)
    );
    suggestion.likes_count = Math.max(suggestion.likes_count - 1, 0);
    await suggestion.save();

    return "Successfully unliked";
  } else {
    // Add new like
    await Like.create({
      company_id: companyId,
      suggestion: suggestionId,
      user: user._id,
    });

    suggestion.likes.push(user._id);
    suggestion.likes_count += 1;
    await suggestion.save();

    return "Successfully liked";
  }
};

// Add a comment to a suggestion
export const addCommentToSuggestionService = async (
  req,
  suggestionId,
  text
) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const user = req.user;
  const suggestion = await Suggestion.findOne({
    _id: suggestionId,
    company_id: companyId,
  });
  if (!suggestion) throw new AppError("Suggestion not found", 404);

  const comment = await Comment.create({
    company_id: companyId,
    suggestion: suggestionId,
    text,
    created_by: user._id,
    role: user.role,
  });

  suggestion.comments.push(comment._id);
  suggestion.comments_count += 1;
  await suggestion.save();

  const populatedComment = await Comment.findOne({
    _id: comment._id,
    company_id: companyId,
  })
    .populate("created_by", "first_name last_name profile_picture role")
    .lean();

  return populatedComment;
};

export const deleteCommentService = async (req, suggestionId, commentId) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const user = req.user;
  const comment = await Comment.findOne({
    _id: commentId,
    company_id: companyId,
  });
  if (!comment) throw new AppError("Comment not found", 404);

  const isCommentOwner = String(comment.created_by) === String(user._id);
  if (user.role !== "admin" && !isCommentOwner) {
    throw new AppError("You can only delete your own comments", 403);
  }

  if (isCommentOwner && user.role !== "admin") {
    const commentCreatedAt = new Date(comment.createdAt);
    const minutesSinceCreation = (Date.now() - commentCreatedAt) / (1000 * 60);
    if (minutesSinceCreation > 15) {
      throw new AppError(
        "You can only delete your own comments within 15 minutes of creation",
        403
      );
    }
  }

  await Comment.deleteOne({ _id: commentId, company_id: companyId });

  await Suggestion.findOneAndUpdate(
    { _id: suggestionId, company_id: companyId },
    {
      $pull: { comments: commentId },
      $inc: { comments_count: -1 },
    }
  );
};

export const editCommentService = async (req, commentId, text) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const user = req.user;
  const comment = await Comment.findOne({
    _id: commentId,
    company_id: companyId,
  });
  if (!comment) throw new AppError("Comment not found", 404);

  // Check if user is the comment creator
  const isCommentOwner = String(comment.created_by) === String(user._id);

  // If not admin and not the owner, deny access
  if (user.role !== "admin" && !isCommentOwner) {
    throw new AppError("You can only edit your own comments", 403);
  }

  // If user is the owner (not admin), check if 15 minutes have passed
  if (isCommentOwner && user.role !== "admin") {
    const commentCreatedAt = new Date(comment.createdAt);
    const now = new Date();
    const minutesSinceCreation = (now - commentCreatedAt) / (1000 * 60);

    if (minutesSinceCreation > 15) {
      throw new AppError(
        "You can only edit your own comments within 15 minutes of creation",
        403
      );
    }
  }

  comment.text = text;
  comment.updated_at = new Date();
  await comment.save();

  return comment;
};
export const getLikesBySuggestionId = async (
  req,
  suggestionId,
  page = 1,
  limit = 10,
  isAsc = false
) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const skip = (page - 1) * limit;
  const sortOrder = isAsc ? 1 : -1;

  const [likes, total] = await Promise.all([
    Like.find({ company_id: companyId, suggestion: suggestionId })
      .populate("user", "first_name last_name email profile_picture role")
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    Like.countDocuments({ company_id: companyId, suggestion: suggestionId }),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data: likes, // includes `user` and `created_at`
  };
};

export const getCommentsBySuggestionId = async (
  req,
  suggestionId,
  page = 1,
  limit = 10,
  isAsc = false
) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const skip = (page - 1) * limit;
  const sortOrder = isAsc ? 1 : -1;

  const [data, total] = await Promise.all([
    Comment.find({ company_id: companyId, suggestion: suggestionId })
      .populate("created_by", "first_name last_name email profile_picture role")
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    Comment.countDocuments({ company_id: companyId, suggestion: suggestionId }),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data,
  };
};

export const EditSuggestionService = async (
  req,
  suggestionId,
  updatedSuggestionData
) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const user = req.user;
  const existingSuggestion = await Suggestion.findOne({
    _id: suggestionId,
    company_id: companyId,
  });
  if (!existingSuggestion) {
    throw new AppError("Suggestion not found.", 400);
  }

  // Check if user is the post creator
  const postCreatorId = existingSuggestion.created_by;
  const isPostOwner =
    postCreatorId && String(postCreatorId) === String(user._id);

  // If not admin and not the owner, deny access
  if (user.role !== "admin" && !isPostOwner) {
    throw new AppError("You can only edit your own posts.", 403);
  }

  // If user is the owner (not admin), check if 15 minutes have passed
  if (isPostOwner && user.role !== "admin") {
    const postCreatedAt = new Date(existingSuggestion.createdAt);
    const now = new Date();
    const minutesSinceCreation = (now - postCreatedAt) / (1000 * 60);

    if (minutesSinceCreation > 15) {
      throw new AppError(
        "You can only edit your own posts within 15 minutes of creation.",
        403
      );
    }
  }

  if (Array.isArray(updatedSuggestionData.visible_to_departments)) {
    updatedSuggestionData.visible_to_departments =
      updatedSuggestionData.visible_to_departments.filter(
        (id) => !!id && mongoose.Types.ObjectId.isValid(id)
      );
  }

  const updatedSuggestion = await Suggestion.findOneAndUpdate(
    { _id: suggestionId, company_id: companyId },
    { ...updatedSuggestionData, updated_by: user._id },
    { new: true }
  );

  return updatedSuggestion;
};

export const GetSuggestionCategoriesService = async () => {
  try {
    const categoryEnum = Suggestion.schema.path("category").enumValues;
    return {
      categories: categoryEnum,
      count: categoryEnum.length,
    };
  } catch (error) {
    throw new AppError("Failed to fetch suggestion categories", 500);
  }
};

export const GetNotRespondedSuggestionsCountService = async (req) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const user = req.user;
  const filter = { company_id: companyId, is_responded: false };

  if (user.role === "admin") {
    // No filter needed
  } else if (user.role === "teamLead") {
    const team = await Team.findOne({
      _id: user.team,
      company_id: companyId,
    }).select("members");
    const memberIds =
      team?.members.map((id) => new mongoose.Types.ObjectId(id)) || [];
    filter.created_by = { $in: memberIds };
  } else {
    filter.created_by = user._id;
  }

  const count = await Suggestion.countDocuments(filter);
  return { count };
};

export const RespondToSuggestionService = async (
  req,
  suggestionId,
  message
) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const admin = req.user;
  const suggestion = await Suggestion.findOne({
    _id: suggestionId,
    company_id: companyId,
  })
    .populate({
      path: "created_by",
      select: "_id first_name last_name employee_id profile_picture team",
      populate: { path: "team", select: "name" },
    })
    .populate({
      path: "response.responded_by", // <-- populate the admin
      select: "_id first_name last_name profile_picture",
    });

  if (!suggestion) {
    throw new AppError("Suggestion not found", 400);
  }

  if (suggestion.is_responded) {
    throw new AppError("Suggestion has already been responded.", 400);
  }

  suggestion.response = {
    message,
    responded_by: admin._id, // <-- only store ObjectId now

    // responded_by: {
    //   _id: admin._id,
    //   first_name: admin.first_name,
    //   last_name: admin.last_name,
    //   profile_picture: admin.profile_picture,
    // },
    responded_at: new Date(),
  };
  suggestion.is_responded = true;
  await suggestion.save();

  const shouldHideIdentity = suggestion.is_identity_hidden;
  return {
    _id: suggestion._id,
    title: suggestion.title,
    description: suggestion.description,
    image: suggestion.image,
    created_by: shouldHideIdentity
      ? {
          _id: null,
          first_name: null,
          last_name: null,
          profile_picture: null,
          employee_id: null,
          team_name: null,
        }
      : {
          _id: suggestion.created_by?._id,
          first_name: suggestion.created_by?.first_name,
          last_name: suggestion.created_by?.last_name,
          profile_picture: suggestion.created_by?.profile_picture,
          employee_id: suggestion.created_by?.employee_id,
          team_name: suggestion.created_by?.team?.name || null,
        },
    updated_by: shouldHideIdentity ? null : suggestion.updated_by,
    category: suggestion.category,
    is_identity_hidden: suggestion.is_identity_hidden,
    is_responded: suggestion.is_responded,
    createdAt: suggestion.createdAt,
    updatedAt: suggestion.updatedAt,
    response: {
      message: suggestion.response.message,
      responded_by: suggestion.response.responded_by
        ? {
            _id: suggestion.response.responded_by._id,
            first_name: suggestion.response.responded_by.first_name,
            last_name: suggestion.response.responded_by.last_name,
            profile_picture: suggestion.response.responded_by.profile_picture,
          }
        : {
            _id: null,
            first_name: "Deleted",
            last_name: "User",
            profile_picture: null,
          },

      responded_at: suggestion.response.responded_at,
    },
  };
};
export const EditResponseToSuggestionService = async (
  req,
  suggestionId,
  message
) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const admin = req.user;
  const suggestion = await Suggestion.findOne({
    _id: suggestionId,
    company_id: companyId,
  });
  if (!suggestion) {
    throw new AppError("Suggestion not found", 404);
  }

  if (!suggestion.is_responded) {
    throw new AppError(
      "Cannot edit response. Suggestion has not been responded to yet.",
      400
    );
  }

  suggestion.response.message = message;
  suggestion.response.responded_at = new Date();
  suggestion.response.responded_by = {
    _id: admin._id,
    first_name: admin.first_name,
    last_name: admin.last_name,
    profile_picture: admin.profile_picture,
  };
  suggestion.updated_by = admin._id;

  const updated = await suggestion.save();

  return {
    _id: updated._id,
    title: updated.title,
    response: {
      message: updated.response.message,
      responded_by: suggestion.response.responded_by
        ? {
            _id: updated.response.responded_by._id,
            first_name: updated.response.responded_by.first_name,
            last_name: updated.response.responded_by.last_name,
            profile_picture: updated.response.responded_by.profile_picture,
          }
        : {
            _id: null,
            first_name: "Deleted",
            last_name: "User",
            profile_picture: null,
          },
      responded_at: updated.response.responded_at,
    },
    is_responded: updated.is_responded,
    updatedAt: updated.updatedAt,
  };
};
export const DeleteResponseFromSuggestionService = async (
  req,
  suggestionId
) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const admin = req.user;
  const suggestion = await Suggestion.findOne({
    _id: suggestionId,
    company_id: companyId,
  }).populate({
    path: "created_by",
    select: "_id first_name last_name",
  });

  if (!suggestion) {
    throw new AppError("Suggestion not found", 404);
  }

  if (!suggestion.is_responded) {
    throw new AppError("This suggestion has not been responded to.", 400);
  }

  // Clear the response
  suggestion.response = undefined;
  suggestion.is_responded = false;
  suggestion.updated_by = admin._id;

  const updated = await suggestion.save();

  return updated; // return full document so controller can access `created_by`, etc.
};

export const GetAllSuggestionsService = async (
  req,
  filter_type,
  start_date,
  end_date,
  page = 1,
  limit = 10,
  is_responded,
  is_visible_to_admin_only,
  search = "",
  category,
  department_id
) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const user = req.user;
  const parsedLimit = parseInt(limit);
  const parsedPage = parseInt(page);
  const skip = (parsedPage - 1) * parsedLimit;

  const isAdmin = user.role === "admin";

  let query = {};

  // 🔍 Search
  if (search) {
    const searchRegex = new RegExp(search, "i");

    const matchedUsers = await Users.find({
      company_id: companyId,
      $or: [
        { first_name: searchRegex },
        { last_name: searchRegex },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ["$first_name", " ", "$last_name"] },
              regex: searchRegex,
            },
          },
        },
      ],
    }).select("_id");

    const matchedUserIds = matchedUsers.map((u) => u._id);

    query.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { created_by: { $in: matchedUserIds } },
    ];
  }

  // 🏷️ Response filter
  if (typeof is_responded === "string") {
    if (is_responded.toLowerCase() === "true") query.is_responded = true;
    if (is_responded.toLowerCase() === "false") query.is_responded = false;
  }

  // 🔐 Admin-only filter
  if (isAdmin && typeof is_visible_to_admin_only === "string") {
    query.is_visible_to_admin_only = is_visible_to_admin_only === "true";
  }

  // 📂 Category filter
  if (category) query.category = category;

  // 📆 Date filters
  if (filter_type) {
    try {
      const now = new Date();
      const dateRange =
        filter_type === "custom_range"
          ? getDateRangeFromFilter(filter_type, start_date, end_date)
          : getDateRangeForTesting(filter_type, now);

      if (dateRange) {
        query.createdAt = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        };
      }
    } catch (error) {
      throw new AppError("Invalid date filter parameters", 400);
    }
  }

  // 👀 Visibility conditions
  query.$and = query.$and || [];

  if (isAdmin) {
    const visibilityConditions = [
      { is_visible_to_admin_only: true },
      {
        visible_to_departments: { $size: 0 },
        is_visible_to_admin_only: false,
      },
    ];

    if (department_id) {
      visibilityConditions.push({
        visible_to_departments: department_id,
        is_visible_to_admin_only: false,
      });
    } else {
      visibilityConditions.push({
        visible_to_departments: { $ne: [] },
        is_visible_to_admin_only: false,
      });
    }

    query.$and.push({ $or: visibilityConditions });
  } else {
    const userTeam = await Team.findOne({
      _id: user.team,
      company_id: companyId,
    }).populate("department");
    const deptId = userTeam?.department?._id;

    if (!deptId) throw new AppError("User department not found", 400);

    query.$and.push({
      $or: [
        {
          visible_to_departments: deptId,
          is_visible_to_admin_only: false,
        },
        {
          visible_to_departments: { $size: 0 },
          is_visible_to_admin_only: false,
        },
        {
          is_visible_to_admin_only: true,
          created_by: user._id,
        },
      ],
    });
  }

  // 📥 Fetch suggestions
  query.company_id = companyId;
  const rawSuggestions = await Suggestion.find(query)
    .populate(
      "created_by",
      "first_name last_name profile_picture employee_id role"
    )
    .populate("likes.user", "first_name last_name profile_picture role")
    .populate(
      "comments.created_by",
      "first_name last_name profile_picture role"
    )
    .populate(
      "response.responded_by",
      "first_name last_name profile_picture role"
    )
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parsedLimit);

  const suggestions = rawSuggestions.map((s) => {
    return {
      ...s.toObject(),
      likes: s.likes.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      ),
      comments: s.comments.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      ),
    };
  });

  const total = await Suggestion.countDocuments(query);
  const totalPages = Math.ceil(total / parsedLimit);
  const hasMorePages = parsedPage < totalPages;

  return {
    suggestions,
    total,
    currentPage: parsedPage,
    totalPages,
    hasMorePages,
  };
};

export const deleteSuggestion = async (req, suggestionId) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const userId = req.user._id;
  const role = req.user.role;
  const suggestion = await Suggestion.findOne({
    _id: suggestionId,
    company_id: companyId,
  });
  if (!suggestion) {
    throw new AppError("Suggestion not found", 404);
  }

  // Check if user is the post creator
  const postCreatorId = suggestion.created_by;
  const isPostOwner = postCreatorId && String(postCreatorId) === String(userId);

  // If not admin and not the owner, deny access
  if (role !== "admin" && !isPostOwner) {
    throw new AppError("You can only delete your own posts", 403);
  }

  // If user is the owner (not admin), check if 15 minutes have passed
  if (isPostOwner && role !== "admin") {
    const postCreatedAt = new Date(suggestion.createdAt);
    const now = new Date();
    const minutesSinceCreation = (now - postCreatedAt) / (1000 * 60);

    if (minutesSinceCreation > 15) {
      throw new AppError(
        "You can only delete your own posts within 15 minutes of creation",
        403
      );
    }
  }

  const result = await Suggestion.findOneAndDelete({
    _id: suggestionId,
    company_id: companyId,
  });
  return result;
};

const getDateRangeForTesting = (filter_type, now) => {
  let startDate, endDate;

  switch (filter_type) {
    case "this_week":
      const weekStart = new Date(now);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(
        weekStart.getDate() -
          (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1)
      );

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      startDate = weekStart;
      endDate = weekEnd;
      break;

    case "this_month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
      break;

    case "last_month":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;

    default:
      throw new Error("Invalid filter type");
  }

  return { startDate, endDate };
};

export const getCommentById = async (req, suggestionId, commentId) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const comment = await Comment.findOne({
    _id: commentId,
    company_id: companyId,
  }).lean();
  if (!comment) return null;

  // Ensure the comment belongs to the suggestion
  if (String(comment.suggestion) !== String(suggestionId)) return null;

  return comment;
};

export const getSuggestionById = async (req, suggestionId) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  if (!suggestionId || !mongoose.Types.ObjectId.isValid(suggestionId)) {
    throw new AppError("Suggestion ID is required", 400);
  }

  const suggestion = await Suggestion.findOne({
    _id: suggestionId,
    company_id: companyId,
  })
    .populate(
      "created_by",
      "first_name last_name email role team profile_picture"
    )
    .populate("visible_to_departments", "name")
    .populate("likes", "first_name last_name email profile_picture role")
    .lean();

  if (!suggestion) {
    throw new AppError("Suggestion not found", 404);
  }

  const [likes, comments] = await Promise.all([
    Like.find({ company_id: companyId, suggestion: suggestionId })
      .populate("user", "first_name last_name email profile_picture role")
      .sort({ created_at: -1 })
      .lean(),

    Comment.find({ company_id: companyId, suggestion: suggestionId })
      .populate("created_by", "first_name last_name email profile_picture role")
      .sort({ created_at: -1 })
      .lean(),
  ]);

  suggestion.likes = likes;
  suggestion.comments = comments;

  return suggestion;
};

export const GetSuggestionLikes = async (req, res) => {
  try {
    const { suggestionId } = req.params;

    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);

    const likes = await Like.find({
      company_id: companyId,
      suggestion: suggestionId,
    })
      .populate("user", "first_name last_name profile_picture role")
      .sort({ created_at: -1 });

    AppResponse({
      res,
      statusCode: 200,
      message: "Likes fetched successfully",
      data: likes,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetSuggestionComments = async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { page = 1, limit = 10, isAsc = "false" } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = isAsc === "true" ? 1 : -1;

    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);

    const [comments, total] = await Promise.all([
      Comment.find({ company_id: companyId, suggestion: suggestionId })
        .populate("created_by", "first_name last_name profile_picture role")
        .sort({ created_at: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Comment.countDocuments({
        company_id: companyId,
        suggestion: suggestionId,
      }),
    ]);

    AppResponse({
      res,
      statusCode: 200,
      message: "Comments fetched successfully",
      data: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
        data: comments,
      },
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetUserSuggestionsService = async (
  req,
  userId,
  filter_type,
  start_date,
  end_date,
  page = 1,
  limit = 10,
  is_responded
) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const requestingUserId = req.user._id;
  const requestingUserRole = req.user.role;
  const parsedLimit = parseInt(limit);
  const parsedPage = parseInt(page);
  const skip = (parsedPage - 1) * parsedLimit;

  let query = { company_id: companyId, created_by: userId };

  // Filter by response status
  if (typeof is_responded === "string") {
    if (is_responded.toLowerCase() === "true") query.is_responded = true;
    if (is_responded.toLowerCase() === "false") query.is_responded = false;
  }

  // Date filters
  if (filter_type) {
    try {
      const now = new Date();
      const dateRange =
        filter_type === "custom_range"
          ? getDateRangeFromFilter(filter_type, start_date, end_date)
          : getDateRangeForTesting(filter_type, now);

      if (dateRange) {
        query.createdAt = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        };
      }
    } catch (error) {
      throw new AppError("Invalid date filter parameters", 400);
    }
  }

  // Admin can see all suggestions of the user, including admin-only
  if (requestingUserRole !== "admin") {
    query.is_visible_to_admin_only = false;
  }

  // Fetch suggestions
  query.company_id = companyId;
  const rawSuggestions = await Suggestion.find(query)
    .populate(
      "created_by",
      "first_name last_name profile_picture employee_id role"
    )
    .populate("likes.user", "first_name last_name profile_picture role")
    .populate(
      "comments.created_by",
      "first_name last_name profile_picture role"
    )
    .populate(
      "response.responded_by",
      "first_name last_name profile_picture role"
    )
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parsedLimit);

  const suggestions = rawSuggestions.map((s) => ({
    ...s.toObject(),
    likes: s.likes.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    ),
    comments: s.comments.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    ),
  }));

  const total = await Suggestion.countDocuments(query);
  const totalPages = Math.ceil(total / parsedLimit);
  const hasMorePages = parsedPage < totalPages;

  return {
    suggestions,
    total,
    currentPage: parsedPage,
    totalPages,
    hasMorePages,
  };
};
