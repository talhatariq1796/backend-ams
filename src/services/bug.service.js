import AppError from "../middlewares/error.middleware.js";
import BugReport from "../models/bug.model.js";

export const CreateBug = async ({
  title,
  details,
  screenshots,
  reported_by,
}) => {
  const bug = new BugReport({ title, details, screenshots, reported_by });
  await bug.save();
  return bug;
};

export const GetAllBugs = async () => {
  return await BugReport.find()
    .populate("reported_by", "first_name last_name email")
    .sort({ created_at: -1 });
};

export const UpdateBugStatus = async (id, status) => {
  const bug = await BugReport.findByIdAndUpdate(id, { status }, { new: true });
  if (!bug) throw new AppError("Bug not found", 404);
  return bug;
};

export const DeleteBug = async (id) => {
  const bug = await BugReport.findByIdAndDelete(id);
  if (!bug) throw new AppError("Bug not found", 404);
  return bug;
};
