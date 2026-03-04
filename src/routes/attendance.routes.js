import express from "express";
import { authenticateToken } from "../middlewares/user.middleware.js";
import { requirePermission, requireAnyPermission } from "../middlewares/permission.middleware.js";
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
  requirePermission("save_all_attendance"),
  AttendanceController.MarkAttendanceByAdmin
);

AttendanceRouter.put(
  "/attendance/admin-edit",
  authenticateToken,
  requireAnyPermission(["can_edit_all_attendance", "can_edit_team_attendance"]),
  AttendanceController.EditAttendanceByAdmin
);

AttendanceRouter.get(
  "/attendance",
  authenticateToken,
  requirePermission("view_attendance_status"),
  // cacheMiddleware("attendance_all_"),
  AttendanceController.GetAttendanceRecords
);

AttendanceRouter.get(
  "/attendance/today",
  authenticateToken,
  requirePermission("view_attendance_status"),
  AttendanceController.GetTodaysAttendance
);

AttendanceRouter.get(
  "/attendance/history",
  authenticateToken,
  requirePermission("view_attendance_status"),
  AttendanceController.GetAttendanceHistory
);

AttendanceRouter.get(
  "/attendance/month-history",
  authenticateToken,
  requirePermission("view_attendance_status"),
  AttendanceController.GetMonthlyAttendance
);

AttendanceRouter.get(
  "/attendance/stats",
  authenticateToken,
  requirePermission("view_attendance_status"),
  AttendanceController.GetAttendanceStats
);

AttendanceRouter.get(
  "/attendance/status-by-date",
  authenticateToken,
  requirePermission("view_attendance_status"),
  AttendanceController.GetAttendanceStatusByDate
);

AttendanceRouter.get(
  "/attendance/today-stats",
  authenticateToken,
  requirePermission("view_attendance_status"),
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
  requirePermission("export_attendance_reports"),
  AttendanceController.DownloadAttendanceReport
);

export { AttendanceRouter };
