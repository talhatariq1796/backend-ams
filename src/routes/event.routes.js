import express from "express";
import * as EventController from "../controllers/event.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const EventRouter = express.Router();

EventRouter.post(
  "/create-event",
  authenticateToken,
  EventController.CreateEvent
);
EventRouter.put(
  "/event/:eventId",
  authenticateToken,
  EventController.EditEvent
);

EventRouter.get(
  "/events",
  authenticateToken,
  EventController.GetFilteredEvents
);
EventRouter.get(
  "/event/categories",
  authenticateToken,
  EventController.GetEventCategoriesController
);
EventRouter.delete(
  "/event/delete",
  authenticateToken,
  EventController.DeleteEvent
);
EventRouter.get(
  "/celebrations",
  authenticateToken,
  EventController.GetUpcomingCelebrations
);
EventRouter.post(
  "/event/add-public-holidays",
  authenticateToken,
  EventController.AddPublicHolidaysController
);
EventRouter.get(
  "/celebrations/today",
  authenticateToken,
  EventController.GetTodayCelebrationAlerts
);

export { EventRouter };
