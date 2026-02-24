import * as UserService from "../services/user.service.js";
import { isAdmin, checkUserAuthorization } from "../utils/getUserRole.util.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import AppError from "../middlewares/error.middleware.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import redisClient from "../utils/redisClient.js";
import { updateUserCaches } from "../utils/updateUserCache.util.js";
import jwt from "jsonwebtoken";

export const Registration = async (req, res) => {
  try {
    const newUser = await UserService.RegisterUserService(req.body);
    if (!newUser) {
      throw new AppError("Failed to create user", 500);
    }

    if (req.user?._id) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.EMPLOYEES,
        message: `registered a new user.`,
        notifyAdmins: false,
      });
    }

    await updateUserCaches();

    if (newUser._id) {
      await redisClient.set(
        `employee_{"employeeId":"${newUser._id}"}`,
        JSON.stringify(newUser)
      );
    }

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
    AppResponse({
      res,
      statusCode: 200,
      message: "You have successfully logged in.",
      data: userData,
      success: true,
    });
  } catch (error) {
    AppResponse({
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

    AppResponse({
      res,
      statusCode: 200,
      message: "Password reset link sent successfully.",
      success: true,
    });
  } catch (error) {
    AppResponse({
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
      await createLogsAndNotification({
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
    //   await createLogsAndNotification({
    //     notification_by: req.user._id,
    //     type: NOTIFICATION_TYPES.ACCOUNT,
    //     message: `Your password has been reset successfully.`,
    //     notifyAdmins: false,
    //   });
    // }

    AppResponse({
      res,
      statusCode: 200,
      message: "Password reset successfully",
      success: true,
    });
  } catch (error) {
    AppResponse({
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
    AppResponse({
      res,
      statusCode: 200,
      message: "Employees retrieved successfully.",
      data: employees,
      success: true,
    });
  } catch (error) {
    AppResponse({
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
    isAdmin(req.user);
    const users = await UserService.FetchAllUsersService();
    if (!users) {
      throw new AppError("No users found", 400);
    }
    AppResponse({
      res,
      statusCode: 200,
      message: "All users retrieved successfully.",
      data: users,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode,
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
    AppResponse({
      res,
      statusCode: 200,
      message: "Employee retrieved successfully.",
      data: employee,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode,
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

    await createLogsAndNotification({
      notification_by: req.user._id,
      type: NOTIFICATION_TYPES.ACCOUNT,
      message: `has deleted the user "${deletedUser.first_name} ${deletedUser.last_name}".`,
      notifyAdmins: false,
    });

    await updateUserCaches();
    await redisClient.del(`employee_{"employeeId":"${userIdToDelete}"}`);

    AppResponse({
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
    AppResponse({
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

    await createLogsAndNotification({
      notification_by: req.user._id,
      type: NOTIFICATION_TYPES.ACCOUNT,
      message: `updated the status of user "${updatedUser.name}".`,
      notifyAdmins: false,
    });

    await updateUserCaches();
    await redisClient.set(
      `employee_{"employeeId":"${updatedUser._id}"}`,
      JSON.stringify(updatedUser)
    );

    AppResponse({
      res,
      statusCode: 200,
      message: `User ${is_active ? "activated" : "deactivated"} successfully`,
      data: updatedUser,
      success: true,
    });
  } catch (error) {
    AppResponse({
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
    AppResponse({
      res,
      statusCode: 200,
      message: "User retrieved successfully.",
      data: user,
      success: true,
    });
  } catch (error) {
    AppResponse({
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

    await createLogsAndNotification({
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

    AppResponse({
      res,
      statusCode: 200,
      message: "User updated successfully.",
      data: updatedUser,
      success: true,
    });
  } catch (error) {
    AppResponse({
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

    await createLogsAndNotification({
      notification_by: userId,
      type: NOTIFICATION_TYPES.ACCOUNT,
      message: `updated profile.`,
      notifyAdmins: false,
    });

    await updateUserCaches();
    await redisClient.set(
      `employee_{"employeeId":"${updatedUser._id}"}`,
      JSON.stringify(updatedUser)
    );

    AppResponse({
      res,
      statusCode: 200,
      message: "User updated successfully.",
      data: updatedUser,
      success: true,
    });
  } catch (error) {
    AppResponse({
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

    AppResponse({
      res,
      statusCode: 200,
      message: `${response.role}s retrieved successfully.`,
      data: response,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "An error occurred.",
      success: false,
    });
  }
};
export const UpdateUserRole = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const updatedUser = await UserService.UpdateUserRoleService(
      userId,
      role,
      req.user._id
    );

    if (updatedUser) {
      await createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.ACCOUNT,
        message: `updated the role of ${updatedUser.first_name} ${updatedUser.last_name} to ${updatedUser.role}.`,
        notifyAdmins: false,
      });
    }
    await updateUserCaches();
    await redisClient.set(
      `employee_{"employeeId":"${updatedUser._id}"}`,
      JSON.stringify(updatedUser)
    );

    AppResponse({
      res,
      statusCode: 200,
      message: `User role updated to ${role} successfully`,
      data: updatedUser,
      success: true,
    });
  } catch (error) {
    AppResponse({
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
    AppResponse({
      res,
      statusCode: 200,
      message: "Tokens refreshed successfully.",
      data: newTokens.tokens,
      success: true,
    });
  } catch (error) {
    AppResponse({
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

    AppResponse({
      res,
      statusCode: 200,
      message: "Employee counts fetched successfully.",
      data: countData,
      success: true,
    });
  } catch (error) {
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};
