import Event from "../models/event.model.js";
import AppError from "../middlewares/error.middleware.js";
import mongoose from "mongoose";
import Users from "../models/user.model.js";
import axios from "axios";
import Departments from "../models/department.model.js";
import Teams from "../models/team.model.js";
import dayjs from "dayjs";
import Suggestion from "../models/suggestion.model.js";

import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

// Enable timezone plugins
dayjs.extend(utc);
dayjs.extend(timezone);
export const CreateEventService = async (user, data) => {
  const {
    title,
    date,
    start_time,
    end_time,
    is_all_day,
    description,
    is_public,
    category,
  } = data;

  if (!title || !date || !category) {
    throw new AppError("Title, event date, and category are required", 400);
  }

  const eventDate = new Date(date);
  const startTimeDate = start_time ? new Date(start_time) : null;
  const endTimeDate = end_time ? new Date(end_time) : null;
  const conflict = await Event.findOne({
    category: "office-event",
    $or: [
      {
        start_time: { $lt: endTimeDate },
        end_time: { $gt: startTimeDate },
      },
      {
        is_all_day: true,
        date: eventDate,
      },
    ],
  });

  if (conflict) {
    throw new AppError(
      "An office event already exists during the selected time slot.",
      409
    );
  }

  const newEvent = new Event({
    user_id: user._id,
    title,
    date: eventDate,
    start_time: startTimeDate,
    end_time: endTimeDate,
    is_all_day,
    description,
    is_public,
    category,
  });

  await newEvent.save();

  return newEvent;
};
// services/event.service.js
export const EditEventService = async (eventId, user, updatedData) => {
  const existingEvent = await Event.findById(eventId);
  if (!existingEvent) {
    throw new AppError("Event not found", 404);
  }

  if (
    user.role !== "admin" &&
    String(existingEvent.user_id) !== String(user._id)
  ) {
    throw new AppError("You are not authorized to edit this event.", 403);
  }

  // Optional conflict check for office-events only
  if (
    updatedData.category === "office-event" &&
    (updatedData.start_time || updatedData.end_time || updatedData.date)
  ) {
    const startTimeDate = updatedData.start_time
      ? new Date(updatedData.start_time)
      : existingEvent.start_time;
    const endTimeDate = updatedData.end_time
      ? new Date(updatedData.end_time)
      : existingEvent.end_time;
    const eventDate = updatedData.date
      ? new Date(updatedData.date)
      : existingEvent.date;

    const conflict = await Event.findOne({
      _id: { $ne: eventId },
      category: "office-event",
      $or: [
        {
          start_time: { $lt: endTimeDate },
          end_time: { $gt: startTimeDate },
        },
        {
          is_all_day: true,
          date: eventDate,
        },
      ],
    });

    if (conflict) {
      throw new AppError(
        "Another office event conflicts with the new timing.",
        409
      );
    }
  }

  // Apply updated values
  Object.assign(existingEvent, updatedData);
  const saved = await existingEvent.save();
  return saved;
};

export const GetFilteredEventsService = async (user, query) => {
  const { month, year, is_public, category, title } = query;

  const filter = {};

  // For non-admin users, include:
  // 1. Public events
  // 2. Events created by the user
  // 3. Events where the user is an attendee
  if (user.role !== "admin") {
    filter.$or = [
      { is_public: true },
      { user_id: new mongoose.Types.ObjectId(user._id) },
      { attendees: { $in: [new mongoose.Types.ObjectId(user._id)] } },
    ];
  } else if (query.hasOwnProperty("is_public")) {
    filter.is_public = is_public === "true";
  }

  if ((month && !year) || (!month && year)) {
    throw new Error("Both 'month' and 'year' must be provided together");
  }

  if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    filter.date = { $gte: start, $lte: end };
  }

  if (category) {
    filter.category = category;
  }
  if (title) {
    filter.title = { $regex: title, $options: "i" };
  }

  const events = await Event.find(filter);
  return events;
};

export const GetEventCategoriesService = async () => {
  const enumValues = Event.schema.path("category").enumValues;
  return enumValues;
};

export const DeleteEventService = async (eventId) => {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    throw new AppError("Invalid event ID", 400);
  }

  const deletedEvent = await Event.findByIdAndDelete(eventId);

  if (!deletedEvent) {
    throw new AppError("Event not found", 404);
  }

  return deletedEvent;
};

export const GetUpcomingCelebrationsService = async (month) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const filterMonth = month ? parseInt(month) : currentMonth;

    if (isNaN(filterMonth) || filterMonth < 1 || filterMonth > 12) {
      throw new AppError("Month must be a number between 1 and 12", 400);
    }

    const users = await Users.find({
      is_active: true,
      $or: [
        { date_of_birth: { $exists: true } },
        { joining_date: { $exists: true } },
      ],
    }).select(
      "first_name last_name profile_picture employee_id date_of_birth joining_date designation"
    );

    if (!users || users.length === 0) {
      throw new AppError("No user records found for celebrations", 404);
    }

    const birthdays = [];
    const anniversaries = [];

    users.forEach((user) => {
      const { date_of_birth, joining_date } = user;

      if (date_of_birth) {
        const dob = new Date(date_of_birth);
        if (dob.getMonth() + 1 === filterMonth) {
          birthdays.push({
            type: "birthday",
            date: new Date(currentYear, dob.getMonth(), dob.getDate()),
            user,
          });
        }
      }

      if (joining_date) {
        const jd = new Date(joining_date);
        if (jd.getMonth() + 1 === filterMonth) {
          const yearsCompleted = currentYear - jd.getFullYear();
          if (yearsCompleted >= 1) {
            anniversaries.push({
              type: "anniversary",
              date: new Date(currentYear, jd.getMonth(), jd.getDate()),
              user,
              year: yearsCompleted,
            });
          }
        }
      }
    });

    birthdays.sort((a, b) => a.date - b.date);
    anniversaries.sort((a, b) => a.date - b.date);

    const startOfMonth = new Date(currentYear, filterMonth - 1, 1);
    const endOfMonth = new Date(currentYear, filterMonth, 0, 23, 59, 59, 999);

    const rawEvents = await Event.find({
      date: { $gte: startOfMonth, $lte: endOfMonth },
    }).populate(
      "user_id",
      "first_name last_name profile_picture employee_id designation"
    );

    const events = rawEvents.map((event) => {
      const eventObj = event.toObject();
      return {
        ...eventObj,
        user: eventObj.user_id,
        user_id: undefined,
      };
    });

    return {
      birthdays,
      anniversaries,
      events,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || "Failed to retrieve celebrations", 500);
  }
};

export const AddPublicHolidaysOfPakistanService = async (year, adminUser) => {
  const API_KEY = process.env.CALENDARIFIC_API_KEY;
  const COUNTRY = "PK";

  try {
    if (!year) year = new Date().getFullYear();

    const { data } = await axios.get(
      "https://calendarific.com/api/v2/holidays",
      {
        params: {
          api_key: API_KEY,
          country: COUNTRY,
          year,
          type: "national",
        },
      }
    );

    const holidays = data?.response?.holidays || [];

    if (holidays.length === 0) {
      throw new AppError("No holidays found from API", 404);
    }

    const holidayEvents = holidays.map((holiday) => {
      return {
        user_id: adminUser._id,
        title: holiday.name,
        date: new Date(holiday.date.iso),
        is_all_day: true,
        is_public: true,
        description: holiday.description || "Public Holiday",
        category: "public-holiday",
      };
    });

    // Optional: remove duplicates if holiday already exists
    for (const event of holidayEvents) {
      const exists = await Event.findOne({
        title: event.title,
        date: event.date,
        category: "public-holiday",
      });

      if (!exists) {
        await Event.create(event);
      }
    }

    return {
      success: true,
      message: `${holidayEvents.length} public holidays added.`,
    };
  } catch (error) {
    throw new AppError(error.message || "Failed to add public holidays", 500);
  }
};

export const GetTodayCelebrationAlertsService = async ({
  user,
  scope,
  excludeDepartments = [],
}) => {
  try {
    // ✅ Get today's date in Pakistan timezone
    const todayPKT = dayjs().tz("Asia/Karachi");
    const today = todayPKT.format("MM-DD");

    const currentUser = await Users.findById(user._id).populate({
      path: "team",
      populate: { path: "department", model: "Departments" },
    });

    if (!currentUser) {
      throw new AppError("User not found", 404);
    }

    const designation = currentUser.designation?.toLowerCase() || "";
    const isAdmin = currentUser.role === "admin";
    const isBusiness = designation.includes("business");

    if (!isAdmin && (!currentUser.team || !currentUser.team.department)) {
      throw new AppError("User's team or department not found", 400);
    }

    let userDeptId = null;
    if (!isAdmin && currentUser.team?.department) {
      userDeptId = currentUser.team.department._id.toString();
    }

    const baseFilter = {
      is_active: true,
      $or: [
        { date_of_birth: { $exists: true } },
        { joining_date: { $exists: true } },
      ],
    };

    if (isAdmin) {
      // Admin: no extra filtering (whole company)
    } else if (isBusiness) {
      baseFilter["team"] = {
        $in: await Teams.find({ department: userDeptId }).distinct("_id"),
      };
    } else {
      const businessDepts = await Departments.find({
        name: /business/i,
      }).distinct("_id");

      const excludedTeams = await Teams.find({
        department: { $in: businessDepts },
      }).distinct("_id");

      baseFilter["team"] = { $nin: excludedTeams };
    }

    const users = await Users.find(baseFilter)
      .select(
        "first_name last_name profile_picture date_of_birth joining_date team"
      )
      .populate({
        path: "team",
        select: "name department",
        populate: { path: "department", select: "name" },
      });

    // ✅ Use Pakistan timezone for start/end of day
    const startOfDay = todayPKT.startOf("day").toDate();
    const endOfDay = todayPKT.endOf("day").toDate();

    const todaysPosts = await Suggestion.find({
      category: "culture",
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    }).select("created_for_user _id celebration_type");

    const birthdayUsers = [];
    const anniversaryUsers = [];

    for (const u of users) {
      const baseUserInfo = {
        _id: u._id,
        first_name: u.first_name,
        last_name: u.last_name,
        profile_picture: u.profile_picture,
        team: u.team,
      };

      // ✅ Birthday check - convert stored UTC to PKT to get the actual local date
      if (u.date_of_birth) {
        // Convert UTC stored date back to PKT to get the actual date
        const dobPKT = dayjs(u.date_of_birth).tz("Asia/Karachi");
        const dobFormatted = dobPKT.format("MM-DD");

        if (dobFormatted === today) {
          const post = todaysPosts.find(
            (p) =>
              p.created_for_user?.toString() === u._id.toString() &&
              p.celebration_type === "birthday"
          );
          birthdayUsers.push({
            ...baseUserInfo,
            post_id: post?._id || null,
          });
        }
      }

      // ✅ Anniversary check - convert stored UTC to PKT to get the actual local date
      if (u.joining_date) {
        // Convert UTC stored date back to PKT to get the actual date
        const joiningPKT = dayjs(u.joining_date).tz("Asia/Karachi");
        const joiningFormatted = joiningPKT.format("MM-DD");

        // Calculate years completed
        const yearsCompleted = todayPKT.diff(joiningPKT, "year");

        // 🔹 FIX: Only show anniversary if at least 1 year has been completed
        if (joiningFormatted === today && yearsCompleted >= 1) {
          const post = todaysPosts.find(
            (p) =>
              p.created_for_user?.toString() === u._id.toString() &&
              p.celebration_type === "anniversary"
          );
          anniversaryUsers.push({
            ...baseUserInfo,
            years_completed: yearsCompleted,
            post_id: post?._id || null,
          });
        }
      }
    }

    return {
      success: true,
      birthdayUsers,
      anniversaryUsers,
    };
  } catch (error) {
    throw new AppError(error.message, error.statusCode || 500);
  }
};
