import AdminTodo from "../models/todo.model.js";
import AppError from "../middlewares/error.middleware.js";

export const CreateAdminTodoService = async (user, { title }) => {
  if (!title) {
    throw new AppError("Title is required", 400);
  }

  const newTodo = new AdminTodo({
    title,
    created_by: user._id,
    is_completed: false,
  });

  return await newTodo.save();
};

export const GetAdminTodosService = async () => {
  return await AdminTodo.find().sort({ createdAt: -1 });
};

export const UpdateAdminTodoStatusService = async (id, is_completed) => {
  const todo = await AdminTodo.findById(id);
  if (!todo) throw new AppError("Todo not found", 404);
  todo.is_completed = is_completed;
  return await todo.save();
};

export const DeleteAdminTodoService = async (id) => {
  const result = await AdminTodo.findByIdAndDelete(id);
  if (!result) throw new AppError("Todo not found", 404);
};
