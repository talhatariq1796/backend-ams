import Ticket from "../models/ticket.model.js";
import Users from "../models/user.model.js";
import Team from "../models/team.model.js";
import AppError from "../middlewares/error.middleware.js";
import dayjs from "dayjs";
import mongoose from "mongoose";
import ticketQueue from "../jobs/ticketsCreation.queue.js";

export const CreateTicketService = async (body, user) => {
  const userWithTeam = await Users.findById(user._id).populate({
    path: "team",
    populate: { path: "department", select: "_id" },
  });

  const created_by_department = userWithTeam?.team?.department?._id;

  // Function to generate the next ticket ID
  const getNextTicketId = async () => {
    const lastTicket = await Ticket.findOne()
      .sort({ createdAt: -1 })
      .select("ticket_id");
    let newId = 1;
    if (lastTicket?.ticket_id) {
      const lastNumber = parseInt(lastTicket.ticket_id.split("-")[1], 10);
      newId = lastNumber + 1;
    }
    return `TK-${String(newId).padStart(3, "0")}`;
  };

  // Handle multiple assigned_to users → use queue
  if (Array.isArray(body.assigned_to) && body.assigned_to.length > 1) {
    const assignedUsers = await Users.find({
      _id: { $in: body.assigned_to },
    }).populate({
      path: "team",
      populate: { path: "department", select: "_id" },
    });

    assignedUsers.forEach(async (assignedUser) => {
      const assigned_to_department = assignedUser?.team?.department?._id;
      const ticket_id = await getNextTicketId();

      // Add to queue for background creation
      ticketQueue.add({
        ...body,
        ticket_id,
        created_by: user._id,
        status: "pending",
        created_by_department,
        assigned_to: assignedUser._id,
        assigned_to_department,
      });
    });

    return {
      message: "Tickets queued for creation",
      count: body.assigned_to.length,
    };
  }

  // Single user assignment → create instantly
  let assigned_to_department = [];
  if (body.assigned_to?.length) {
    const assignedUser = await Users.findById(body.assigned_to[0]).populate({
      path: "team",
      populate: { path: "department", select: "_id" },
    });
    assigned_to_department = assignedUser?.team?.department?._id;
  }

  const ticket_id = await getNextTicketId();

  const ticket = await Ticket.create({
    ...body,
    ticket_id,
    created_by: user._id,
    status: "pending",
    created_by_department,
    assigned_to_department,
  });

  return ticket;
};

export const GetAllTicketsService = async (query, user) => {
  const {
    department,
    priority,
    month,
    status,
    search,
    page = 1,
    limit = 10,
  } = query;

  const filter = {};

  if (user.role !== "admin") {
    filter.$or = [{ created_by: user._id }, { assigned_to: user._id }];
  }

  if (department) {
    filter.created_by_department = new mongoose.Types.ObjectId(department);
  }

  if (priority) {
    filter.priority = priority;
  }

  if (month) {
    const start = dayjs(month).startOf("month").toDate();
    const end = dayjs(month).endOf("month").toDate();
    filter.createdAt = { $gte: start, $lte: end };
  }

  if (status && status !== "all") {
    filter.status = status;
  }

  if (search) {
    const matchedUsers = await Users.find({
      name: { $regex: search, $options: "i" },
    }).select("_id");

    const matchedUserIds = matchedUsers.map((u) => u._id);

    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { created_by: { $in: matchedUserIds } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Ticket.countDocuments(filter);

  const tickets = await Ticket.find(filter)
    .populate({
      path: "created_by",
      select: "first_name last_name profile_picture employee_id email team",
      populate: {
        path: "team",
        select: "name",
      },
    })
    .populate({
      path: "assigned_to",
      select: "first_name last_name profile_picture employee_id email team",
      populate: {
        path: "team",
        select: "name",
      },
    })
    .populate("created_by_department", "name")
    .populate("assigned_to_department", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return {
    tickets,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const AssignTicketService = async ({ ticket_id, assigned_to, user }) => {
  const ticket = await Ticket.findById(ticket_id);
  if (!ticket) throw new AppError("Ticket not found", 404);

  const assignedUsers = await Users.find({
    _id: { $in: assigned_to },
  }).populate({
    path: "team",
    populate: { path: "department", select: "_id" },
  });

  ticket.assigned_to = assigned_to;
  ticket.assigned_to_department = assignedUsers
    .map((u) => u?.team?.department?._id)
    .filter(Boolean);

  await ticket.save();
  return ticket;
};

export const UpdateTicketStatusService = async ({
  ticket_id,
  status,
  user,
}) => {
  const ticket = await Ticket.findById(ticket_id);
  if (!ticket) throw new AppError("Ticket not found", 404);

  const isAdmin = user.role === "admin";
  const isOwner = ticket.created_by.toString() === user._id.toString();
  const isAssignee =
    ticket.assigned_to && ticket.assigned_to.toString() === user._id.toString();

  if (!isAdmin && !isOwner && !isAssignee) {
    throw new AppError("Unauthorized to update this ticket", 403);
  }

  const normalizedStatus = status?.toLowerCase().trim();
  const allowedStatuses = ["pending", "in-progress", "resolved"];
  if (!allowedStatuses.includes(normalizedStatus)) {
    throw new AppError("Invalid status value", 400);
  }

  ticket.status = status;
  await ticket.save();

  return ticket;
};

export const EditTicketService = async ({ ticket_id, body, user }) => {
  const ticket = await Ticket.findById(ticket_id);
  if (!ticket) throw new AppError("Ticket not found", 404);

  const isAdmin = user.role === "admin";
  const isCreator = ticket.created_by.toString() === user._id.toString();
  const isAssignee = ticket.assigned_to
    .map((id) => id.toString())
    .includes(user._id.toString());
  const isTeamLead = user.role === "teamLead";

  // 🔹 Authorization check
  if (!(isAdmin || isCreator || (isTeamLead && isAssignee))) {
    throw new AppError("Unauthorized to edit this ticket", 403);
  }

  // If assigned_to is being updated, also update department
  if (body.assigned_to) {
    const assignedUser = await Users.findById(body.assigned_to).populate({
      path: "team",
      populate: { path: "department", select: "_id" },
    });
    body.assigned_to_department = assignedUser?.team?.department?._id || null;
  }

  Object.assign(ticket, body);
  await ticket.save();

  return ticket;
};

export const DeleteTicketService = async ({ ticket_id, user }) => {
  const ticket = await Ticket.findById(ticket_id);
  if (!ticket) throw new AppError("Ticket not found", 404);

  const isAdmin = ["admin"].includes(user.role);
  const isCreator = ticket.created_by?.toString() === user._id.toString();

  if (!isAdmin && !isCreator) {
    throw new AppError("Unauthorized to delete this ticket", 403);
  }

  await ticket.deleteOne();
  return { message: "Ticket deleted successfully" };
};

export const GetTicketStatusCountService = async (user) => {
  const matchFilter = {};

  if (user.role !== "admin") {
    const userId = new mongoose.Types.ObjectId(user._id);
    matchFilter.$or = [{ created_by: userId }, { assigned_to: userId }];
  }

  const counts = await Ticket.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: { $ifNull: ["$status", "pending"] },
        count: { $sum: 1 },
      },
    },
  ]);

  const statusCounts = {
    pending: 0,
    "in-progress": 0,
    resolved: 0,
  };

  counts.forEach((item) => {
    statusCounts[item._id] = item.count;
  });

  return statusCounts;
};
