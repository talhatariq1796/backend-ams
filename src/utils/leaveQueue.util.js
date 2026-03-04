// REDIS DISABLED - Queue functionality disabled
// import Queue from "bull";
import Leave from "../models/requests/leave.model.js";

// const leaveQueue = new Queue("leaveCreation", {
//   redis: { host: "127.0.0.1", port: 6379 },
// });

// leaveQueue.process(async (job) => {
//   const { leaveData } = job.data;
//   await Leave.create(leaveData);
// });

// Mock queue object - processes jobs immediately instead of queuing
const leaveQueue = {
  add: async (data) => {
    console.log("⚠️ Redis is disabled - Processing leave immediately");
    const { leaveData } = data;
    await Leave.create(leaveData);
    return { id: "mock-job-id" };
  },
};

export default leaveQueue;
