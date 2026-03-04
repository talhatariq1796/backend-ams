// REDIS DISABLED - Commented out due to connection issues
// import { createClient } from "redis";

// const redisClient = createClient({
//   socket: {
//     host: process.env.REDIS_HOST || "localhost",
//     port: process.env.REDIS_PORT || 6379,
//     connectTimeout: 10000,
//     reconnectStrategy: (retries) => {
//       if (retries > 5) {
//         console.log("Too many retries. Giving up...");
//         return new Error("Too many retries");
//       }
//       return Math.min(retries * 100, 5000);
//     },
//   },
//   password: process.env.REDIS_PASSWORD || undefined,
// });

// redisClient.on("connect", () => {
//   console.log("🟢 Connecting to Redis...");
// });

// redisClient.on("ready", () => {
//   console.log("✅ Redis connected successfully");
// });

// redisClient.on("error", (err) => {
//   console.error("❌ Redis error:", err);
// });

// redisClient.on("end", () => {
//   console.log("🔴 Redis connection closed");
// });

// const connectWithRetry = async () => {
//   try {
//     await redisClient.connect();
//   } catch (err) {
//     console.error("Failed to connect to Redis:", err);
//     console.log("Retrying in 5 seconds...");
//     setTimeout(connectWithRetry, 5000);
//   }
// };

// await connectWithRetry();

// Mock redisClient object to prevent errors
const redisClient = {
  isOpen: false,
  connect: async () => {
    console.log("⚠️ Redis is disabled");
    return false;
  },
  get: async () => null,
  set: async () => false,
  setEx: async () => false,
  del: async () => 0,
  keys: async () => [],
  exists: async () => 0,
};

/**
 * Ensure Redis client is connected before operations
 * @returns {Promise<boolean>} True if connected, false otherwise
 * REDIS DISABLED - Always returns false
 */
export const ensureRedisConnection = async () => {
  // REDIS DISABLED
  // try {
  //   if (!redisClient.isOpen) {
  //     console.log("🔄 Redis client is closed. Attempting to reconnect...");
  //     try {
  //       await redisClient.connect();
  //       console.log("✅ Redis client reconnected successfully");
  //     } catch (connectError) {
  //       // If already connected or connection is in progress, that's fine
  //       if (connectError.message && connectError.message.includes("already")) {
  //         console.log("✅ Redis client is already connected");
  //         return true;
  //       }
  //       throw connectError;
  //     }
  //   }
  //   return true;
  // } catch (error) {
  //   console.error("❌ Failed to ensure Redis connection:", error.message);
  //   return false;
  // }
  console.log("⚠️ Redis is disabled - ensureRedisConnection returning false");
  return false;
};

export default redisClient;
