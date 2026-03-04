import express from "express";
import * as EventController from "../controllers/event.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const EventRouter = express.Router();

EventRouter.post(
  "/create-event",
  authenticateToken,
  requirePermission("manage_office_config"),
  EventController.CreateEvent
);
EventRouter.put(
  "/event/:eventId",
  authenticateToken,
  requirePermission("manage_office_config"),
  EventController.EditEvent
);

EventRouter.get(
  "/events",
  authenticateToken,
  requirePermission("view_reports"),
  EventController.GetFilteredEvents
);
EventRouter.get(
  "/event/categories",
  authenticateToken,
  requirePermission("view_reports"),
  EventController.GetEventCategoriesController
);
EventRouter.delete(
  "/event/delete",
  authenticateToken,
  requirePermission("manage_office_config"),
  EventController.DeleteEvent
);
EventRouter.get(
  "/celebrations",
  authenticateToken,
  requirePermission("view_reports"),
  EventController.GetUpcomingCelebrations
);
EventRouter.post(
  "/event/add-public-holidays",
  authenticateToken,
  requirePermission("manage_office_config"),
  EventController.AddPublicHolidaysController
);
EventRouter.get(
  "/celebrations/today",
  authenticateToken,
  requirePermission("view_reports"),
  EventController.GetTodayCelebrationAlerts
);

export { EventRouter };
