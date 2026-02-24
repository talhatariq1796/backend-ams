import * as BugService from "../services/bug.service.js";
import { AppResponse } from "../middlewares/error.middleware.js";
import AppError from "../middlewares/error.middleware.js";

export const ReportBug = async (req, res) => {
  try {
    const { title, details, screenshots } = req.body;

    if (!title) throw new AppError("Bug title is required", 400);

    const bug = await BugService.CreateBug({
      title,
      details,
      screenshots,
      reported_by: req.user._id,
    });

    AppResponse({
      res,
      statusCode: 201,
      message: "Bug reported successfully",
      data: bug,
      success: true,
    });
  } catch (err) {
    AppResponse({
      res,
      statusCode: err.statusCode || 500,
      message: err.message || "Internal server error",
      success: false,
    });
  }
};

export const GetAllBugs = async (req, res) => {
  try {
    const bugs = await BugService.GetAllBugs();
    AppResponse({
      res,
      statusCode: 200,
      message: "Bugs fetched successfully",
      data: bugs,
      success: true,
    });
  } catch (err) {
    AppResponse({
      res,
      statusCode: err.statusCode || 500,
      message: err.message || "Internal server error",
      success: false,
    });
  }
};
export const UpdateBugStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
      throw new AppError("Invalid status", 400);
    }

    const updatedBug = await BugService.UpdateBugStatus(id, status);
    AppResponse({
      res,
      statusCode: 200,
      message: "Bug status updated successfully",
      data: updatedBug,
      success: true,
    });
  } catch (err) {
    AppResponse({
      res,
      statusCode: err.statusCode || 500,
      message: err.message || "Internal server error",
      success: false,
    });
  }
};

export const DeleteBug = async (req, res) => {
  try {
    const { id } = req.params;
    await BugService.DeleteBug(id);
    AppResponse({
      res,
      statusCode: 200,
      message: "Bug deleted successfully",
      success: true,
    });
  } catch (err) {
    AppResponse({
      res,
      statusCode: err.statusCode || 500,
      message: err.message || "Internal server error",
      success: false,
    });
  }
};
