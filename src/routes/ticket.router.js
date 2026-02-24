import express from "express";
import * as TicketController from "../controllers/ticket.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const TicketRouter = express.Router();

TicketRouter.post("/tickets", authenticateToken, TicketController.CreateTicket);
TicketRouter.get("/tickets", authenticateToken, TicketController.GetAllTickets);

TicketRouter.patch(
  "/tickets/:ticket_id/assign",
  authenticateToken,
  TicketController.AssignTicket
);

TicketRouter.patch(
  "/tickets/:ticket_id/status",
  authenticateToken,
  TicketController.UpdateTicketStatus
);

TicketRouter.put(
  "/tickets/:ticket_id",
  authenticateToken,
  TicketController.EditTicket
);
TicketRouter.delete(
  "/tickets/:ticket_id",
  authenticateToken,
  TicketController.DeleteTicket
);
TicketRouter.get(
  "/tickets/status-count",
  authenticateToken,
  TicketController.GetTicketStatusCount
);

export default TicketRouter;
