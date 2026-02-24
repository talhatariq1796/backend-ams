import Queue from "bull";
import Ticket from "../models/ticket.model.js";

const ticketQueue = new Queue("ticketQueue", {
  redis: { host: "127.0.0.1", port: 6379 },
});

ticketQueue.process(async (job) => {
  await Ticket.create(job.data);
});

export default ticketQueue;
