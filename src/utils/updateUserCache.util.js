import redisClient from "./redisClient.js";
import * as UserService from "../services/user.service.js";
import AppError from "../middlewares/error.middleware.js";
export const clearUserRouteCache = async () => {
  try {
    const keys = await redisClient.keys("*");
    const userRouteKeys = keys.filter(
      (key) =>
        key.startsWith("users_") ||
        key.startsWith("employees_") ||
        key.startsWith("employee_") ||
        key.startsWith("admins_") ||
        key.startsWith("employee_count_")
    );

    if (userRouteKeys.length > 0) {
      await redisClient.del(userRouteKeys);
      console.log(`✅ Cleared ${userRouteKeys.length} user route cache keys.`);
    } else {
      console.log("ℹ️ No user route cache keys found to delete.");
    }
  } catch (error) {
    console.error("❌ Error clearing user route cache:", error);
  }
};
export const updateUserCaches = async (currentUser = null) => {
  try {
    console.log("[Cache] Starting cache update process");
    clearUserRouteCache();
    const contextUser = currentUser || {
      _id: "system-cache-update",
      role: "admin",
      team: null,
    };

    const [users, employees, admins, employeeCount] = await Promise.all([
      UserService.FetchAllUsersService(),
      UserService.FetchEmployeesService({ page: 1, limit: 100 }, contextUser),
      UserService.FetchAllAdminsService({ page: 1, limit: 100 }),
      UserService.CountEmployeesService(),
    ]);

    console.log("[Cache] Data fetched successfully:", {
      users: users.length,
      employees: employees.employees.length,
      admins: admins.users.length,
      employeeCount,
    });

    const cacheResults = await Promise.all([
      redisClient.set("users_{}", JSON.stringify(users)),
      redisClient.set("employees_{}", JSON.stringify(employees)),
      redisClient.set("admins_{}", JSON.stringify(admins)),
      redisClient.set("employee_counts", JSON.stringify(employeeCount)),
    ]);

    console.log("[Cache] Cache update results:", cacheResults);

    return {
      success: true,
      updatedKeys: ["users_{}", "employees_{}", "admins_{}", "employee_counts"],
    };
  } catch (err) {
    console.error("Error updating user caches:", err.message);
    throw new AppError(`Cache update failed: ${err.message}`, 500);
  }
};

export const clearUserCaches = async (userId = null) => {
  const cacheKeys = [
    "users_{}",
    "employees_{}",
    "admins_{}",
    "employee_counts",
  ];

  if (userId) {
    cacheKeys.push(`employee_{"employeeId":"${userId}"}`);
  }

  try {
    console.log("[Cache] Starting cache clearance for keys:", cacheKeys);

    const preClearState = await Promise.all(
      cacheKeys.map(async (key) => ({
        key,
        exists: await redisClient.exists(key),
      }))
    );

    const deletionResults = await Promise.all(
      cacheKeys.map((key) => redisClient.del(key))
    );

    const postClearState = await Promise.all(
      cacheKeys.map(async (key) => ({
        key,
        exists: await redisClient.exists(key),
      }))
    );

    console.log("[Cache] Cache clearance report:", {
      keys: cacheKeys,
      preClearState,
      deletionResults,
      postClearState,
    });

    return {
      success: deletionResults.every((res) => res >= 0),
      clearedKeys: cacheKeys,
    };
  } catch (err) {
    console.error("[Cache] Clearance error:", err.message);
    throw new AppError(`Cache clearance failed: ${err.message}`, 500);
  }
};
