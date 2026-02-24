import { GetPendingLeavesCountService } from "../../services/requests/leave.service.js";
import { GetPendingRemoteWorkCountService } from "../../services/requests/remotework.service.js";
import { GetPendingWorkingHoursCountService } from "../../services/requests/workinghours.service.js";
import { GetNotRespondedSuggestionsCountService } from "../../services/suggestion.service.js";
import { AppResponse } from "../../middlewares/error.middleware.js";

export const GetDashboardCounts = async (req, res, next) => {
  try {
    const [leaveCount, remoteWorkCount, workingHours, suggestions] =
      await Promise.all([
        GetPendingLeavesCountService(req.user),
        GetPendingRemoteWorkCountService(req.user),
        GetPendingWorkingHoursCountService(req.user),
      ]);

    AppResponse({
      res,
      statusCode: 200,
      message: "Dashboard counts fetched successfully",
      data: {
        pendingLeaveCount: leaveCount?.count ?? leaveCount,
        pendingRemoteWorkCount: remoteWorkCount?.count ?? remoteWorkCount,
        pendingWorkingHoursCount: workingHours?.pending_count ?? workingHours,
        notRespondedSuggestionsCount: suggestions?.count ?? suggestions,
      },
      success: true,
    });
  } catch (error) {
    next(error);
  }
};
