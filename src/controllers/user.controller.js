import * as UserService from "../services/user.service.js";
import * as PermissionService from "../services/permission.service.js";
import { isAdmin, checkUserAuthorization } from "../utils/getUserRole.util.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import AppError from "../middlewares/error.middleware.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import redisClient, { ensureRedisConnection } from "../utils/redisClient.js";
import { updateUserCaches } from "../utils/updateUserCache.util.js";
import jwt from "jsonwebtoken";
import { getCompanyId } from "../utils/company.util.js";
import Users from "../models/user.model.js";
import mongoose from "mongoose";

/**
 * Resolve target user from :userId param. Accepts either MongoDB _id or employee_id (e.g. WB-1).
 * Returns { user, resolvedUserId } or throws AppError if not found / wrong company.
 */
async function resolveUserForPermissions(userIdParam, companyId, reqUser) {
  let targetUser = null;
  const isObjectId =
    mongoose.Types.ObjectId.isValid(userIdParam) &&
    String(new mongoose.Types.ObjectId(userIdParam)) === String(userIdParam);
  if (isObjectId) {
    targetUser = await Users.findById(userIdParam).select("company_id").lean();
  }
  if (!targetUser && companyId) {
    targetUser = await Users.findOne({
      company_id: companyId,
      employee_id: userIdParam,
    })
      .select("company_id _id")
      .lean();
  }
  if (!targetUser) throw new AppError("User not found", 404);
  const resolvedUserId = targetUser._id.toString();
  if (companyId && targetUser.company_id?.toString() !== companyId.toString()) {
    throw new AppError("User does not belong to your company", 403);
  }
  return { user: targetUser, resolvedUserId };
}

/**
 * Get companyId from request; for super_admin without context, use target user's company.
 */
async function getCompanyIdForPermissionReq(req, resolvedUserId) {
  let companyId = getCompanyId(req);
  if (!companyId && req.user?.is_super_admin && resolvedUserId) {
    const u = await Users.findById(resolvedUserId).select("company_id").lean();
    companyId = u?.company_id;
  }
  return companyId;
}

export const Registration = async (req, res) => {
  try {
    // Get company_id from request (admin's company)
    let companyId = getCompanyId(req);

    // If still not found, fetch from admin's user record in DB
    if (!companyId && req.user?._id) {
      const adminUser = await Users.findById(req.user._id).select("company_id");
      if (adminUser?.company_id) {
        companyId = adminUser.company_id;
        // Also update req for consistency
        req.company_id = companyId;
        if (req.user) {
          req.user.company_id = companyId;
        }
      }
    }

    if (!companyId) {
      console.error("⚠️  Registration failed - no company_id found:", {
        hasCompanyId: !!req.company_id,
        hasUserCompanyId: !!req.user?.company_id,
        userId: req.user?._id,
        userRole: req.user?.role,
      });
      throw new AppError("Company context required for user registration", 400);
    }

    // Add company_id to the registration data
    const registrationData = {
      ...req.body,
      company_id: companyId,
    };

    const newUser = await UserService.RegisterUserService(registrationData);
    if (!newUser) {
      throw new AppError("Failed to create user", 500);
    }

    if (req.user?._id) {
      createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.EMPLOYEES,
        message: `registered a new user.`,
        notifyAdmins: false,
        company_id: companyId,
      });
    }

    await updateUserCaches(req.user);

    // REDIS DISABLED
    // if (newUser._id) {
    //   await redisClient.set(
    //     `employee_{"employeeId":"${newUser._id}"}`,
    //     JSON.stringify(newUser)
    //   );
    // }

    return AppResponse({
      res,
      statusCode: 201,
      message: "User created successfully",
      data: newUser,
      success: true,
    });
  } catch (error) {
    console.error("Error in Registration Controller:", error);
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Internal server error",
      success: false,
    });
  }
};

export const Login = async (req, res) => {
  try {
    const userData = await UserService.LoginUserService(req.body);
    return AppResponse({
      res,
      statusCode: 200,
      message: "You have successfully logged in.",
      data: userData,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode,
      message: error.message,
      success: false,
    });
  }
};

export const refreshTokenController = (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ message: "Refresh token is required." });
  }

  try {
    const decoded = jwt.verify(refresh_token, process.env.REFRESH_SECRET_KEY);

    const newAccessToken = jwt.sign(
      { user: decoded.user },
      process.env.ACCESS_SECRET_KEY,
      { expiresIn: 24 * 60 * 60 * 3 }
    );

    return res.status(200).json({
      access_token: newAccessToken,
      access_expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    return res
      .status(401)
      .json({ message: "Invalid or expired refresh token." });
  }
};

export const ForgotPassword = async (req, res) => {
  try {
    await UserService.ForgotPasswordService(req.body);

    return AppResponse({
      res,
      statusCode: 200,
      message: "Password reset link sent successfully.",
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode,
      message: error.message,
      success: false,
    });
  }
};
export const ChangePassword = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { email, currentPassword, newPassword } = req.body;
    if (!email || !currentPassword || !newPassword) {
      return AppResponse({
        res,
        statusCode: 400,
        message: "Email, current password, and new password are required",
        success: false,
      });
    }

    const changedPassword = await UserService.ChangePasswordService({
      email,
      currentPassword,
      newPassword,
    });

    if (changedPassword) {
      createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.ACCOUNT,
        message: `Password updated successfully.`,
        notifyAdmins: false,
      });
    }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Password updated successfully.",
      success: true,
    });
  } catch (error) {
    console.error("ChangePassword error:", error); // add for debugging
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Internal server error",
      success: false,
    });
  }
};

export const ResetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const resetPassword = await UserService.ResetPasswordService(
      token,
      newPassword
    );

    // if (resetPassword) {
    //   createLogsAndNotification({
    //     notification_by: req.user._id,
    //     type: NOTIFICATION_TYPES.ACCOUNT,
    //     message: `Your password has been reset successfully.`,
    //     notifyAdmins: false,
    //   });
    // }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Password reset successfully",
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};
export const FetchEmployees = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const employees = await UserService.FetchEmployeesService(
      req.query,
      req.user
    );
    return AppResponse({
      res,
      statusCode: 200,
      message: "Employees retrieved successfully.",
      data: employees,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode,
      message: error.message,
      success: false,
    });
  }
};
export const FetchAllUsers = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    // Super admins can see all users, regular admins only see their company users
    const companyId =
      req.user?.is_super_admin || req.user?.role === "super_admin"
        ? null
        : req.user?.company_id || req.company_id;

    const users = await UserService.FetchAllUsersService(companyId);
    if (!users) {
      throw new AppError("No users found", 400);
    }
    return AppResponse({
      res,
      statusCode: 200,
      message: "All users retrieved successfully.",
      data: users,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};
export const FetchEmployee = async (req, res) => {
  const { employeeId } = req.params;

  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const employee = await UserService.FetchEmployeeService(employeeId);
    return AppResponse({
      res,
      statusCode: 200,
      message: "Employee retrieved successfully.",
      data: employee,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};
export const DeleteUser = async (req, res) => {
  checkUserAuthorization(req.user);
  const userIdToDelete = req.params.userId;

  try {
    // Authorization check: only admin or the user themselves
    if (
      req.user.role !== "admin" &&
      req.user._id.toString() !== userIdToDelete
    ) {
      throw new AppError("You are not authorized to delete this account.", 403);
    }

    const deletedUser = await UserService.DeleteUserService(userIdToDelete);

    createLogsAndNotification({
      notification_by: req.user._id,
      type: NOTIFICATION_TYPES.ACCOUNT,
      message: `has deleted the user "${deletedUser.first_name} ${deletedUser.last_name}".`,
      notifyAdmins: false,
    });

    await updateUserCaches(req.user);
    // REDIS DISABLED
    // await redisClient.del(`employee_{"employeeId":"${userIdToDelete}"}`);

    return AppResponse({
      res,
      statusCode: 200,
      message: "User deleted successfully.",
      data: {
        userId: deletedUser._id,
        name: `${deletedUser.first_name} ${deletedUser.last_name}`,
      },
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Something went wrong.",
      success: false,
    });
  }
};

export const UpdateUserActivationStatus = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const { userId } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
      throw new AppError("Invalid status value", 400);
    }

    const updatedUser = await UserService.UpdateUserActivationStatusService(
      userId,
      is_active
    );

    if (!updatedUser) {
      throw new AppError("No user found", 400);
    }

    createLogsAndNotification({
      notification_by: req.user._id,
      type: NOTIFICATION_TYPES.ACCOUNT,
      message: `updated the status of user "${updatedUser.name}".`,
      notifyAdmins: false,
    });

    await updateUserCaches(req.user);
    // REDIS DISABLED
    // await redisClient.set(
    //   `employee_{"employeeId":"${updatedUser._id}"}`,
    //   JSON.stringify(updatedUser)
    // );

    return AppResponse({
      res,
      statusCode: 200,
      message: `User ${is_active ? "activated" : "deactivated"} successfully`,
      data: updatedUser,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Something went wrong.",
      success: false,
    });
  }
};

export const FetchUser = async (req, res) => {
  const user = req.user;
  const userId = user._id;

  try {
    checkUserAuthorization(req.user);
    const user = await UserService.FetchUserService(userId);
    return AppResponse({
      res,
      statusCode: 200,
      message: "User retrieved successfully.",
      data: user,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode,
      message: error.message,
      success: false,
    });
  }
};
export const UpdateUserByAdmin = async (req, res) => {
  const { userId } = req.params;

  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const updatedUser = await UserService.UpdateUserByAdminService(
      userId,
      req.body
    );

    if (!updatedUser) {
      throw new AppError("No user found", 400);
    }

    createLogsAndNotification({
      notification_by: req.user._id,
      notification_to: userId,
      type: NOTIFICATION_TYPES.ACCOUNT,
      message: `updated your profile.`,
      notifyAdmins: false,
    });
    // clearUserRouteCache();
    // Clear and update caches
    // const clearance = await clearUserCaches(userId);
    // console.log("Cache clearance result:", clearance);

    const update = await updateUserCaches(req.user);
    console.log("Cache update result:", update);

    return AppResponse({
      res,
      statusCode: 200,
      message: "User updated successfully.",
      data: updatedUser,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Something went wrong.",
      success: false,
    });
  }
};

export const UpdateEmployee = async (req, res) => {
  const userId = req.user._id;

  try {
    checkUserAuthorization(userId);

    const updatedUser = await UserService.UpdateEmployeeService(
      userId,
      req.body
    );

    if (!updatedUser) {
      throw new AppError("No user found", 400);
    }

    createLogsAndNotification({
      notification_by: userId,
      type: NOTIFICATION_TYPES.ACCOUNT,
      message: `updated profile.`,
      notifyAdmins: false,
    });

    // Update cache, but don't fail the request if cache update fails
    try {
      const cacheUpdateResult = await updateUserCaches(req.user);
      if (!cacheUpdateResult.success) {
        console.warn("⚠️ Cache update failed, but user data was updated successfully:", cacheUpdateResult.message);
      }
    } catch (cacheError) {
      console.error("⚠️ Cache update error (non-blocking):", cacheError.message);
    }

    // REDIS DISABLED - Update individual employee cache
    // try {
    //   const isConnected = await ensureRedisConnection();
    //   if (isConnected) {
    //     await redisClient.set(
    //       `employee_{"employeeId":"${updatedUser._id}"}`,
    //       JSON.stringify(updatedUser)
    //     );
    //   } else {
    //     console.warn("⚠️ Redis not connected. Skipping employee cache update.");
    //   }
    // } catch (cacheError) {
    //   console.error("⚠️ Failed to update employee cache (non-blocking):", cacheError.message);
    // }

    return AppResponse({
      res,
      statusCode: 200,
      message: "User updated successfully.",
      data: updatedUser,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Something went wrong.",
      success: false,
    });
  }
};

export const FetchAllAdmins = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const response = await UserService.FetchAllAdminsService(req.query);

    return AppResponse({
      res,
      statusCode: 200,
      message: `${response.role}s retrieved successfully.`,
      data: response,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "An error occurred.",
      success: false,
    });
  }
};
export const UpdateUserRole = async (req, res) => {
  const { userId: userIdParam } = req.params;
  const { role } = req.body;

  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const companyId = getCompanyId(req);
    if (!companyId) throw new AppError("Company context required", 403);
    const { resolvedUserId } = await resolveUserForPermissions(
      userIdParam,
      companyId,
      req.user
    );
    const updatedUser = await UserService.UpdateUserRoleService(
      resolvedUserId,
      role,
      req.user._id
    );

    if (updatedUser) {
      createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.ACCOUNT,
        message: `updated the role of ${updatedUser.first_name} ${updatedUser.last_name} to ${updatedUser.role}.`,
        notifyAdmins: false,
      });
    }
    
    // Update cache, but don't fail the request if cache update fails
    try {
      const cacheUpdateResult = await updateUserCaches(req.user);
      if (!cacheUpdateResult.success) {
        console.warn("⚠️ Cache update failed, but user data was updated successfully:", cacheUpdateResult.message);
      }
    } catch (cacheError) {
      console.error("⚠️ Cache update error (non-blocking):", cacheError.message);
    }

    // REDIS DISABLED - Update individual employee cache
    // try {
    //   const isConnected = await ensureRedisConnection();
    //   if (isConnected) {
    //     await redisClient.set(
    //       `employee_{"employeeId":"${updatedUser._id}"}`,
    //       JSON.stringify(updatedUser)
    //     );
    //   } else {
    //     console.warn("⚠️ Redis not connected. Skipping employee cache update.");
    //   }
    // } catch (cacheError) {
    //   console.error("⚠️ Failed to update employee cache (non-blocking):", cacheError.message);
    // }

    return AppResponse({
      res,
      statusCode: 200,
      message: `User role updated to ${role} successfully`,
      data: updatedUser,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};
export const RefreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.body.refresh_token;
    if (!refreshToken) {
      throw new AppError("Refresh token is required.", 400);
    }

    const newTokens = await UserService.RefreshTokenService(refreshToken);
    return AppResponse({
      res,
      statusCode: 200,
      message: "Tokens refreshed successfully.",
      data: newTokens.tokens,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "An error occurred while refreshing the token.",
      success: false,
    });
  }
};

export const CountEmployees = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);

    const countData = await UserService.CountEmployeesService();

    return AppResponse({
      res,
      statusCode: 200,
      message: "Employee counts fetched successfully.",
      data: countData,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

// ---------- Role & Permissions (admin editing user-level permissions) ----------

/**
 * GET /users/:userId/permissions
 * Get permission state for a user (for Role & Permissions UI).
 * :userId can be MongoDB _id or employee_id (e.g. WB-1).
 */
export const GetUserPermissions = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const { userId: userIdParam } = req.params;
    let companyId = getCompanyId(req);
    const { user: targetUser, resolvedUserId } = await resolveUserForPermissions(
      userIdParam,
      companyId,
      req.user
    );
    if (!companyId && req.user.is_super_admin) companyId = targetUser.company_id;
    if (!companyId) throw new AppError("Company context required", 403);
    const isAdminOrSuper = req.user.role === "admin" || req.user.is_super_admin === true;
    if (!isAdminOrSuper && req.user._id.toString() !== resolvedUserId) {
      throw new AppError("Only admin can view another user's permissions", 403);
    }
    const data = await PermissionService.getPermissionStateForUser(resolvedUserId, companyId);
    return AppResponse({
      res,
      statusCode: 200,
      message: "User permissions retrieved successfully",
      data,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

/**
 * PUT /users/:userId/permissions
 * Update a user's custom permission overrides. Only the keys sent in overrides are updated; others are left unchanged.
 * Body: { overrides: { [permission_key]: boolean } } (e.g. { overrides: { "check_in": true, "view_all_attendance": false } } or a single key)
 *       or { action: "enable_all" | "disable_all" } to set all at once.
 */
export const UpdateUserPermissions = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const isAdminOrSuper = req.user.role === "admin" || req.user.is_super_admin === true;
    if (!isAdminOrSuper) throw new AppError("Only admin can update user permissions", 403);
    const { userId: userIdParam } = req.params;
    let companyId = getCompanyId(req);
    const { resolvedUserId } = await resolveUserForPermissions(
      userIdParam,
      companyId,
      req.user
    );
    companyId = await getCompanyIdForPermissionReq(req, resolvedUserId);
    if (!companyId) throw new AppError("Company context required", 403);
    const { overrides, action } = req.body;
    let result;
    if (action === "enable_all" || action === "disable_all") {
      result = await PermissionService.bulkUpdateUserPermissions(
        resolvedUserId,
        companyId,
        action,
        req.user._id
      );
    } else if (overrides && typeof overrides === "object") {
      result = await PermissionService.updateUserPermissionOverrides(
        resolvedUserId,
        companyId,
        overrides,
        req.user._id
      );
    } else {
      throw new AppError("Provide overrides object or action (enable_all/disable_all)", 400);
    }
    createLogsAndNotification({
      notification_by: req.user._id,
      type: NOTIFICATION_TYPES.ACCOUNT,
      message: "updated user permissions.",
      company_id: companyId,
    });
    return AppResponse({
      res,
      statusCode: 200,
      message: "User permissions updated successfully",
      data: result,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

/**
 * POST /users/:userId/permissions/revert
 * Revert user's custom permissions to role defaults.
 */
export const RevertUserPermissions = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const isAdminOrSuper = req.user.role === "admin" || req.user.is_super_admin === true;
    if (!isAdminOrSuper) throw new AppError("Only admin can revert user permissions", 403);
    const { userId: userIdParam } = req.params;
    let companyId = getCompanyId(req);
    const { resolvedUserId } = await resolveUserForPermissions(
      userIdParam,
      companyId,
      req.user
    );
    companyId = await getCompanyIdForPermissionReq(req, resolvedUserId);
    if (!companyId) throw new AppError("Company context required", 403);
    const result = await PermissionService.revertUserPermissionsToRoleDefault(
      resolvedUserId,
      companyId,
      req.user._id
    );
    createLogsAndNotification({
      notification_by: req.user._id,
      type: NOTIFICATION_TYPES.ACCOUNT,
      message: "reverted user permissions to role defaults.",
      company_id: companyId,
    });
    return AppResponse({
      res,
      statusCode: 200,
      message: "User permissions reverted to role defaults",
      data: result,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

/**
 * GET /users/:userId/permission-changes
 * List recent permission changes for this user (for "Recent Permission Changes" UI).
 */
export const GetRecentPermissionChanges = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const { userId: userIdParam } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    let companyId = getCompanyId(req);
    const { user: targetUser, resolvedUserId } = await resolveUserForPermissions(
      userIdParam,
      companyId,
      req.user
    );
    if (!companyId && req.user.is_super_admin) companyId = targetUser.company_id;
    if (!companyId) throw new AppError("Company context required", 403);
    const isAdminOrSuper = req.user.role === "admin" || req.user.is_super_admin === true;
    if (!isAdminOrSuper && req.user._id.toString() !== resolvedUserId) {
      throw new AppError("Only admin can view another user's permission changes", 403);
    }
    const data = await PermissionService.getRecentPermissionChanges(
      resolvedUserId,
      companyId,
      limit
    );
    return AppResponse({
      res,
      statusCode: 200,
      message: "Recent permission changes retrieved successfully",
      data,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

/**
 * POST /users/:userId/permissions/undo
 * Undo one change or a whole action (batch).
 * Body: { changeId: string } to undo a single change, or { batchId: string } to undo the entire action (all changes from one request).
 */
export const UndoPermissionChange = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const isAdminOrSuper = req.user.role === "admin" || req.user.is_super_admin === true;
    if (!isAdminOrSuper) throw new AppError("Only admin can undo permission changes", 403);
    const { userId: userIdParam } = req.params;
    const { changeId, batchId } = req.body;
    if (!changeId && !batchId) {
      throw new AppError("Provide changeId (single change) or batchId (whole action)", 400);
    }
    if (changeId && batchId) {
      throw new AppError("Provide only one of changeId or batchId", 400);
    }
    let companyId = getCompanyId(req);
    const { resolvedUserId } = await resolveUserForPermissions(
      userIdParam,
      companyId,
      req.user
    );
    companyId = await getCompanyIdForPermissionReq(req, resolvedUserId);
    if (!companyId) throw new AppError("Company context required", 403);

    const result = batchId
      ? await PermissionService.undoPermissionChangeByBatch(
          resolvedUserId,
          companyId,
          batchId,
          req.user._id
        )
      : await PermissionService.undoPermissionChange(
          resolvedUserId,
          companyId,
          changeId,
          req.user._id
        );

    createLogsAndNotification({
      notification_by: req.user._id,
      type: NOTIFICATION_TYPES.ACCOUNT,
      message: "undid a permission change.",
      company_id: companyId,
    });
    return AppResponse({
      res,
      statusCode: 200,
      message: "Permission change undone successfully",
      data: result,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};
