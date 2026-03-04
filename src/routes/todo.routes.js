import express from "express";
import * as AdminTodoController from "../controllers/todo.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const AdminTodoRouter = express.Router();

AdminTodoRouter.post(
  "/admin/todo",
  authenticateToken,
  requirePermission("configure_staff_schedules"),
  AdminTodoController.CreateTodo
);

AdminTodoRouter.get(
  "/admin/todos",
  authenticateToken,
  requirePermission("configure_staff_schedules"),
  AdminTodoController.GetTodos
);

AdminTodoRouter.patch(
  "/admin/todo/:id",
  authenticateToken,
  requirePermission("configure_staff_schedules"),
  AdminTodoController.UpdateTodoStatus
);

AdminTodoRouter.delete(
  "/admin/todo/:id",
  authenticateToken,
  requirePermission("configure_staff_schedules"),
  AdminTodoController.DeleteTodo
);

export { AdminTodoRouter };
