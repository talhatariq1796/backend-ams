import express from "express";
import * as DocumentController from "../controllers/document.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const DocumentRouter = express.Router();

DocumentRouter.post(
  "/document/upload",
  authenticateToken,
  requirePermission("manage_reports"),
  DocumentController.UploadDocument
);

DocumentRouter.put(
  "/document/:id",
  authenticateToken,
  requirePermission("manage_reports"),
  DocumentController.UpdateDocument
);

DocumentRouter.delete(
  "/document/:id",
  authenticateToken,
  requirePermission("manage_reports"),
  DocumentController.DeleteDocument
);

DocumentRouter.get(
  "/documents",
  authenticateToken,
  requirePermission("view_reports"),
  DocumentController.FetchDocuments
);

DocumentRouter.get(
  "/documents/types",
  authenticateToken,
  requirePermission("view_reports"),
  DocumentController.GetDocumentTypes
);
DocumentRouter.get(
  "/documents/visibilities",
  authenticateToken,
  requirePermission("view_reports"),
  DocumentController.GetDocumentVisibilities
);

export { DocumentRouter };
