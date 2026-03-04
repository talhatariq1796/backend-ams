import * as MeetingRoomService from "../../services/requests/bookmeetingroom.service.js";
import { checkUserAuthorization } from "../../utils/getUserRole.util.js";
import { AppResponse } from "../../middlewares/error.middleware.js";
import { createLogsAndNotification } from "../../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../../constants/notificationTypes.js";

export const CreateBooking = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const booking = await MeetingRoomService.CreateBookingService(
      req,
      req.body,
    );

    if (booking) {
      const attendeeIds = booking.attendees
        .filter((att) => att._id.toString() !== req.user._id.toString())
        .map((att) => att._id);
      const meetingTitle = booking.title || "meeting";

      createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.MEETING_ROOM_BOOKING,
        message: `invited you to a ${meetingTitle} meeting.`,
        adminMessage: `booked a ${meetingTitle} meeting.`,
        notifyAdmins: true,
        moreUsers: attendeeIds,
      });
    }
    return AppResponse({
      res,
      statusCode: 201,
      message: "Booking created successfully",
      data: booking,
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

export const GetFilteredBookings = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const bookings_data = await MeetingRoomService.GetFilteredBookingsService(
      req,
      req.query,
    );
    return AppResponse({
      res,
      statusCode: 200,
      message: "Filtered bookings retrieved successfully",
      data: bookings_data,
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

export const UpdateBooking = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const updatedBooking = await MeetingRoomService.UpdateBookingService(
      req,
      req.params.id,
      req.body,
    );
    if (updatedBooking) {
      const attendeeIds = updatedBooking.attendees
        .filter((att) => att._id.toString() !== req.user._id.toString())
        .map((att) => att._id);
      const meetingTitle = updatedBooking.title || "meeting";
      createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.MEETING_ROOM_BOOKING,
        message: `updated the ${meetingTitle} details.`,
        adminMessage: `updated a ${meetingTitle} details.`,
        notifyAdmins: true,
        moreUsers: attendeeIds,
      });
    }
    return AppResponse({
      res,
      statusCode: 200,
      message: "Booking updated successfully",
      data: updatedBooking,
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

export const DeleteBooking = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const meeting = await MeetingRoomService.DeleteBookingService(
      req,
      req.params.id,
    );
    if (meeting) {
      // Populate attendees if they exist (they might be ObjectIds)
      let attendeeIds = [];
      if (meeting.attendees && meeting.attendees.length > 0) {
        // If attendees are populated objects, extract _id
        if (meeting.attendees[0]._id) {
          attendeeIds = meeting.attendees
            .filter((att) => att._id.toString() !== req.user._id.toString())
            .map((att) => att._id);
        } else {
          // If attendees are just ObjectIds
          attendeeIds = meeting.attendees.filter(
            (att) => att.toString() !== req.user._id.toString(),
          );
        }
      }
      const meetingTitle = meeting.title || "meeting";

      createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.MEETING_ROOM_BOOKING,
        message: `cancelled the ${meetingTitle} meeting.`,
        adminMessage: `cancelled a ${meetingTitle} meeting.`,
        notifyAdmins: true,
        moreUsers: attendeeIds,
        company_id: req.company_id,
      });
    }
    return AppResponse({
      res,
      statusCode: 200,
      message: "Meeting booking cancelled successfully",
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
export const GetUpcomingBooking = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const booking = await MeetingRoomService.GetUpcomingBookingService(req);

    if (!booking) {
      return AppResponse({
        res,
        statusCode: 200,
        message: "No upcoming booking found.",
        data: booking,
        success: true,
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Upcoming booking retrieved successfully",
      data: booking,
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
