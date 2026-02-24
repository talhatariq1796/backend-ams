import Queue from "bull";
import Leave from "../models/requests/leave.model.js";

const leaveQueue = new Queue("leaveCreation", {
  redis: { host: "127.0.0.1", port: 6379 },
});

leaveQueue.process(async (job) => {
  const { leaveData } = job.data;
  await Leave.create(leaveData);
});

export default leaveQueue;
