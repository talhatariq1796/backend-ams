import * as EventService from "../services/event.service.js";
import { checkUserAuthorization, isAdmin } from "../utils/getUserRole.util.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";

export const CreateEvent = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const event = await EventService.CreateEventService(req.user, req.body);

    if (event.is_public) {
      if (event.is_public) {
        await createLogsAndNotification({
          notification_by: req.user._id,
          type: NOTIFICATION_TYPES.EVENT,
          message: `created an event ${event.title}`,
          notifyAdmins: false,
          notifyOthers: true,
        });
      }
    } else {
      await createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.EVENT,
        message: `created an event ${event.title}`,
        notifyAdmins: false,
      });
    }

    return AppResponse({
      res,
      statusCode: 201,
      message: "Event created successfully",
      data: event,
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
export const EditEvent = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { eventId } = req.params;
    const updatedEvent = await EventService.EditEventService(
      eventId,
      req.user,
      req.body
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Event updated successfully",
      data: updatedEvent,
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

export const GetFilteredEvents = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const events = await EventService.GetFilteredEventsService(
      req.user,
      req.query
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Events retrieved successfully",
      data: events,
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

export const GetEventCategoriesController = async (req, res, next) => {
  try {
    const categories = await EventService.GetEventCategoriesService();
    res.status(200).json({ success: true, categories });
  } catch (err) {
    next(err);
  }
};

export const DeleteEvent = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const { eventId } = req.query;
    if (!eventId) {
      throw new AppError("Event ID is required", 400);
    }

    const deletedEvent = await EventService.DeleteEventService(eventId);

    if (deletedEvent) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        // notification_to: userId,
        type: NOTIFICATION_TYPES.EVENT,
        message: `deleted event ${deletedEvent.name}`,
        notifyAdmins: false,
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Event deleted successfully",
      data: deletedEvent,
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

export const GetUpcomingCelebrations = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const { month } = req.query;
    const celebrations = await EventService.GetUpcomingCelebrationsService(
      month
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: `Upcoming birthdays and anniversaries retrieved successfully`,
      data: celebrations,
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

export const AddPublicHolidaysController = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const { year } = req.query;

    const result = await EventService.AddPublicHolidaysOfPakistanService(
      year,
      req.user
    );

    return AppResponse({
      res,
      statusCode: 201,
      message: result.message,
      data: null,
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

export const GetTodayCelebrationAlerts = async (req, res) => {
  try {
    const { scope = "department", excludeDepartments = "" } = req.query;

    const excludeArray = excludeDepartments
      ? excludeDepartments.split(",").map((id) => id.trim())
      : [];

    const data = await EventService.GetTodayCelebrationAlertsService({
      user: req.user,
      scope,
      excludeDepartments: excludeArray,
    });

    res.status(200).json({
      success: true,
      message: "Today's celebrations fetched successfully",
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};
