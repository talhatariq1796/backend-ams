import redisClient from "./redisClient.js";

export const invalidateCache = async (prefix) => {
  const keys = await redisClient.keys(`${prefix}*`);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
};
