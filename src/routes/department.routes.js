import express from "express";
import * as DepartmentController from "../controllers/department.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { cacheMiddleware } from "../middlewares/cache.middleware.js";

const DepartmentRouter = express.Router();

DepartmentRouter.post(
  "/department",
  authenticateToken,
  DepartmentController.CreateDepartment
);
DepartmentRouter.get(
  "/departments",
  authenticateToken,
  // cacheMiddleware("departments_"),
  DepartmentController.GetAllDepartments
);
DepartmentRouter.get(
  "/departments/:departmentId",
  authenticateToken,
  // cacheMiddleware("department_"),
  DepartmentController.GetDepartmentById
);

DepartmentRouter.get(
  "/department-stats",
  authenticateToken,
  // cacheMiddleware("department_stats_"),
  DepartmentController.GetDepartmentStats
);
DepartmentRouter.put(
  "/departments/:departmentId",
  authenticateToken,
  DepartmentController.UpdateDepartment
);
DepartmentRouter.delete(
  "/departments/:departmentId",
  authenticateToken,
  DepartmentController.DeleteDepartment
);
// DepartmentRouter.delete(
//   "/departments/:departmentId/teams/:teamId",
//   authenticateToken,
//   DepartmentController.DeleteTeamFromDepartment
// );

export { DepartmentRouter };
