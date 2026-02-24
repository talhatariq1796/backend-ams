import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import * as TicketService from "../services/ticket.service.js";
import { createLogsAndNotification } from "../utils/logNotification.js";

export const CreateTicket = async (req, res) => {
  try {
    const user = req.user;
    const data = await TicketService.CreateTicketService(req.body, user);

    const notifyAdmins = !req.body.assigned_to;
    const assignees = Array.isArray(data.assigned_to)
      ? data.assigned_to
      : [data.assigned_to];

    const notifyUsers = assignees.filter(
      (u) => u && String(u) !== String(user._id) // skip self
    );

    if (notifyAdmins || notifyUsers.length > 0) {
      await createLogsAndNotification({
        notification_by: user._id,
        type: NOTIFICATION_TYPES.TICKET,
        message: `created ticket: ${data.title}`,
        notifyAdmins,
        moreUsers: notifyUsers,
      });
    }

    res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to create ticket",
    });
  }
};
export const GetAllTickets = async (req, res) => {
  try {
    const data = await TicketService.GetAllTicketsService(req.query, req.user);
    res.status(200).json({
      success: true,
      message: "Tickets fetched successfully",
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch tickets",
    });
  }
};
export const AssignTicket = async (req, res) => {
  try {
    const { ticket_id } = req.params;
    const { assigned_to } = req.body;
    const user = req.user;

    const data = await TicketService.AssignTicketService({
      ticket_id,
      assigned_to,
      user,
    });

    if (assigned_to && String(assigned_to) !== String(user._id)) {
      await createLogsAndNotification({
        notification_by: user._id,
        type: NOTIFICATION_TYPES.TICKET,
        message: `assigned you a ticket: ${data.title}`,
        notifyUsers: [assigned_to],
      });
    }

    res.status(200).json({
      success: true,
      message: "Ticket assigned successfully",
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to assign ticket",
    });
  }
};

export const UpdateTicketStatus = async (req, res) => {
  try {
    const { ticket_id } = req.params;
    const { status } = req.body;
    const user = req.user;

    const ticket = await TicketService.UpdateTicketStatusService({
      ticket_id,
      status,
      user,
    });

    let notifyUsers = [];
    let message = "";

    if (ticket.assigned_to && String(ticket.assigned_to) === String(user._id)) {
      // assignee updates → notify creator
      notifyUsers.push(ticket.created_by);
      message = `updated your ticket status to ${status}: ${ticket.title}`;
    } else if (
      ticket.created_by &&
      String(ticket.created_by) === String(user._id)
    ) {
      // creator updates → notify assignee
      notifyUsers.push(ticket.assigned_to);
      message = `changed ticket status to ${status}: ${ticket.title}`;
    }

    notifyUsers = notifyUsers.filter(
      (u) => u && String(u) !== String(user._id)
    );

    if (notifyUsers.length > 0) {
      await createLogsAndNotification({
        notification_by: user._id,
        type: NOTIFICATION_TYPES.TICKET,
        message,
        moreUsers: notifyUsers,
      });
    }

    res.status(200).json({
      success: true,
      message: "Ticket status updated successfully",
      data: ticket,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update ticket status",
    });
  }
};

export const EditTicket = async (req, res) => {
  try {
    const { ticket_id } = req.params;
    const user = req.user;

    const data = await TicketService.EditTicketService({
      ticket_id,
      body: req.body,
      user,
    });

    let notifyUsers = [];
    let message = `updated ticket: ${data.title}`;

    if (data.assigned_to && String(data.assigned_to) !== String(user._id)) {
      notifyUsers.push(data.assigned_to);
    }
    if (data.created_by && String(data.created_by) !== String(user._id)) {
      notifyUsers.push(data.created_by);
    }

    notifyUsers = [...new Set(notifyUsers)];
    if (notifyUsers.length > 0) {
      await createLogsAndNotification({
        notification_by: user._id,
        type: NOTIFICATION_TYPES.TICKET,
        message,
        moreUsers: notifyUsers,
      });
    }

    res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update ticket",
    });
  }
};

export const DeleteTicket = async (req, res) => {
  try {
    const { ticket_id } = req.params;
    const user = req.user;

    const result = await TicketService.DeleteTicketService({
      ticket_id,
      user,
    });

    if (result.created_by && String(result.created_by) !== String(user._id)) {
      await createLogsAndNotification({
        notification_by: user._id,
        type: NOTIFICATION_TYPES.TICKET,
        message: `deleted your ticket: ${result.title}`,
        notifyUsers: [result.created_by],
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to delete ticket",
    });
  }
};

export const GetTicketStatusCount = async (req, res) => {
  try {
    const data = await TicketService.GetTicketStatusCountService(req.user);
    res.status(200).json({
      success: true,
      message: "Ticket status counts fetched successfully",
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch ticket status counts",
    });
  }
};
