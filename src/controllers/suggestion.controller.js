import { AppResponse } from "../middlewares/error.middleware.js";
import * as SuggestionService from "../services/suggestion.service.js";
import { checkUserAuthorization, isAdmin } from "../utils/getUserRole.util.js";
import { hasPermissionAsync } from "../utils/checkPermission.util.js";
import AppError from "../middlewares/error.middleware.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import Notification from "../models/notification.model.js";
import { getCompanyId } from "../utils/company.util.js";
import Suggestion from "../models/suggestion.model.js";

export const CreateSuggestion = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const {
      is_identity_hidden,
      visible_to_departments = [],
      is_public,
    } = req.body;

    const suggestion = await SuggestionService.CreateSuggestionService(
      req,
      req.body
    );

    if (suggestion) {
      const companyId = getCompanyId(req);
      const departmentsToNotify = suggestion.visible_to_departments || [];
      const departmentIds = departmentsToNotify.map((dept) =>
        typeof dept === "object" && dept._id ? dept._id : dept
      );
      const hasSelectedDepartments = departmentIds.length > 0;
      const isPublicOrAdminOnly = !hasSelectedDepartments;

      createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `created a post.`,
        notifyAdmins: req.user.role !== "admin" && isPublicOrAdminOnly,
        notifyOthers: false,
        notifyDepartments: hasSelectedDepartments ? departmentIds : [],
        hideNotificationIdentity: is_identity_hidden,
        company_id: companyId,
      });
    }

    return AppResponse({
      res,
      statusCode: 201,
      message: "Suggestions created successfully",
      data: suggestion,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode,
      message: error.message,
      success: false,
    });
  }
};

export const DeleteComment = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { suggestionId, commentId } = req.params;

    const comment = await SuggestionService.getCommentById(
      req,
      suggestionId,
      commentId
    );
    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    const canDeleteAny = await hasPermissionAsync(req, "delete_any_post_comment");
    const canDeleteOwn = await hasPermissionAsync(req, "delete_own_post_comment");
    const isOwnComment = String(comment.created_by) === String(req.user._id);
    if (!canDeleteAny && !(canDeleteOwn && isOwnComment)) {
      throw new AppError("You do not have permission to delete this comment", 403);
    }

    // If user is the owner (not admin), enforce 15-minute deletion window
    if (isOwnComment && !canDeleteAny && req.user.role !== "admin") {
      const commentCreatedAt = new Date(comment.createdAt);
      const now = new Date();
      const minutesSinceCreation = (now - commentCreatedAt) / (1000 * 60);
      if (minutesSinceCreation > 15) {
        throw new AppError(
          "You can only delete your own comments within 15 minutes of creation",
          403
        );
      }
    }

    await SuggestionService.deleteCommentService(req, suggestionId, commentId);

    if (!isOwnComment) {
      createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: comment.created_by,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `deleted your comment on a post.`,
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Comment deleted successfully",
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

export const ToggleLikeSuggestion = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const { suggestionId } = req.params;

    const message = await SuggestionService.toggleLikeSuggestionService(
      req,
      suggestionId
    );

    if (message === "Successfully liked") {
      const suggestion = await SuggestionService.getSuggestionById(
        req,
        suggestionId
      );

      // Get post creator ID (handle both populated and non-populated cases)
      const postCreatorId =
        suggestion?.created_by?._id || suggestion?.created_by;

      if (postCreatorId && String(postCreatorId) !== String(req.user._id)) {
        // Delete existing notification if any to avoid duplicates
        // Then create a new one to ensure push notification is sent
        await Notification.deleteMany({
          notification_by: req.user._id,
          notification_to: postCreatorId,
          type: NOTIFICATION_TYPES.SUGGESTIONS,
          message: "liked your post.",
        });

        const companyId = getCompanyId(req);
        createLogsAndNotification({
          notification_by: req.user._id,
          notification_to: postCreatorId,
          type: NOTIFICATION_TYPES.SUGGESTIONS,
          message: `liked your post.`,
          notifyAdmins: false,
          hideNotificationIdentity: suggestion.is_identity_hidden,
          ...(companyId && { company_id: companyId }),
        });
      }
    }

    return AppResponse({
      res,
      statusCode: 200,
      message,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Internal server error",
      success: false,
    });
  }
};

export const AddComment = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    if (!req.user?._id || !req.user?.role) {
      throw new AppError("Invalid user session", 401);
    }

    const { suggestionId } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length < 1) {
      throw new AppError("Comment text cannot be empty", 400);
    }

    const comment = await SuggestionService.addCommentToSuggestionService(
      req,
      suggestionId,
      text.trim()
    );

    const suggestion = await SuggestionService.getSuggestionById(
      req,
      suggestionId
    );

    const postCreatorId = suggestion?.created_by?._id || suggestion?.created_by;
    if (postCreatorId && String(postCreatorId) !== String(req.user._id)) {
      const companyId = getCompanyId(req);
      createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: postCreatorId,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `commented on your post.`,
        notifyAdmins: false,
        hideNotificationIdentity: suggestion.is_identity_hidden,
        ...(companyId && { company_id: companyId }),
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Comment added successfully",
      data: comment,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Something went wrong",
      success: false,
    });
  }
};

export const EditComment = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { suggestionId, commentId } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length < 1) {
      throw new AppError("Comment text cannot be empty", 400);
    }

    const comment = await SuggestionService.getCommentById(
      req,
      suggestionId,
      commentId
    );
    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    const canEditAny = await hasPermissionAsync(req, "edit_any_post_comment");
    const canEditOwn = await hasPermissionAsync(req, "edit_own_post_comment");
    const isOwnComment = String(comment.created_by) === String(req.user._id);
    if (!canEditAny && !(canEditOwn && isOwnComment)) {
      throw new AppError("You do not have permission to edit this comment", 403);
    }

    if (isOwnComment && !canEditAny && req.user.role !== "admin") {
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

    const updatedComment = await SuggestionService.editCommentService(
      req,
      commentId,
      text
    );

    if (String(comment.created_by) !== String(req.user._id)) {
      createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: comment.created_by,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `edited your comment on a post.`,
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Comment updated successfully",
      data: updatedComment,
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
export const GetLikesForSuggestion = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const { suggestionId } = req.params;
    const { page = 1, limit = 10, isAsc = "false" } = req.query;

    const likes = await SuggestionService.getLikesBySuggestionId(
      req,
      suggestionId,
      parseInt(page),
      parseInt(limit),
      isAsc === "true"
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Likes fetched successfully",
      data: likes,
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

export const GetCommentsForSuggestion = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const { suggestionId } = req.params;
    const { page = 1, limit = 10, isAsc = "false" } = req.query;

    const comments = await SuggestionService.getCommentsBySuggestionId(
      req,
      suggestionId,
      parseInt(page),
      parseInt(limit),
      isAsc === "true"
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Comments fetched successfully",
      data: comments,
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

export const GetVisibleSuggestions = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { department_id, page = 1, limit = 10, category } = req.query;

    const suggestions = await SuggestionService.GetVisibleSuggestionsService(
      req.user,
      department_id,
      page,
      limit,
      category
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Visible suggestions retrieved successfully",
      data: suggestions,
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

export const EditSuggestion = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { suggestionId } = req.params;
    const suggestion = await Suggestion.findById(suggestionId)
      .select("created_by createdAt")
      .lean();
    if (!suggestion) {
      throw new AppError("Suggestion not found", 404);
    }

    const canEditAny = await hasPermissionAsync(req, "edit_any_post");
    const canEditOwn = await hasPermissionAsync(req, "edit_own_post");
    const isOwn = String(suggestion.created_by) === String(req.user._id);
    if (!canEditAny && !(canEditOwn && isOwn)) {
      throw new AppError("You do not have permission to edit this post", 403);
    }

    if (isOwn && !canEditAny && req.user.role !== "admin") {
      const postCreatedAt = new Date(suggestion.createdAt);
      const minutesSinceCreation = (Date.now() - postCreatedAt) / (1000 * 60);
      if (minutesSinceCreation > 15) {
        throw new AppError(
          "You can only edit your own posts within 15 minutes of creation",
          403
        );
      }
    }

    const updatedSuggestion = await SuggestionService.EditSuggestionService(
      req,
      suggestionId,
      req.body
    );

    if (updatedSuggestion?.created_by?._id && !isOwn) {
      createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: updatedSuggestion.created_by._id,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `updated a post.`,
        notifyAdmins: false,
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Suggestions updated successfully",
      data: updatedSuggestion,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Something went wrong",
      success: false,
    });
  }
};

export const RespondToSuggestion = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const { suggestionId } = req.params;
    const { message } = req.body;
    const admin = req.user;

    if (!message || message.trim().length < 3) {
      throw new AppError(
        "Response message is required and must be meaningful.",
        400
      );
    }

    const response = await SuggestionService.RespondToSuggestionService(
      req,
      suggestionId,
      message
    );

    const suggestion = await SuggestionService.getSuggestionById(
      req,
      suggestionId
    );
    const companyId = getCompanyId(req);
    if (
      suggestion?.created_by?._id &&
      String(suggestion.created_by._id) !== String(admin._id)
    ) {
      createLogsAndNotification({
        notification_by: admin._id,
        notification_to: suggestion.created_by._id,
        notifyDepartments: suggestion.visible_to_departments || [],
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `responded to a post.`,
        ...(companyId && { company_id: companyId }),
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Response sent successfully",
      data: response,
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
export const EditResponseToSuggestion = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const { suggestionId } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length < 3) {
      throw new AppError("Response message must be meaningful", 400);
    }

    const response = await SuggestionService.EditResponseToSuggestionService(
      req,
      suggestionId,
      message
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Response updated successfully",
      data: response,
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
export const DeleteResponseFromSuggestion = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const { suggestionId } = req.params;
    const admin = req.user;

    const updatedSuggestion =
      await SuggestionService.DeleteResponseFromSuggestionService(
        req,
        suggestionId
      );

    // Only send notification if created_by exists and is not the admin
    if (
      updatedSuggestion?.created_by?._id &&
      String(updatedSuggestion.created_by._id) !== String(admin._id)
    ) {
      createLogsAndNotification({
        notification_by: admin._id,
        notification_to: updatedSuggestion.created_by._id,
        notifyDepartments: updatedSuggestion.visible_to_departments || [],
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: "removed their response to your post.",
        notifyAdmins: false,
        hideLogsIdentity: updatedSuggestion.is_identity_hidden,
        company_id: req.company_id,
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Response deleted successfully",
      data: {
        _id: updatedSuggestion._id,
        title: updatedSuggestion.title,
        is_responded: updatedSuggestion.is_responded,
        updatedAt: updatedSuggestion.updatedAt,
      },
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

export const GetSuggestionCategories = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const categories = await SuggestionService.GetSuggestionCategoriesService();

    return AppResponse({
      res,
      statusCode: 200,
      message: "Suggestion categories retrieved successfully",
      data: categories,
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

export const GetUserSuggestions = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { userId } = req.params;
    const { filter_type, start_date, end_date, page, limit, is_responded } =
      req.query;
    const requestingUserId = req.user._id;
    const requestingUserRole = req.user.role;

    if (
      requestingUserRole !== "admin" &&
      requestingUserId.toString() !== userId.toString()
    ) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    if (!userId) {
      throw new AppError("UserID is required", 400);
    }

    const suggestions = await SuggestionService.GetUserSuggestionsService(
      req,
      userId,
      filter_type,
      start_date,
      end_date,
      page,
      limit,
      is_responded
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Suggestions retrieved successfully",
      data: suggestions,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Internal Server Error",
      success: false,
    });
  }
};

export const GetAllSuggestions = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const {
      filter_type,
      start_date,
      end_date,
      page = 1,
      limit = 10,
      is_responded,
      is_visible_to_admin_only,
      search = "",
      category,
      department_id,
    } = req.query;

    const response = await SuggestionService.GetAllSuggestionsService(
      req,
      filter_type,
      start_date,
      end_date,
      page,
      limit,
      is_responded,
      is_visible_to_admin_only,
      search,
      category,
      department_id
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Suggestions retrieved successfully",
      data: response,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Something went wrong",
      success: false,
    });
  }
};

export const DeleteSuggestion = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const suggestionDoc = await Suggestion.findById(req.params.suggestionId)
      .select("created_by createdAt")
      .lean();
    if (!suggestionDoc) {
      throw new AppError("Suggestion not found", 404);
    }

    const canDeleteAny = await hasPermissionAsync(req, "delete_any_post");
    const canDeleteOwn = await hasPermissionAsync(req, "delete_own_post");
    const isOwn = String(suggestionDoc.created_by) === String(req.user._id);
    if (!canDeleteAny && !(canDeleteOwn && isOwn)) {
      throw new AppError("You do not have permission to delete this post", 403);
    }

    if (isOwn && !canDeleteAny && req.user.role !== "admin") {
      const postCreatedAt = new Date(suggestionDoc.createdAt);
      const minutesSinceCreation = (Date.now() - postCreatedAt) / (1000 * 60);
      if (minutesSinceCreation > 15) {
        throw new AppError(
          "You can only delete your own posts within 15 minutes of creation",
          403
        );
      }
    }

    const suggestion = await SuggestionService.deleteSuggestion(
      req,
      req.params.suggestionId
    );

    const creatorId = suggestion?.created_by?._id || suggestion?.created_by;
    if (suggestion && creatorId && String(creatorId) !== String(req.user._id)) {
      createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: creatorId,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `deleted post.`,
        notifyAdmins: false,
        hideLogsIdentity: suggestion.is_identity_hidden,
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Suggestion deleted successfully",
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

export const GetNotRespondedSuggestionsCount = async (req, res, next) => {
  try {
    checkUserAuthorization(req.user);

    const data = await SuggestionService.GetNotRespondedSuggestionsCountService(
      req
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Not responded suggestions count fetched successfully",
      data,
      success: true,
    });
  } catch (error) {
    next(error);
  }
};
