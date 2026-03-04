import express from "express";
import * as RemoteWorkController from "../../controllers/requests/remotework.controller.js";
import { authenticateToken } from "../../middlewares/user.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";

const RemoteWorkRouter = express.Router();

RemoteWorkRouter.post(
  "/remote-work/request",
  authenticateToken,
  requirePermission("apply_for_wfh"),
  RemoteWorkController.RequestRemoteWork
);
RemoteWorkRouter.get(
  "/remote-work/requests",
  authenticateToken,
  requirePermission("view_wfh_requests"),
  RemoteWorkController.GetRemoteWorkRequests
);
RemoteWorkRouter.get(
  "/remote-work/approved",
  authenticateToken,
  requirePermission("view_wfh_requests"),
  RemoteWorkController.GetApprovedRemoteWorkByDate
);

RemoteWorkRouter.put(
  "/remote-work/edit/:request_id",
  authenticateToken,
  requirePermission("apply_for_wfh"),
  RemoteWorkController.EditOwnRemoteWorkRequest
);

RemoteWorkRouter.put(
  "/remote-work/update/:request_id",
  authenticateToken,
  requirePermission("approve_wfh"),
  RemoteWorkController.UpdateRemoteWorkStatus
);
RemoteWorkRouter.delete(
  "/remote-work/delete/:request_id",
  authenticateToken,
  requirePermission("apply_for_wfh"),
  RemoteWorkController.DeleteRemoteWorkRequest
);
RemoteWorkRouter.get(
  "/remote-work/pending-count",
  authenticateToken,
  requirePermission("view_wfh_requests"),
  RemoteWorkController.GetPendingRemoteWorkCount
);

RemoteWorkRouter.put(
  "/remote-work/update-multiple-user",
  authenticateToken,
  requirePermission("approve_wfh"),
  RemoteWorkController.AssignRemoteWorkToUsers
);

RemoteWorkRouter.put(
  "/remote-work/admin-update/:request_id",
  authenticateToken,
  requirePermission("approve_wfh"),
  RemoteWorkController.AdminUpdateRemoteWorkRequest
);
export { RemoteWorkRouter };
