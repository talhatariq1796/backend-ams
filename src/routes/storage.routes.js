// FIXED ROUTE.JS
import express from "express";
import {
  UploadFile,
  UploadSingleFile,
  UploadMultipleFiles,
  UploadMultipleToOCIParallel, // Import parallel version as well
} from "../storage/storage.js";

const StorageRouter = express.Router();

// Debug middleware
StorageRouter.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl} - Route hit`);
  next();
});

// Upload Single File
StorageRouter.post(
  "/upload/single",
  UploadFile.single("file"),
  UploadSingleFile()
);

// Upload Multiple Files (Sequential processing - safer)
StorageRouter.post(
  "/upload/multiple",
  (req, res, next) => {
    console.log("Multiple upload route middleware hit");
    next();
  },
  UploadFile.array("files", 10),
  (req, res, next) => {
    console.log("After multer - files:", req.files?.length || 0);
    next();
  },
  UploadMultipleFiles()
);

// Upload Multiple Files (Parallel processing - faster)
StorageRouter.post(
  "/upload/multiple/parallel",
  UploadFile.array("files", 10),
  UploadMultipleToOCIParallel()
);

// Test endpoint to verify routes are working
StorageRouter.get("/test", (req, res) => {
  res.json({
    message: "Storage routes are working",
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      "POST /upload/single",
      "POST /upload/multiple",
      "POST /upload/multiple/parallel",
      "GET /test",
    ],
  });
});

export default StorageRouter;
