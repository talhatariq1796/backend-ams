import { app } from "./app.js";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { UserRouter } from "./routes/user.routes.js";
import { DepartmentRouter } from "./routes/department.routes.js";
import TeamRouter from "./routes/team.routes.js";
import CompanyRouter from "./routes/company.routes.js";
import ManagerRouter from "./routes/manager.routes.js";
import { AttendanceRouter } from "./routes/attendance.routes.js";
import { LeaveRouter } from "./routes/requests/leave.routes.js";
import { ConfigRouter } from "./routes/config.routes.js";
import { PermissionRouter } from "./routes/permission.routes.js";
import { WorkingHoursRequestRouter } from "./routes/requests/workinghours.routes.js";
import { RemoteWorkRouter } from "./routes/requests/remotework.routes.js";
import { BookMeetingRoomRouter } from "./routes/requests/bookmeetingroom.routes.js";
import { SuggestionRouter } from "./routes/suggestion.routes.js";
import { WorkingHoursRouter } from "./routes/workingHours.routes.js";
import { DBConnect } from "./utils/dbConnect.util.js";
import { EventRouter } from "./routes/event.routes.js";
import cleanExpiredResetTokens from "./cronJobs/resetTokenCleaner.js";
import regularizeAttendance from "./cronJobs/attendanceRegularizer.js";
import initializeLeaveStatsJob from "./cronJobs/initializeLeaveStats.cron.js";
import { NotificationRouter } from "./routes/notification.routes.js";
import { LogsRouter } from "./routes/logs.routes.js";
import { LeaveStatsRouter } from "./routes/leaveStats.routes.js";
import { RequestDashboardRouter } from "./routes/requests/requesDashbaord.routes.js";
import StorageRouter from "./routes/storage.routes.js";
import { recentRequestRouter } from "./routes/requests/recentRequests.routes.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "../swagger.js";
import "./workers/trackActionWorker.js";
import { AdminTodoRouter } from "./routes/todo.routes.js";
import { DocumentRouter } from "./routes/document.routes.js";
import { BugRouter } from "./routes/bug.routes.js";
import resetExpiredWorkingHours from "./cronJobs/resetExpiredWorkingHours.js";
import celebrationPostJob from "./cronJobs/celebrationPost.cron.js";

dotenv.config();

import "./services/firebase_services.js";
import TicketRouter from "./routes/ticket.router.js";
import {
  globalErrorHandler,
  notFoundHandler,
} from "./middlewares/globalErrorHandler.middleware.js";

DBConnect();

const PORT = process.env.PORT || 8000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});
global.io = io;

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  const isAdmin = socket.handshake.query.isAdmin === "true";

  if (isAdmin) {
    socket.join("admins");
    console.log("🔌 Admin socket connected");
  } else if (userId) {
    socket.join(userId);
    console.log(`🔌 User socket connected: ${userId}`);
  }
  console.log(`🔌 Socket connected: ${userId || "admin"}`);
});

// CORS Configuration
const allowedOrigins = [
  "https://ams-test1.netlify.app",
  process.env.LOCAL_FRONTEND_URL,
  process.env.LIVE_FRONTEND_URL,
].filter(Boolean); // Remove undefined values

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

// Handle preflight requests explicitly
app.options("*", cors());

// Routes

app.use("/api", CompanyRouter);
app.use("/api", UserRouter);
app.use("/api", DepartmentRouter);
app.use("/api", TeamRouter);
app.use("/api", ManagerRouter);
app.use("/api", AttendanceRouter);
app.use("/api", LeaveRouter);
app.use("/api", ConfigRouter);
app.use("/api", PermissionRouter);
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

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", StorageRouter);

// 404 handler for unmatched routes (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

// Cron Jobs
cleanExpiredResetTokens.start();
regularizeAttendance.start();
resetExpiredWorkingHours.start();
celebrationPostJob.start();
initializeLeaveStatsJob.start();

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
