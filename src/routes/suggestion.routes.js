import express from "express";
import * as SuggestionController from "../controllers/suggestion.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission, requireAnyPermission } from "../middlewares/permission.middleware.js";

const SuggestionRouter = express.Router();

SuggestionRouter.post(
  "/suggestion/create",
  authenticateToken,
  requirePermission("create_post"),
  SuggestionController.CreateSuggestion
);

SuggestionRouter.get(
  "/suggestions/user/:userId",
  authenticateToken,
  requirePermission("view_posts"),
  SuggestionController.GetUserSuggestions
);

SuggestionRouter.put(
  "/suggestion/:suggestionId",
  authenticateToken,
  requireAnyPermission(["edit_own_post", "edit_any_post"]),
  SuggestionController.EditSuggestion
);

SuggestionRouter.delete(
  "/suggestion/:suggestionId",
  authenticateToken,
  requireAnyPermission(["delete_own_post", "delete_any_post"]),
  SuggestionController.DeleteSuggestion
);

SuggestionRouter.get(
  "/suggestions",
  authenticateToken,
  requirePermission("view_all_posts"),
  SuggestionController.GetAllSuggestions
);

SuggestionRouter.get(
  "/suggestions/categories",
  authenticateToken,
  requirePermission("view_post_categories"),
  SuggestionController.GetSuggestionCategories
);

SuggestionRouter.put(
  "/suggestions/respond/:suggestionId",
  authenticateToken,
  requirePermission("respond_to_post"),
  SuggestionController.RespondToSuggestion
);
SuggestionRouter.put(
  "/suggestions/edit-response/:suggestionId",
  authenticateToken,
  requirePermission("respond_to_post"),
  SuggestionController.EditResponseToSuggestion
);
SuggestionRouter.delete(
  "/suggestions/delete-response/:suggestionId",
  authenticateToken,
  requirePermission("respond_to_post"),
  SuggestionController.DeleteResponseFromSuggestion
);

SuggestionRouter.get(
  "/suggestion/not-responded-count",
  authenticateToken,
  requirePermission("view_not_responded_posts_count"),
  SuggestionController.GetNotRespondedSuggestionsCount
);

SuggestionRouter.patch(
  "/suggestions/:suggestionId/toggle-like",
  authenticateToken,
  requirePermission("like_post"),
  SuggestionController.ToggleLikeSuggestion
);

SuggestionRouter.post(
  "/suggestions/:suggestionId/comments",
  authenticateToken,
  requirePermission("add_post_comment"),
  SuggestionController.AddComment
);

SuggestionRouter.delete(
  "/suggestions/:suggestionId/comments/:commentId",
  authenticateToken,
  requireAnyPermission(["delete_own_post_comment", "delete_any_post_comment"]),
  SuggestionController.DeleteComment
);

SuggestionRouter.put(
  "/suggestions/:suggestionId/comments/:commentId",
  authenticateToken,
  requireAnyPermission(["edit_own_post_comment", "edit_any_post_comment"]),
  SuggestionController.EditComment
);
SuggestionRouter.get(
  "/suggestions/:suggestionId/likes",
  authenticateToken,
  requirePermission("view_post_likes"),
  SuggestionController.GetLikesForSuggestion
);

SuggestionRouter.get(
  "/suggestions/:suggestionId/comments",
  authenticateToken,
  requirePermission("view_post_comments"),
  SuggestionController.GetCommentsForSuggestion
);

SuggestionRouter.get(
  "/suggestions/visible",
  authenticateToken,
  requirePermission("view_posts"),
  SuggestionController.GetVisibleSuggestions
);

export { SuggestionRouter };
