import Logs from "../models/logs.model.js";

export const CreateLogsService = async ({
  action_to,
  action_by,
  type,
  message,
}) => {
  const log = await Logs.create({
    action_to,
    action_by,
    type,
    message,
  });
  return log;
};

export const GetLogsService = async ({ userId, page, limit }) => {
  const skip = (page - 1) * parseInt(limit);

  const [logs, total] = await Promise.all([
    Logs.find({ action_by: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Logs.countDocuments({ action_by: userId }),
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
