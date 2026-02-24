import express from "express";
import * as UserController from "../controllers/user.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
// import { cacheMiddleware } from "../middlewares/cache.middleware.js";

const UserRouter = express.Router();

UserRouter.post(
  "/user/create",
  // authenticateToken,
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
  // cacheMiddleware("users_"),
  UserController.FetchAllUsers
);
UserRouter.get(
  "/users/employees",
  authenticateToken,
  // cacheMiddleware("employees_"),

  UserController.FetchEmployees
);
UserRouter.get(
  "/users/employee/:employeeId",
  authenticateToken,
  // cacheMiddleware("employee_"),
  UserController.FetchEmployee
);
UserRouter.delete(
  "/user/:userId",
  authenticateToken,
  UserController.DeleteUser
);
UserRouter.put(
  "/users/change-activation-status/:userId",
  authenticateToken,
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
  UserController.UpdateUserByAdmin
);

UserRouter.get(
  "/users/admins",
  authenticateToken,
  // cacheMiddleware("admins_"),

  UserController.FetchAllAdmins
);

UserRouter.put(
  "/users/update-role/:userId",
  authenticateToken,
  UserController.UpdateUserRole
);

UserRouter.get(
  "/users/employees/count",
  authenticateToken,
  // cacheMiddleware("employee_count_"),

  UserController.CountEmployees
);

// UserRouter.post("/user/refresh-token", UserController.RefreshAccessToken);

export { UserRouter };
