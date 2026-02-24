import express from "express";
import * as RemoteWorkController from "../../controllers/requests/remotework.controller.js";
import { authenticateToken } from "../../middlewares/user.middleware.js";

const RemoteWorkRouter = express.Router();

RemoteWorkRouter.post(
  "/remote-work/request",
  authenticateToken,
  RemoteWorkController.RequestRemoteWork
);
RemoteWorkRouter.get(
  "/remote-work/requests",
  authenticateToken,
  RemoteWorkController.GetRemoteWorkRequests
);
RemoteWorkRouter.get(
  "/remote-work/approved",
  authenticateToken,
  RemoteWorkController.GetApprovedRemoteWorkByDate
);

RemoteWorkRouter.put(
  "/remote-work/edit/:request_id",
  authenticateToken,
  RemoteWorkController.EditOwnRemoteWorkRequest
);

RemoteWorkRouter.put(
  "/remote-work/update/:request_id",
  authenticateToken,
  RemoteWorkController.UpdateRemoteWorkStatus
);
RemoteWorkRouter.delete(
  "/remote-work/delete/:request_id",
  authenticateToken,
  RemoteWorkController.DeleteRemoteWorkRequest
);
RemoteWorkRouter.get(
  "/remote-work/pending-count",
  authenticateToken,
  RemoteWorkController.GetPendingRemoteWorkCount
);

RemoteWorkRouter.put(
  "/remote-work/update-multiple-user",
  authenticateToken,
  RemoteWorkController.AssignRemoteWorkToUsers
);

RemoteWorkRouter.put(
  "/remote-work/admin-update/:request_id",
  authenticateToken,
  RemoteWorkController.AdminUpdateRemoteWorkRequest
);
export { RemoteWorkRouter };
