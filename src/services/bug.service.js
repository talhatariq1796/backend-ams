import AppError from "../middlewares/error.middleware.js";
import BugReport from "../models/bug.model.js";
import { getCompanyId } from "../utils/company.util.js";

export const CreateBug = async (req, bugData) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const { title, details, screenshots, reported_by } = bugData;
  const bug = new BugReport({
    company_id: companyId,
    title,
    details,
    screenshots,
    reported_by,
  });
  await bug.save();
  return bug;
};

export const GetAllBugs = async (req) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  return await BugReport.find({ company_id: companyId })
    .populate("reported_by", "first_name last_name email")
    .sort({ created_at: -1 });
};

export const UpdateBugStatus = async (req, id, status) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const bug = await BugReport.findOneAndUpdate(
    { _id: id, company_id: companyId },
    { status },
    { new: true }
  );
  if (!bug) throw new AppError("Bug not found", 404);
  return bug;
};

export const DeleteBug = async (req, id) => {
  const companyId = getCompanyId(req);
  if (!companyId) throw new AppError("Company context required", 403);

  const bug = await BugReport.findOneAndDelete({
    _id: id,
    company_id: companyId,
  });
  if (!bug) throw new AppError("Bug not found", 404);
  return bug;
};
