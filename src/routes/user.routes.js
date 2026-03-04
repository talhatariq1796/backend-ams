import express from "express";
import * as UserController from "../controllers/user.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const UserRouter = express.Router();

UserRouter.post(
  "/user/create",
  authenticateToken,
  requirePermission("manage_agents"),
  UserController.Registration
);
UserRouter.post("/user/login", UserController.Login);
UserRouter.post("/user/refresh-token", UserController.refreshTokenController);

UserRouter.post("/user/forgot-password", UserController.ForgotPassword);
UserRouter.put(
  "/user/change-password",
  authenticateToken,
  UserController.ChangePassword
);
UserRouter.put("/user/reset-password/:token", UserController.ResetPassword);

UserRouter.get(
  "/users",
  authenticateToken,
  requirePermission("manage_agents"),
  UserController.FetchAllUsers
);
UserRouter.get(
  "/users/employees",
  authenticateToken,
  requirePermission("manage_agents"),
  UserController.FetchEmployees
);
UserRouter.get(
  "/users/employee/:employeeId",
  authenticateToken,
  requirePermission("view_attendance_status"),
  UserController.FetchEmployee
);
UserRouter.delete(
  "/user/:userId",
  authenticateToken,
  requirePermission("manage_agents"),
  UserController.DeleteUser
);
UserRouter.put(
  "/users/change-activation-status/:userId",
  authenticateToken,
  requirePermission("manage_agents"),
  UserController.UpdateUserActivationStatus
);

UserRouter.get("/user", authenticateToken, UserController.FetchUser);
UserRouter.put(
  "/user/update",
  authenticateToken,
  UserController.UpdateEmployee
);

UserRouter.put(
  "/user/:userId",
  authenticateToken,
  requirePermission("manage_agents"),
  UserController.UpdateUserByAdmin
);

UserRouter.get(
  "/users/admins",
  authenticateToken,
  requirePermission("manage_agents"),
  UserController.FetchAllAdmins
);

UserRouter.put(
  "/users/update-role/:userId",
  authenticateToken,
  requirePermission("manage_roles"),
  UserController.UpdateUserRole
);

UserRouter.get(
  "/users/employees/count",
  authenticateToken,
  requirePermission("manage_agents"),
  UserController.CountEmployees
);

UserRouter.get(
  "/users/:userId/permissions",
  authenticateToken,
  UserController.GetUserPermissions
);
UserRouter.get(
  "/users/:userId/permission-changes",
  authenticateToken,
  UserController.GetRecentPermissionChanges
);
UserRouter.put(
  "/users/:userId/permissions",
  authenticateToken,
  requirePermission("manage_user_permissions"),
  UserController.UpdateUserPermissions
);
UserRouter.post(
  "/users/:userId/permissions/undo",
  authenticateToken,
  requirePermission("manage_user_permissions"),
  UserController.UndoPermissionChange
);
UserRouter.post(
  "/users/:userId/permissions/revert",
  authenticateToken,
  requirePermission("manage_user_permissions"),
  UserController.RevertUserPermissions
);

export { UserRouter };
