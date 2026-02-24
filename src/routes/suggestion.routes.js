import express from "express";
import * as SuggestionController from "../controllers/suggestion.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const SuggestionRouter = express.Router();

// Create suggestion/post
SuggestionRouter.post(
  "/suggestion/create",
  authenticateToken,
  SuggestionController.CreateSuggestion
);

// Get suggestions by user
SuggestionRouter.get(
  "/suggestions/user/:userId",
  authenticateToken,
  SuggestionController.GetUserSuggestions
);

// Edit suggestion (Admin only)
SuggestionRouter.put(
  "/suggestion/:suggestionId",
  authenticateToken,
  SuggestionController.EditSuggestion
);

// Delete suggestion (Admin only)
SuggestionRouter.delete(
  "/suggestion/:suggestionId",
  authenticateToken,
  SuggestionController.DeleteSuggestion
);

// Get all suggestions (Admin only)
SuggestionRouter.get(
  "/suggestions",
  authenticateToken,
  SuggestionController.GetAllSuggestions
);

// Get suggestion categories
SuggestionRouter.get(
  "/suggestions/categories",
  authenticateToken,
  SuggestionController.GetSuggestionCategories
);

// Respond to a suggestion (admin)
SuggestionRouter.put(
  "/suggestions/respond/:suggestionId",
  authenticateToken,
  SuggestionController.RespondToSuggestion
);
// Edit response to suggestion (Admin only)
SuggestionRouter.put(
  "/suggestions/edit-response/:suggestionId",
  authenticateToken,
  SuggestionController.EditResponseToSuggestion
);
// Delete response to a suggestion (Admin only)
SuggestionRouter.delete(
  "/suggestions/delete-response/:suggestionId",
  authenticateToken,
  SuggestionController.DeleteResponseFromSuggestion
);

// Not responded count
SuggestionRouter.get(
  "/suggestion/not-responded-count",
  authenticateToken,
  SuggestionController.GetNotRespondedSuggestionsCount
);

SuggestionRouter.patch(
  "/suggestions/:suggestionId/toggle-like",
  authenticateToken,
  SuggestionController.ToggleLikeSuggestion
);

// Add a comment to suggestion/post
SuggestionRouter.post(
  "/suggestions/:suggestionId/comments",
  authenticateToken,
  SuggestionController.AddComment
);

// Delete a comment (Admin only)
SuggestionRouter.delete(
  "/suggestions/:suggestionId/comments/:commentId",
  authenticateToken,
  SuggestionController.DeleteComment
);

// Edit a comment (Admin only)
SuggestionRouter.put(
  "/suggestions/:suggestionId/comments/:commentId",
  authenticateToken,
  SuggestionController.EditComment
);
// Get likes for a suggestion
SuggestionRouter.get(
  "/suggestions/:suggestionId/likes",
  authenticateToken,
  SuggestionController.GetLikesForSuggestion
);

// Get comments for a suggestion
SuggestionRouter.get(
  "/suggestions/:suggestionId/comments",
  authenticateToken,
  SuggestionController.GetCommentsForSuggestion
);

// Get visible suggestions with filtering (includes category filter)
SuggestionRouter.get(
  "/suggestions/visible",
  authenticateToken,
  SuggestionController.GetVisibleSuggestions
);

export { SuggestionRouter };
