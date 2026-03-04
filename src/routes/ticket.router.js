import express from "express";
import * as TicketController from "../controllers/ticket.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const TicketRouter = express.Router();

TicketRouter.post(
  "/tickets",
  authenticateToken,
  requirePermission("create_ticket"),
  TicketController.CreateTicket
);
TicketRouter.get(
  "/tickets",
  authenticateToken,
  requirePermission("view_tickets"),
  TicketController.GetAllTickets
);

TicketRouter.patch(
  "/tickets/:ticket_id/assign",
  authenticateToken,
  requirePermission("assign_ticket"),
  TicketController.AssignTicket
);

TicketRouter.patch(
  "/tickets/:ticket_id/status",
  authenticateToken,
  requirePermission("update_ticket_status"),
  TicketController.UpdateTicketStatus
);

TicketRouter.put(
  "/tickets/:ticket_id",
  authenticateToken,
  requirePermission("edit_ticket"),
  TicketController.EditTicket
);
TicketRouter.delete(
  "/tickets/:ticket_id",
  authenticateToken,
  requirePermission("delete_ticket"),
  TicketController.DeleteTicket
);
TicketRouter.get(
  "/tickets/status-count",
  authenticateToken,
  requirePermission("view_ticket_status_count"),
  TicketController.GetTicketStatusCount
);

export default TicketRouter;
