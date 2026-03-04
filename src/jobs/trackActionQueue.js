// REDIS DISABLED - Queue functionality disabled
// import { Queue } from "bullmq";
// import IORedis from "ioredis";

// // Use environment variables for Redis connection (Railway compatible)
// const connection = new IORedis({
//   host: process.env.REDIS_HOST || process.env.REDIS_URL?.split("@")[1]?.split(":")[0] || "127.0.0.1",
//   port: process.env.REDIS_PORT || parseInt(process.env.REDIS_URL?.split(":")[2] || "6379"),
//   password: process.env.REDIS_PASSWORD || process.env.REDIS_URL?.split("@")[0]?.split("://")[1] || undefined,
//   maxRetriesPerRequest: null,
//   retryStrategy: (times) => {
//     const delay = Math.min(times * 50, 2000);
//     return delay;
//   },
//   reconnectOnError: (err) => {
//     const targetError = "READONLY";
//     if (err.message.includes(targetError)) {
//       return true; // Reconnect on READONLY error
//     }
//     return false;
//   },
// });

// // Handle connection errors gracefully
// connection.on("error", (err) => {
//   console.error("Redis connection error:", err.message);
//   // Don't crash - queue operations will fail gracefully
// });

// export const trackActionQueue = new Queue("track-action", {
//   connection,
//   defaultJobOptions: {
//     removeOnComplete: 100, // Keep last 100 completed jobs
//     removeOnFail: 500, // Keep last 500 failed jobs
//     attempts: 3, // Retry failed jobs 3 times
//     backoff: {
//       type: "exponential",
//       delay: 2000,
//     },
//   },
// });

// Mock queue object to prevent errors
export const trackActionQueue = {
  add: async (jobName, data) => {
    console.log("⚠️ Redis is disabled - trackActionQueue.add skipped", jobName);
    return { id: "mock-job-id" };
  },
};
