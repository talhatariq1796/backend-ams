import express from "express";
import * as AdminTodoController from "../controllers/todo.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const AdminTodoRouter = express.Router();

AdminTodoRouter.post(
  "/admin/todo",
  authenticateToken,
  AdminTodoController.CreateTodo
);

AdminTodoRouter.get(
  "/admin/todos",
  authenticateToken,
  AdminTodoController.GetTodos
);

AdminTodoRouter.patch(
  "/admin/todo/:id",
  authenticateToken,
  AdminTodoController.UpdateTodoStatus
);

AdminTodoRouter.delete(
  "/admin/todo/:id",
  authenticateToken,
  AdminTodoController.DeleteTodo
);

export { AdminTodoRouter };
