// REDIS DISABLED
// import redisClient from "../utils/redisClient.js";

export const invalidateCache = async (prefix) => {
  // REDIS DISABLED - Cache invalidation skipped
  // const keys = await redisClient.keys(`${prefix}*`);
  // if (keys.length > 0) {
  //   await redisClient.del(keys);
  // }
  console.log("⚠️ Redis is disabled - cache invalidation skipped");
};
