import { AppResponse } from "../middlewares/error.middleware.js";
import * as SuggestionService from "../services/suggestion.service.js";
import { checkUserAuthorization, isAdmin } from "../utils/getUserRole.util.js";
import AppError from "../middlewares/error.middleware.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import Notification from "../models/notification.model.js";

export const CreateSuggestion = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const {
      is_identity_hidden,
      visible_to_departments = [],
      is_public,
    } = req.body;

    const suggestion = await SuggestionService.CreateSuggestionService(
      req.user,
      req.body
    );

    if (suggestion) {
      // Determine who should be notified based on post visibility
      let notifyAdmins = false;
      let notifyOthers = false;
      let notifyDepartments = [];

      if (is_public) {
        // If post is public, notify all users
        notifyOthers = true;
      } else if (req.user.role === "admin") {
        // If admin created post for specific departments, notify those departments
        if (visible_to_departments && visible_to_departments.length > 0) {
          notifyDepartments = visible_to_departments;
        } else {
          // If admin created post without specific departments, notify all
          notifyOthers = true;
        }
      } else {
        // If regular user created post, notify admins and their department
        notifyAdmins = true;
        // Get user's department from the suggestion's visible_to_departments
        if (
          suggestion.visible_to_departments &&
          suggestion.visible_to_departments.length > 0
        ) {
          notifyDepartments = suggestion.visible_to_departments.map(
            (dept) => dept._id || dept
          );
        }
      }

      await createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `created a post.`,
        notifyAdmins,
        notifyOthers,
        notifyDepartments,
        hideNotificationIdentity: is_identity_hidden,
      });
    }

    AppResponse({
      res,
      statusCode: 201,
      message: "Suggestions created successfully",
      data: suggestion,
      success: true,
    });
  } catch (error) {
    AppResponse({
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

    // Fetch comment for notification before deleting
    const comment = await SuggestionService.getCommentById(
      suggestionId,
      commentId
    );
    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    // Check if user is the comment creator
    const isCommentOwner = String(comment.created_by) === String(req.user._id);

    // If not admin and not the owner, deny access
    if (req.user.role !== "admin" && !isCommentOwner) {
      throw new AppError("You can only delete your own comments", 403);
    }

    // If user is the owner (not admin), check if 15 minutes have passed
    if (isCommentOwner && req.user.role !== "admin") {
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

    await SuggestionService.deleteCommentService(
      suggestionId,
      commentId,
      req.user
    );

    // Notify comment author only if different from the user deleting the comment
    if (!isCommentOwner) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: comment.created_by,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `deleted your comment on a post.`,
      });
    }

    AppResponse({
      res,
      statusCode: 200,
      message: "Comment deleted successfully",
      success: true,
    });
  } catch (error) {
    AppResponse({
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
      suggestionId,
      req.user
    );

    if (message === "Successfully liked") {
      const suggestion = await SuggestionService.getSuggestionById(
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

        // Create new notification (this will send push notification via queue)
        await createLogsAndNotification({
          notification_by: req.user._id,
          notification_to: postCreatorId,
          type: NOTIFICATION_TYPES.SUGGESTIONS,
          message: `liked your post.`,
          notifyAdmins: false,
          hideNotificationIdentity: suggestion.is_identity_hidden,
        });
      }
    }

    AppResponse({
      res,
      statusCode: 200,
      message,
      success: true,
    });
  } catch (error) {
    AppResponse({
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
      suggestionId,
      req.user,
      text.trim()
    );

    const suggestion = await SuggestionService.getSuggestionById(suggestionId);

    // Get post creator ID (handle both populated and non-populated cases)
    const postCreatorId = suggestion?.created_by?._id || suggestion?.created_by;

    if (postCreatorId && String(postCreatorId) !== String(req.user._id)) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: postCreatorId,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `commented on your post.`,
        notifyAdmins: false,
        hideNotificationIdentity: suggestion.is_identity_hidden,
      });
    }

    AppResponse({
      res,
      statusCode: 200,
      message: "Comment added successfully",
      data: comment,
      success: true,
    });
  } catch (error) {
    AppResponse({
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

    // Fetch comment before update
    const originalComment = await SuggestionService.getCommentById(
      suggestionId,
      commentId
    );
    if (!originalComment) {
      throw new AppError("Comment not found", 404);
    }

    // Check if user is the comment creator
    const isCommentOwner =
      String(originalComment.created_by) === String(req.user._id);

    // If not admin and not the owner, deny access
    if (req.user.role !== "admin" && !isCommentOwner) {
      throw new AppError("You can only edit your own comments", 403);
    }

    // If user is the owner (not admin), check if 15 minutes have passed
    if (isCommentOwner && req.user.role !== "admin") {
      const commentCreatedAt = new Date(originalComment.createdAt);
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
      commentId,
      text,
      req.user
    );

    // Notify comment author (optional if different from admin)
    if (!isCommentOwner) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: originalComment.created_by,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `edited your comment on a post.`,
      });
    }

    AppResponse({
      res,
      statusCode: 200,
      message: "Comment updated successfully",
      data: updatedComment,
      success: true,
    });
  } catch (error) {
    AppResponse({
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
      suggestionId,
      parseInt(page),
      parseInt(limit),
      isAsc === "true"
    );

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
      suggestionId,
      parseInt(page),
      parseInt(limit),
      isAsc === "true"
    );

    AppResponse({
      res,
      statusCode: 200,
      message: "Comments fetched successfully",
      data: comments,
      success: true,
    });
  } catch (error) {
    AppResponse({
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

    AppResponse({
      res,
      statusCode: 200,
      message: "Visible suggestions retrieved successfully",
      data: suggestions,
      success: true,
    });
  } catch (error) {
    AppResponse({
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

    // Get the suggestion to check ownership and creation time
    const existingSuggestion = await SuggestionService.getSuggestionById(
      suggestionId
    );
    if (!existingSuggestion) {
      throw new AppError("Suggestion not found", 404);
    }

    // Check if user is the post creator
    const postCreatorId =
      existingSuggestion.created_by?._id || existingSuggestion.created_by;
    const isPostOwner =
      postCreatorId && String(postCreatorId) === String(req.user._id);

    // If not admin and not the owner, deny access
    if (req.user.role !== "admin" && !isPostOwner) {
      throw new AppError("You can only edit your own posts", 403);
    }

    // If user is the owner (not admin), check if 15 minutes have passed
    if (isPostOwner && req.user.role !== "admin") {
      const postCreatedAt = new Date(existingSuggestion.createdAt);
      const now = new Date();
      const minutesSinceCreation = (now - postCreatedAt) / (1000 * 60);

      if (minutesSinceCreation > 15) {
        throw new AppError(
          "You can only edit your own posts within 15 minutes of creation",
          403
        );
      }
    }

    const updatedSuggestion = await SuggestionService.EditSuggestionService(
      req.user,
      suggestionId,
      req.body
    );

    // Send notification if creator is known and admin edited someone else's post
    if (updatedSuggestion?.created_by?._id && !isPostOwner) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: updatedSuggestion.created_by._id,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `updated a post.`,
        notifyAdmins: false,
      });
    }

    AppResponse({
      res,
      statusCode: 200,
      message: "Suggestions updated successfully",
      data: updatedSuggestion,
      success: true,
    });
  } catch (error) {
    AppResponse({
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
      suggestionId,
      message,
      admin
    );

    const suggestion = await SuggestionService.getSuggestionById(suggestionId);

    // Determine who should be notified based on post visibility
    let notifyAdmins = false;
    let notifyOthers = false;
    let notifyDepartments = [];
    let notification_to = null;

    // Check if post has a creator and it's not the admin's own post
    const postCreatorId = suggestion.created_by?._id || suggestion.created_by;
    const shouldNotifyCreator =
      postCreatorId && String(postCreatorId) !== String(admin._id);

    if (shouldNotifyCreator) {
      notification_to = postCreatorId;

      if (suggestion.is_public) {
        // If post is public, notify all users (including the creator via notification_to)
        notifyOthers = true;
      } else if (
        suggestion.visible_to_departments &&
        suggestion.visible_to_departments.length > 0
      ) {
        // If post is for specific departments, notify all users in those departments
        notifyDepartments = suggestion.visible_to_departments.map(
          (dept) => dept._id || dept
        );
      }
      // If post is admin-only or has no specific visibility, only notify the creator
      // notification_to is already set above
    } else if (suggestion.is_public) {
      // Even if admin responded to their own post, if it's public, notify all users
      notifyOthers = true;
    } else if (
      suggestion.visible_to_departments &&
      suggestion.visible_to_departments.length > 0
    ) {
      // If admin responded to their own post but it's for specific departments, notify those departments
      notifyDepartments = suggestion.visible_to_departments.map(
        (dept) => dept._id || dept
      );
    }

    await createLogsAndNotification({
      notification_by: admin._id,
      notification_to,
      notifyAdmins,
      notifyOthers,
      notifyDepartments,
      type: NOTIFICATION_TYPES.SUGGESTIONS,
      message: `responded to a post.`,
      hideNotificationIdentity: suggestion.is_identity_hidden,
    });

    AppResponse({
      res,
      statusCode: 200,
      message: "Response sent successfully",
      data: response,
      success: true,
    });
  } catch (error) {
    AppResponse({
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
      suggestionId,
      message,
      req.user
    );

    AppResponse({
      res,
      statusCode: 200,
      message: "Response updated successfully",
      data: response,
      success: true,
    });
  } catch (error) {
    AppResponse({
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
        suggestionId,
        admin
      );

    if (String(updatedSuggestion.created_by._id) !== String(admin._id)) {
      await createLogsAndNotification({
        notification_by: admin._id,
        notification_to: updatedSuggestion.created_by._id,
        notifyDepartments: updatedSuggestion.visible_to_departments || [],
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: "removed their response to your post.",
        notifyAdmins: false,
        hideLogsIdentity: updatedSuggestion.is_identity_hidden,
      });
    }

    AppResponse({
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
    AppResponse({
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

    AppResponse({
      res,
      statusCode: 200,
      message: "Suggestion categories retrieved successfully",
      data: categories,
      success: true,
    });
  } catch (error) {
    AppResponse({
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
      userId,
      requestingUserId,
      requestingUserRole,
      filter_type,
      start_date,
      end_date,
      page,
      limit,
      is_responded
    );

    AppResponse({
      res,
      statusCode: 200,
      message: "Suggestions retrieved successfully",
      data: suggestions,
      success: true,
    });
  } catch (error) {
    AppResponse({
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
      req.user,
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

    AppResponse({
      res,
      statusCode: 200,
      message: "Suggestions retrieved successfully",
      data: response,
      success: true,
    });
  } catch (error) {
    AppResponse({
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

    const { suggestionId } = req.params;

    // Get the suggestion to check ownership and creation time
    const existingSuggestion = await SuggestionService.getSuggestionById(
      suggestionId
    );
    if (!existingSuggestion) {
      throw new AppError("Suggestion not found", 404);
    }

    // Check if user is the post creator
    const postCreatorId =
      existingSuggestion.created_by?._id || existingSuggestion.created_by;
    const isPostOwner =
      postCreatorId && String(postCreatorId) === String(req.user._id);

    // If not admin and not the owner, deny access
    if (req.user.role !== "admin" && !isPostOwner) {
      throw new AppError("You can only delete your own posts", 403);
    }

    // If user is the owner (not admin), check if 15 minutes have passed
    if (isPostOwner && req.user.role !== "admin") {
      const postCreatedAt = new Date(existingSuggestion.createdAt);
      const now = new Date();
      const minutesSinceCreation = (now - postCreatedAt) / (1000 * 60);

      if (minutesSinceCreation > 15) {
        throw new AppError(
          "You can only delete your own posts within 15 minutes of creation",
          403
        );
      }
    }

    const suggestion = await SuggestionService.deleteSuggestion(
      suggestionId,
      req.user._id,
      req.user.role
    );

    // Send notification if admin deleted someone else's post
    if (suggestion && !isPostOwner) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        notification_to: suggestion.created_by,
        type: NOTIFICATION_TYPES.SUGGESTIONS,
        message: `deleted post.`,
        notifyAdmins: false,
        hideLogsIdentity: suggestion.is_identity_hidden,
      });
    }

    AppResponse({
      res,
      statusCode: 200,
      message: "Suggestion deleted successfully",
      success: true,
    });
  } catch (error) {
    AppResponse({
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
      req.user
    );

    AppResponse({
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
