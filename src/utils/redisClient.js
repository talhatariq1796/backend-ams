import { createClient } from "redis";

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.log("Too many retries. Giving up...");
        return new Error("Too many retries");
      }
      return Math.min(retries * 100, 5000);
    },
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on("connect", () => {
  console.log("🟢 Connecting to Redis...");
});

redisClient.on("ready", () => {
  console.log("✅ Redis connected successfully");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

redisClient.on("end", () => {
  console.log("🔴 Redis connection closed");
});

const connectWithRetry = async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    console.log("Retrying in 5 seconds...");
    setTimeout(connectWithRetry, 5000);
  }
};

await connectWithRetry();

export default redisClient;
