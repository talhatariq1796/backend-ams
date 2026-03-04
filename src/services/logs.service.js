import Logs from "../models/logs.model.js";
import { getCompanyId } from "../utils/company.util.js";
import AppError from "../middlewares/error.middleware.js";

export const CreateLogsService = async (req, logData) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const { action_to, action_by, type, message } = logData;
  const log = await Logs.create({
    company_id: companyId,
    action_to,
    action_by,
    type,
    message,
  });
  return log;
};

export const GetLogsService = async (req) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const userId = req.user?._id;
  const page = req.query?.page || 1;
  const limit = req.query?.limit || 10;
  const skip = (page - 1) * parseInt(limit);

  const [logs, total] = await Promise.all([
    Logs.find({ company_id: companyId, action_by: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Logs.countDocuments({ company_id: companyId, action_by: userId }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = parseInt(page);
  const hasMorePages = totalPages > currentPage;

  return {
    logs,
    total,
    currentPage,
    totalPages,
    hasMorePages,
  };
};
