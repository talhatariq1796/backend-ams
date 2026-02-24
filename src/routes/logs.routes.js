import express from "express";
import * as LogsController from "../controllers/logs.controller.js";
import { authenticateToken } from "../middlewares/user.middleware.js";

const LogsRouter = express.Router();

LogsRouter.get("/logs", authenticateToken, LogsController.GetLogs);

export { LogsRouter };
