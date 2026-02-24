import { getRecentRequestsService } from "../../services/requests/recentRequest.service.js";
import { AppResponse } from "../../middlewares/error.middleware.js";

export const getRecentRequestsController = async (req, res) => {
  try {
    const requester = req.user;
    const { scope = "self" } = req.query;

    const recentRequests = await getRecentRequestsService(requester, scope);

    AppResponse({
      res,
      statusCode: 200,
      message: "Recent requests fetched successfully",
      data: recentRequests,
      success: true,
    });
  } catch (error) {
    console.error("Error in getRecentRequestsController:", error);
    AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Internal server error",
      success: false,
    });
  }
};
