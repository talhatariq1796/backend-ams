import express from "express";
import { authenticateToken } from "../middlewares/user.middleware.js";
import * as AttendanceController from "../controllers/attendance.controller.js";
import { cacheMiddleware } from "../middlewares/cache.middleware.js";

const AttendanceRouter = express.Router();

AttendanceRouter.post(
  "/attendance/mark",
  authenticateToken,
  AttendanceController.MarkAttendance
);

AttendanceRouter.post(
  "/attendance/admin-mark",
  authenticateToken,
  AttendanceController.MarkAttendanceByAdmin
);

AttendanceRouter.put(
  "/attendance/admin-edit",
  authenticateToken,
  AttendanceController.EditAttendanceByAdmin
);

AttendanceRouter.get(
  "/attendance",
  authenticateToken,
  // cacheMiddleware("attendance_all_"),
  AttendanceController.GetAttendanceRecords
);

AttendanceRouter.get(
  "/attendance/today",
  authenticateToken,
  // cacheMiddleware("attendance_today_", 30), // cache for 30 seconds
  AttendanceController.GetTodaysAttendance
);

AttendanceRouter.get(
  "/attendance/history",
  authenticateToken,
  // cacheMiddleware("attendance_history_"),
  AttendanceController.GetAttendanceHistory
);

AttendanceRouter.get(
  "/attendance/month-history",
  authenticateToken,
  // cacheMiddleware("attendance_history_"),
  AttendanceController.GetMonthlyAttendance
);

AttendanceRouter.get(
  "/attendance/stats",
  authenticateToken,
  // cacheMiddleware("attendance_stats_"),
  AttendanceController.GetAttendanceStats
);

AttendanceRouter.get(
  "/attendance/status-by-date",
  authenticateToken,
  // cacheMiddleware("attendance_status_"),
  AttendanceController.GetAttendanceStatusByDate
);

AttendanceRouter.get(
  "/attendance/today-stats",
  authenticateToken,
  // cacheMiddleware("attendance_status_"),
  AttendanceController.GetTodayAttendanceStats
);

AttendanceRouter.get(
  "/attendance/manager/today",
  authenticateToken,
  AttendanceController.GetManagerTodayAttendance
);

AttendanceRouter.get(
  "/attendance/manager/summary",
  authenticateToken,
  AttendanceController.GetManagerTodayAttendanceSummary
);

AttendanceRouter.post(
  "/attendance/download-report",
  authenticateToken,
  AttendanceController.DownloadAttendanceReport
);

export { AttendanceRouter };
