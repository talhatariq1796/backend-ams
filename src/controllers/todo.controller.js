import * as TodoService from "../services/todo.service.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import { checkUserAuthorization, isAdmin } from "../utils/getUserRole.util.js";

export const CreateTodo = async (req, res, next) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const { title } = req.body;

    if (!title) {
      return AppResponse({
        res,
        statusCode: 400,
        message: "Title is required.",
        success: false,
      });
    }

    const todo = await TodoService.CreateAdminTodoService(req.user, { title });

    AppResponse({
      res,
      statusCode: 201,
      message: "Todo created successfully.",
      data: todo,
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

export const GetTodos = async (req, res, next) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const todos = await TodoService.GetAdminTodosService();

    AppResponse({
      res,
      statusCode: 200,
      message: "Todos fetched successfully.",
      data: todos,
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

export const UpdateTodoStatus = async (req, res, next) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const { id } = req.params;
    const { is_completed } = req.body;

    if (typeof is_completed !== "boolean") {
      return AppResponse({
        res,
        statusCode: 400,
        message:
          "Invalid status value. Please select whether the task is completed or not.",
        success: false,
      });
    }

    const updatedTodo = await TodoService.UpdateAdminTodoStatusService(
      id,
      is_completed
    );

    AppResponse({
      res,
      statusCode: 200,
      message: "Todo status updated successfully.",
      data: updatedTodo,
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

export const DeleteTodo = async (req, res, next) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const { id } = req.params;
    await TodoService.DeleteAdminTodoService(id);

    AppResponse({
      res,
      statusCode: 200,
      message: "Todo deleted successfully.",
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
