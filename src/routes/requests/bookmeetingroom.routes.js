import express from "express";
import * as BookMeetingRoomController from "../../controllers/requests/bookmeetingroom.controller.js";
import { authenticateToken } from "../../middlewares/user.middleware.js";

const BookMeetingRoomRouter = express.Router();

BookMeetingRoomRouter.post(
  "/book-meeting-room",
  authenticateToken,
  BookMeetingRoomController.CreateBooking
);
// BookMeetingRoomRouter.get(
//   "/meeting-room-bookings",
//   authenticateToken,
//   BookMeetingRoomController.GetAllBookings
// );
BookMeetingRoomRouter.get(
  "/meeting-room-bookings/filter",
  authenticateToken,
  BookMeetingRoomController.GetFilteredBookings
);

// BookMeetingRoomRouter.get(
//   "/meeting-room-bookings/:id",
//   authenticateToken,
//   BookMeetingRoomController.GetBookingById
// );

BookMeetingRoomRouter.put(
  "/meeting-room-bookings/:id",
  authenticateToken,
  BookMeetingRoomController.UpdateBooking
);

BookMeetingRoomRouter.delete(
  "/meeting-room-bookings/:id",
  authenticateToken,
  BookMeetingRoomController.DeleteBooking
);
BookMeetingRoomRouter.get(
  "/meeting-room-bookings/upcoming",
  authenticateToken,
  BookMeetingRoomController.GetUpcomingBooking
);

export { BookMeetingRoomRouter };
