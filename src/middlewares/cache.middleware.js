import redisClient from "../utils/redisClient.js";

export const cacheMiddleware = (prefix, ttl = 3600) => {
  return async (req, res, next) => {
    const queryKey = JSON.stringify(req.query || {});
    const paramKey = JSON.stringify(req.params || {});
    const key = `${prefix}:${queryKey}:${paramKey}`;

    try {
      const cachedData = await redisClient.get(key);

      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        console.log(`✅ [CACHE HIT] Key: ${key}`);

        if (process.env.NODE_ENV === "development") {
          parsedData.debugSource = "cache";
        }

        return res.json(parsedData);
      }

      console.log(`🛑 [CACHE MISS] Key: ${key}`);

      const originalJson = res.json.bind(res);
      res.json = async (body) => {
        try {
          await redisClient.setEx(key, ttl, JSON.stringify(body));
          console.log(`💾 [CACHE SET] Key: ${key} TTL: ${ttl}s`);
        } catch (err) {
          console.error("❌ Error setting cache:", err);
        }

        if (process.env.NODE_ENV === "development") {
          body.debugSource = "database";
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error("❌ Redis cache middleware error:", error);
      next();
    }
  };
};
