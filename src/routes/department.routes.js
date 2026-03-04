import express from "express";
import * as DepartmentController from "../controllers/department.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission, requireAnyPermission } from "../middlewares/permission.middleware.js";
import { cacheMiddleware } from "../middlewares/cache.middleware.js";

const DepartmentRouter = express.Router();

DepartmentRouter.post(
  "/department",
  authenticateToken,
  requirePermission("manage_departments"),
  DepartmentController.CreateDepartment
);
DepartmentRouter.get(
  "/departments",
  authenticateToken,
  requirePermission("view_departments"),
  DepartmentController.GetAllDepartments
);
DepartmentRouter.get(
  "/departments/:departmentId",
  authenticateToken,
  requirePermission("view_departments"),
  DepartmentController.GetDepartmentById
);

DepartmentRouter.get(
  "/department-stats",
  authenticateToken,
  requirePermission("view_departments"),
  DepartmentController.GetDepartmentStats
);
DepartmentRouter.put(
  "/departments/:departmentId",
  authenticateToken,
  requireAnyPermission(["manage_departments", "manage_own_department"]),
  DepartmentController.UpdateDepartment
);
DepartmentRouter.delete(
  "/departments/:departmentId",
  authenticateToken,
  requireAnyPermission(["manage_departments", "manage_own_department"]),
  DepartmentController.DeleteDepartment
);
// DepartmentRouter.delete(
//   "/departments/:departmentId/teams/:teamId",
//   authenticateToken,
//   DepartmentController.DeleteTeamFromDepartment
// );

export { DepartmentRouter };
