import express from "express";
import * as BookMeetingRoomController from "../../controllers/requests/bookmeetingroom.controller.js";
import { authenticateToken } from "../../middlewares/user.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";

const BookMeetingRoomRouter = express.Router();

BookMeetingRoomRouter.post(
  "/book-meeting-room",
  authenticateToken,
  requirePermission("can_book_meeting_room"),
  BookMeetingRoomController.CreateBooking
);
BookMeetingRoomRouter.get(
  "/meeting-room-bookings/filter",
  authenticateToken,
  requirePermission("view_meeting_room_bookings"),
  BookMeetingRoomController.GetFilteredBookings
);

BookMeetingRoomRouter.put(
  "/meeting-room-bookings/:id",
  authenticateToken,
  requirePermission("view_meeting_room_bookings"),
  BookMeetingRoomController.UpdateBooking
);

BookMeetingRoomRouter.delete(
  "/meeting-room-bookings/:id",
  authenticateToken,
  requirePermission("view_meeting_room_bookings"),
  BookMeetingRoomController.DeleteBooking
);
BookMeetingRoomRouter.get(
  "/meeting-room-bookings/upcoming",
  authenticateToken,
  requirePermission("view_meeting_room_bookings"),
  BookMeetingRoomController.GetUpcomingBooking
);

export { BookMeetingRoomRouter };
