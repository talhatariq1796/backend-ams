import AdminTodo from "../models/todo.model.js";
import AppError from "../middlewares/error.middleware.js";
import { getCompanyId } from "../utils/company.util.js";

export const CreateAdminTodoService = async (req, { title }) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const user = req.user;

  if (!title) {
    throw new AppError("Title is required", 400);
  }

  const newTodo = new AdminTodo({
    company_id: companyId,
    title,
    created_by: user._id,
    is_completed: false,
  });

  return await newTodo.save();
};

export const GetAdminTodosService = async (req) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  return await AdminTodo.find({ company_id: companyId }).sort({
    createdAt: -1,
  });
};

export const UpdateAdminTodoStatusService = async (req, id, is_completed) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const todo = await AdminTodo.findOne({ _id: id, company_id: companyId });
  if (!todo) throw new AppError("Todo not found", 404);
  todo.is_completed = is_completed;
  return await todo.save();
};

export const DeleteAdminTodoService = async (req, id) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const result = await AdminTodo.findOneAndDelete({
    _id: id,
    company_id: companyId,
  });
  if (!result) throw new AppError("Todo not found", 404);
};
