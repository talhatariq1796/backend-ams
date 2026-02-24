import express from "express";
import * as DocumentController from "../controllers/document.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const DocumentRouter = express.Router();

DocumentRouter.post(
  "/document/upload",
  authenticateToken,
  DocumentController.UploadDocument
);

DocumentRouter.put(
  "/document/:id",
  authenticateToken,
  DocumentController.UpdateDocument
);

DocumentRouter.delete(
  "/document/:id",
  authenticateToken,
  DocumentController.DeleteDocument
);

DocumentRouter.get(
  "/documents",
  authenticateToken,
  DocumentController.FetchDocuments
);

DocumentRouter.get(
  "/documents/types",
  authenticateToken,
  DocumentController.GetDocumentTypes
);
DocumentRouter.get(
  "/documents/visibilities",
  authenticateToken,
  DocumentController.GetDocumentVisibilities
);

export { DocumentRouter };
