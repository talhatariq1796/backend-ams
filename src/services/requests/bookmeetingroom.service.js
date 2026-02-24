import MeetingRoom from "../../models/requests/bookmeetingroom.model.js";
import AppError from "../../middlewares/error.middleware.js";
import { getDateRangeFromFilter } from "../../utils/dateFilters.utils.js";
import mongoose from "mongoose";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

// Change this if your app should use another timezone
const APP_TZ = "Asia/Karachi";
export const CreateBookingService = async (user, meetingRoomBookingData) => {
  const {
    start_date,
    end_date,
    duration,
    time_slot,
    start_time,
    end_time,
    title,
    recurrence_type,
    recurrence_details,
    attendees,
    location,
    description,
  } = meetingRoomBookingData;

  if (recurrence_type === "none" && !start_date) {
    throw new AppError(
      "Start date is required for non-recurring bookings.",
      400
    );
  }
  if (
    recurrence_type === "weekly" &&
    (!end_date || !recurrence_details?.days?.length)
  ) {
    throw new AppError(
      "End date and selected days are required for weekly recurrence.",
      400
    );
  }
  if (
    recurrence_type === "monthly" &&
    (!recurrence_details?.date || !recurrence_details?.end_month)
  ) {
    throw new AppError(
      "Date of the month and end month are required for monthly recurrence.",
      400
    );
  }
  if (recurrence_type === "custom" && (!start_date || !end_date)) {
    throw new AppError(
      "Start and end date are required for custom recurrence.",
      400
    );
  }

  const bookingDates = [];
  if (recurrence_type === "none") {
    bookingDates.push(dayjs(start_date).format("YYYY-MM-DD"));
  } else if (recurrence_type === "weekly") {
    const start = dayjs(start_date);
    const end = dayjs(end_date);
    const daysOfWeek = recurrence_details.days.map((d) => d.toLowerCase());
    for (
      let date = start;
      date.isBefore(end) || date.isSame(end);
      date = date.add(1, "day")
    ) {
      if (daysOfWeek.includes(date.format("dddd").toLowerCase())) {
        bookingDates.push(date.format("YYYY-MM-DD"));
      }
    }
  } else if (recurrence_type === "monthly") {
    const dayOfMonth = recurrence_details.date;
    const endMonth = parseInt(recurrence_details.end_month);
    let date = dayjs(start_date);
    const currentMonth = date.month();
    for (let m = currentMonth; m <= endMonth; m++) {
      const monthDate = dayjs(`${date.year()}-${m + 1}-${dayOfMonth}`);
      if (monthDate.isValid()) {
        bookingDates.push(monthDate.format("YYYY-MM-DD"));
      }
    }
  } else if (recurrence_type === "custom") {
    const start = dayjs(start_date);
    const end = dayjs(end_date);
    for (
      let date = start;
      date.isBefore(end) || date.isSame(end);
      date = date.add(1, "day")
    ) {
      bookingDates.push(date.format("YYYY-MM-DD"));
    }
  }

  if (location === "meeting-room") {
    const conflict = await MeetingRoom.findOne({
      location: "meeting-room",
      start_date: { $in: bookingDates.map((d) => new Date(d)) },
      $or: [
        {
          start_time: { $lt: new Date(meetingRoomBookingData.end_time) },
          end_time: { $gt: new Date(meetingRoomBookingData.start_time) },
        },
      ],
    });
    if (conflict) {
      throw new AppError(
        "The meeting room is already booked for at least one of the selected date(s) and time slot.",
        400
      );
    }
  }

  const newBooking = new MeetingRoom({
    user: user._id,
    start_date,
    end_date,
    duration,
    time_slot,
    start_time,
    end_time,
    title,
    recurrence_type,
    recurrence_details,
    attendees,
    location,
    description,
  });

  await newBooking.save();

  const result = await MeetingRoom.findById(newBooking._id)
    .select(
      "start_date end_date duration time_slot start_time end_time title recurrence_details recurrence_type attendees location description"
    )
    .populate("attendees", "first_name last_name profile_picture")
    .populate("user", "first_name last_name");

  return result;
};

export const GetFilteredBookingsService = async (user, query) => {
  let filter = {};
  const { user_id, month, year, recurrence_type } = query;

  // For non-admin users, include meetings where they are organizer OR attendee
  if (user.role !== "admin") {
    filter.$or = [
      { user: new mongoose.Types.ObjectId(user._id) },
      { attendees: { $in: [new mongoose.Types.ObjectId(user._id)] } },
    ];
  } else if (user_id) {
    const targetUserId = mongoose.Types.ObjectId.isValid(user_id)
      ? new mongoose.Types.ObjectId(user_id)
      : user_id;
    filter.$or = [
      { user: targetUserId },
      { attendees: { $in: [targetUserId] } },
    ];
  }

  if (month && year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    filter.start_date = { $gte: startDate, $lte: endDate };
  }

  if (recurrence_type) {
    filter.recurrence_type = recurrence_type;
  }

  try {
    const bookings = await MeetingRoom.find(filter)
      .select(
        "start_date end_date duration time_slot start_time end_time title recurrence_details recurrence_type attendees location description user"
      )
      .populate("attendees", "_id first_name last_name profile_picture")
      .populate("user", "first_name last_name profile_picture")
      .sort({ start_date: -1, time_slot: -1 })
      .lean();

    return { bookings };
  } catch (error) {
    console.error("Error in GetFilteredBookingsService:", error);
    return {
      success: false,
      error: error.message,
      bookings: [],
    };
  }
};

export const UpdateBookingService = async (id, bookingData, user) => {
  const existingBooking = await MeetingRoom.findById(id);
  if (!existingBooking) throw new AppError("Booking not found", 400);

  if (
    user.role !== "admin" &&
    String(existingBooking.user) !== String(user._id)
  ) {
    throw new AppError("You are not authorized to update this booking.", 403);
  }

  const timeSlotChanged =
    bookingData.time_slot &&
    bookingData.time_slot !== existingBooking.time_slot;

  const recurrenceChanged =
    bookingData.start_date?.toString() !==
      existingBooking.start_date?.toString() ||
    bookingData.end_date?.toString() !== existingBooking.end_date?.toString() ||
    JSON.stringify(bookingData.recurrence_details || {}) !==
      JSON.stringify(existingBooking.recurrence_details || {});

  const locationChanged =
    bookingData.location && bookingData.location !== existingBooking.location;

  const locationToCheck = bookingData.location || existingBooking.location;

  const shouldCheckConflict =
    locationToCheck === "meeting-room" &&
    (timeSlotChanged || recurrenceChanged || locationChanged);

  if (shouldCheckConflict) {
    const recurrence_type =
      bookingData.recurrence_type || existingBooking.recurrence_type;
    const start_date = bookingData.start_date || existingBooking.start_date;
    const end_date = bookingData.end_date || existingBooking.end_date;
    const recurrence_details =
      bookingData.recurrence_details || existingBooking.recurrence_details;

    const bookingDates = [];
    const start = dayjs(start_date);
    const end = dayjs(end_date);

    if (recurrence_type === "none") {
      bookingDates.push(start.format("YYYY-MM-DD"));
    } else if (recurrence_type === "weekly") {
      const daysOfWeek = recurrence_details.days.map((d) => d.toLowerCase());
      for (
        let date = start;
        date.isBefore(end) || date.isSame(end);
        date = date.add(1, "day")
      ) {
        if (daysOfWeek.includes(date.format("dddd").toLowerCase())) {
          bookingDates.push(date.format("YYYY-MM-DD"));
        }
      }
    } else if (recurrence_type === "monthly") {
      const dayOfMonth = recurrence_details.date;
      const endMonth = parseInt(recurrence_details.end_month);
      const currentMonth = start.month();
      for (let m = currentMonth; m <= endMonth; m++) {
        const monthDate = dayjs(`${start.year()}-${m + 1}-${dayOfMonth}`);
        if (monthDate.isValid()) {
          bookingDates.push(monthDate.format("YYYY-MM-DD"));
        }
      }
    } else if (recurrence_type === "custom") {
      for (
        let date = start;
        date.isBefore(end) || date.isSame(end);
        date = date.add(1, "day")
      ) {
        bookingDates.push(date.format("YYYY-MM-DD"));
      }
    }

    const conflict = await MeetingRoom.findOne({
      _id: { $ne: id },
      location: "meeting-room",
      start_date: { $in: bookingDates.map((d) => new Date(d)) },
      $or: [
        {
          start_time: {
            $lt: new Date(bookingData.end_time || existingBooking.end_time),
          },
          end_time: {
            $gt: new Date(bookingData.start_time || existingBooking.start_time),
          },
        },
      ],
    });

    if (conflict) {
      throw new AppError(
        "The updated time slot conflicts with another existing booking.",
        400
      );
    }
  }

  const updatedBooking = await MeetingRoom.findByIdAndUpdate(id, bookingData, {
    new: true,
  })
    .populate("user", "_id first_name last_name profile_picture")
    .populate("attendees", "_id first_name last_name profile_picture");

  return updatedBooking;
};

export const DeleteBookingService = async (id) => {
  const booking = await MeetingRoom.findById(id)
    .populate("attendees", "_id first_name last_name profile_picture")
    .populate("user", "_id first_name last_name profile_picture");
  
  if (!booking) throw new AppError("Booking not found", 400);
  
  await MeetingRoom.findByIdAndDelete(id);
  return booking;
};

export const GetUpcomingBookingService = async (user) => {
  // Always get "now" in your chosen timezone
  const now = dayjs().tz(APP_TZ);
  const today = now.format("YYYY-MM-DD");
  const currentTimeFormatted = now.format("HH:mm");

  const bookings = await MeetingRoom.find({
    $or: [{ user }, { attendees: { $in: [user] } }],
  })
    .sort({ start_date: 1, time_slot: 1 })
    .lean();

  const upcomingBookings = [];

  for (const booking of bookings) {
    let nextOccurrence = null;

    const bookingDate = dayjs(booking.start_date)
      .tz(APP_TZ)
      .format("YYYY-MM-DD");

    // Parse time slot ("12:00 PM - 12:30 PM")
    const timeSlotMatch = booking.time_slot.match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)/i
    );
    if (!timeSlotMatch) continue;

    let [_, hours, minutes, period] = timeSlotMatch;
    hours = parseInt(hours);

    if (period.toLowerCase() === "pm" && hours < 12) hours += 12;
    if (period.toLowerCase() === "am" && hours === 12) hours = 0;

    const bookingTimeFormatted = `${hours
      .toString()
      .padStart(2, "0")}:${minutes}`;

    /** ---------- Handle recurrence types ---------- **/
    if (booking.recurrence_type === "none") {
      if (bookingDate > today) {
        nextOccurrence = booking.start_date;
      } else if (
        bookingDate === today &&
        bookingTimeFormatted > currentTimeFormatted
      ) {
        nextOccurrence = booking.start_date;
      }
    } else if (
      booking.recurrence_type === "weekly" &&
      booking.recurrence_details?.days?.length
    ) {
      const daysOfWeek = booking.recurrence_details.days.map((d) =>
        d.toLowerCase()
      );

      let currentDate = now;
      let foundNext = false;

      const maxCheckDays = booking.end_date
        ? Math.min(365, dayjs(booking.end_date).diff(currentDate, "day") + 1)
        : 365;

      for (let i = 0; i < maxCheckDays && !foundNext; i++) {
        const checkDate = currentDate.add(i, "day");
        const dayName = checkDate.format("dddd").toLowerCase();
        const checkDateStr = checkDate.format("YYYY-MM-DD");

        if (daysOfWeek.includes(dayName)) {
          const startDateStr = dayjs(booking.start_date)
            .tz(APP_TZ)
            .format("YYYY-MM-DD");
          const endDateStr = booking.end_date
            ? dayjs(booking.end_date).tz(APP_TZ).format("YYYY-MM-DD")
            : null;

          if (
            checkDateStr >= startDateStr &&
            (!endDateStr || checkDateStr <= endDateStr)
          ) {
            if (
              checkDateStr === today &&
              bookingTimeFormatted <= currentTimeFormatted
            ) {
              continue; // already passed today
            }

            const occurrenceDate = checkDate
              .hour(hours)
              .minute(parseInt(minutes))
              .second(0)
              .millisecond(0);
            nextOccurrence = occurrenceDate.toDate();
            foundNext = true;
          }
        }
      }
    } else if (
      booking.recurrence_type === "monthly" &&
      booking.recurrence_details?.date
    ) {
      const dayOfMonth = booking.recurrence_details.date;
      const endMonth = booking.recurrence_details.end_month
        ? parseInt(booking.recurrence_details.end_month)
        : null;

      let currentMonth = now.month();
      let currentYear = now.year();
      let foundNext = false;

      for (let monthOffset = 0; monthOffset < 12 && !foundNext; monthOffset++) {
        const targetMonth = currentMonth + monthOffset;
        const adjustedYear = currentYear + Math.floor(targetMonth / 12);
        const adjustedMonth = targetMonth % 12;

        const nextMonthDate = dayjs(
          `${adjustedYear}-${adjustedMonth + 1}-${dayOfMonth}`
        ).tz(APP_TZ);

        if (nextMonthDate.isValid()) {
          const checkDateStr = nextMonthDate.format("YYYY-MM-DD");

          if (
            checkDateStr > today ||
            (checkDateStr === today &&
              bookingTimeFormatted > currentTimeFormatted)
          ) {
            if (!endMonth || adjustedMonth <= endMonth) {
              const occurrenceDate = nextMonthDate
                .hour(hours)
                .minute(parseInt(minutes))
                .second(0)
                .millisecond(0);
              nextOccurrence = occurrenceDate.toDate();
              foundNext = true;
            }
          }
        }
      }
    } else if (booking.recurrence_type === "custom") {
      const startDate = dayjs(booking.start_date).tz(APP_TZ);
      const endDate = booking.end_date
        ? dayjs(booking.end_date).tz(APP_TZ)
        : null;

      let checkDate = now;

      if (checkDate.isBefore(startDate)) {
        checkDate = startDate;
      }

      if (
        checkDate.format("YYYY-MM-DD") === today &&
        bookingTimeFormatted <= currentTimeFormatted
      ) {
        checkDate = checkDate.add(1, "day");
      }

      if (!endDate || checkDate.isSameOrBefore(endDate)) {
        const occurrenceDate = checkDate
          .hour(hours)
          .minute(parseInt(minutes))
          .second(0)
          .millisecond(0);
        nextOccurrence = occurrenceDate.toDate();
      }
    }

    /** ---------- Final filter ---------- **/
    if (nextOccurrence) {
      const startDateTime = dayjs(booking.start_time).tz(APP_TZ);
      const endDateTime = dayjs(booking.end_time).tz(APP_TZ);

      if (endDateTime.isBefore(now)) continue; // already ended

      upcomingBookings.push({
        ...booking,
        nextOccurrence: startDateTime.toDate(),
      });
    }
  }

  upcomingBookings.sort((a, b) => a.nextOccurrence - b.nextOccurrence);

  if (upcomingBookings.length > 0) {
    const nextBooking = upcomingBookings[0];
    return {
      _id: nextBooking._id,
      start_date: nextBooking.nextOccurrence,
      start_time: nextBooking.start_time,
      end_time: nextBooking.end_time,
      duration: nextBooking.duration,
      time_slot: nextBooking.time_slot,
      title: nextBooking.title,
      recurrence_type: nextBooking.recurrence_type,
    };
  }

  return null;
};
