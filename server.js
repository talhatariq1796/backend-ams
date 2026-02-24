import dotenv from "dotenv";
dotenv.config();

import http from "http";
import { app } from "./src/app.js";
import { DBConnect } from "./src/utils/dbConnect.util.js";
// Import application routes and services (moved from api/index.js)
import "./src/services/firebase_services.js";
import { UserRouter } from "./src/routes/user.routes.js";
import { DepartmentRouter } from "./src/routes/department.routes.js";
import TeamRouter from "./src/routes/team.routes.js";
import ManagerRouter from "./src/routes/manager.routes.js";
import { AttendanceRouter } from "./src/routes/attendance.routes.js";
import { LeaveRouter } from "./src/routes/requests/leave.routes.js";
import { ConfigRouter } from "./src/routes/config.routes.js";
import { WorkingHoursRequestRouter } from "./src/routes/requests/workinghours.routes.js";
import { RemoteWorkRouter } from "./src/routes/requests/remotework.routes.js";
import { BookMeetingRoomRouter } from "./src/routes/requests/bookmeetingroom.routes.js";
import { SuggestionRouter } from "./src/routes/suggestion.routes.js";
import { WorkingHoursRouter } from "./src/routes/workingHours.routes.js";
import { EventRouter } from "./src/routes/event.routes.js";
import { NotificationRouter } from "./src/routes/notification.routes.js";
import { LogsRouter } from "./src/routes/logs.routes.js";
import { LeaveStatsRouter } from "./src/routes/leaveStats.routes.js";
import { RequestDashboardRouter } from "./src/routes/requests/requesDashbaord.routes.js";
import StorageRouter from "./src/routes/storage.routes.js";
import { recentRequestRouter } from "./src/routes/requests/recentRequests.routes.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger.js";
import { AdminTodoRouter } from "./src/routes/todo.routes.js";
import { DocumentRouter } from "./src/routes/document.routes.js";
import { BugRouter } from "./src/routes/bug.routes.js";
import TicketRouter from "./src/routes/ticket.router.js";
import cors from "cors";

// Setup CORS
app.use(
  cors({
    origin: [process.env.LOCAL_FRONTEND_URL, process.env.LIVE_FRONTEND_URL],
    credentials: true,
  }),
);

// Register Routes
app.use("/api", UserRouter);
app.use("/api", DepartmentRouter);
app.use("/api", TeamRouter);
app.use("/api", ManagerRouter);
app.use("/api", AttendanceRouter);
app.use("/api", LeaveRouter);
app.use("/api", ConfigRouter);
app.use("/api", WorkingHoursRequestRouter);
app.use("/api", RemoteWorkRouter);
app.use("/api", BookMeetingRoomRouter);
app.use("/api", SuggestionRouter);
app.use("/api", WorkingHoursRouter);
app.use("/api", EventRouter);
app.use("/api", NotificationRouter);
app.use("/api", LogsRouter);
app.use("/api", LeaveStatsRouter);
app.use("/api", recentRequestRouter);
app.use("/api", RequestDashboardRouter);
app.use("/api", AdminTodoRouter);
app.use("/api", DocumentRouter);
app.use("/api", BugRouter);
app.use("/api", TicketRouter);
app.use("/api", StorageRouter);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", service: "ams-be" });
});

// Export a serverless handler for Vercel
export default function handler(req, res) {
  return app(req, res);
}

// Local development: connect DB, start cron jobs and HTTP server
if (process.env.NODE_ENV !== "production") {
  (async () => {
    try {
      await DBConnect();

      const { default: resetTokenCleaner } =
        await import("./src/cronJobs/resetTokenCleaner.js");
      resetTokenCleaner.start();

      const { default: attendanceRegularizer } =
        await import("./src/cronJobs/attendanceRegularizer.js");
      attendanceRegularizer.start();

      const { default: resetExpiredWorkingHours } =
        await import("./src/cronJobs/resetExpiredWorkingHours.js");
      resetExpiredWorkingHours.start();

      const { default: celebrationPost } =
        await import("./src/cronJobs/celebrationPost.cron.js");
      celebrationPost.start();

      const { default: initializeLeaveStats } =
        await import("./src/cronJobs/initializeLeaveStats.cron.js");
      initializeLeaveStats.start();

      // Start workers
      await import("./src/workers/trackActionWorker.js");

      const PORT = process.env.PORT || 8000;
      const server = http.createServer(app);
      server.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
      });
    } catch (error) {
      console.error("❌ Error starting local server:", error);
    }
  })();
}
