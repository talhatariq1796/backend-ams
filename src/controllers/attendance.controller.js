import AppError, { AppResponse } from "../middlewares/error.middleware.js";
import * as AttendanceService from "../services/attendance.service.js";
import {
  checkUserAuthorization,
  isAdminOrTeamLead,
} from "../utils/getUserRole.util.js";
import redisClient from "../utils/redisClient.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import { generateExcel, generatePDF } from "../utils/reportGenerator.util.js";
import Users from "../models/user.model.js";

export const MarkAttendance = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    // 🚫 Detect automation
    const userAgent = req.headers["user-agent"] || "";
    if (
      !userAgent ||
      /bot|postman|curl|python|axios|insomnia|http|fetch/i.test(
        userAgent.toLowerCase(),
      )
    ) {
      throw new AppError("Automated requests are not allowed", 403);
    }

    // const fingerprint = req.headers["x-fingerprint"];
    // if (!fingerprint || fingerprint.length < 20) {
    //   throw new AppError("Missing or invalid fingerprint", 403);
    // }

    // Proceed
    const { checkin, date, marked_by } = req.body;

    if (typeof checkin === "undefined" || !date || !marked_by) {
      throw new AppError("Missing required field", 400);
    }

    const response = await AttendanceService.MarkAttendanceService(
      req,
      req.user._id,
      date,
      checkin,
      marked_by,
    );

    const attendance = response.attendance;
    const is_remote = response.is_remote;

    // Notification logic
    let message = "";
    let notifyAdmins = false;
    let notification_to = null;

    if (checkin && is_remote) {
      message = `checked in remotely.`;
      notifyAdmins = true;
      // User doesn't need notification about their own check-in
    } else if (
      !checkin &&
      (attendance.status === "leave" || attendance.status === "half-day")
    ) {
      message = `attendance was auto-marked as ${attendance.status} due to insufficient working hours.`;
      notifyAdmins = true;
      notification_to = req.user._id;
    } else {
      message = checkin ? `checked in.` : `checked out.`;
    }

    await createLogsAndNotification({
      notification_by: req.user._id,
      ...(notification_to && { notification_to }),
      type: NOTIFICATION_TYPES.ATTENDANCE,
      message,
      notifyAdmins,
    });

    await clearAttendanceCache(req.user._id);
    return AppResponse({
      res,
      statusCode: 201,
      message: "Attendance marked successfully",
      data: response,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const MarkAttendanceByAdmin = async (req, res) => {
  try {
    isAdmin(req.user);
    const { user_id, date, check_in, check_out, status } = req.body;

    if (!user_id || !date) {
      throw new AppError("user_id and date are required", 400);
    }

    const attendance = await AttendanceService.MarkAttendanceByAdminService({
      user_id,
      date,
      check_in,
      check_out,
      status,
      marked_by: req.user._id,
    });

    return AppResponse({
      res,
      statusCode: 200,
      message: "Attendance marked successfully by admin",
      data: attendance,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const EditAttendanceByAdmin = async (req, res) => {
  try {
    isAdminOrTeamLead(req.user);

    const { attendance_id, updates } = req.body;
    if (!attendance_id || !updates) {
      throw new AppError("Attendance id and updates are required", 400);
    }

    const attendance = await AttendanceService.EditAttendanceByAdminService({
      attendance_id,
      updates,
      updated_by: req.user._id,
    });

    return AppResponse({
      res,
      statusCode: 200,
      message: "Attendance updated successfully",
      data: attendance,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetAttendanceRecords = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { employee_id, type, month, year, date, start_date, end_date } =
      req.query;
    const role = req.user.role;

    if (role === "employee" && !employee_id) {
      return AppResponse({
        res,
        statusCode: 403,
        message: "Unauthorized: Employees must provide their id.",
        success: false,
      });
    }

    const response = await AttendanceService.GetAttendanceRecordsService({
      employee_id,
      type,
      month,
      year,
      date,
      start_date,
      end_date,
      role,
    });

    return AppResponse({
      res,
      statusCode: 200,
      message: "Attendance records retrieved successfully",
      data: response,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetTodaysAttendance = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { user_id } = req.query;

    const attendance = await AttendanceService.GetTodaysAttendanceService(
      req.user,
      user_id,
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Today's attendance fetched successfully",
      data: attendance,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetAttendanceHistory = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const {
      filter_type,
      start_date,
      end_date,
      status,
      user_id,
      page,
      limit,
      search,
      department_id,
      employment_type,
    } = req.query;

    const response = await AttendanceService.GetAttendanceHistoryService(
      req.user,
      filter_type,
      start_date,
      end_date,
      status,
      user_id,
      page,
      limit,
      search,
      department_id,
      employment_type,
    );

    // if (!response.success) {
    //   return AppResponse({
    //     res,
    //     statusCode: 404,
    //     message: response.message,
    //     success: false,
    //   });
    // }

    return AppResponse({
      res,
      statusCode: 200,
      message: "Attendance history fetched successfully",
      data: response,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetAttendanceStats = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { filter_type, user_id, start_date, end_date } = req.query;

    // if (
    //   !filter_type ||
    //   !["week", "month", "3days", "year", "all"].includes(filter_type)
    // ) {
    //   return AppResponse({
    //     res,
    //     statusCode: 400,
    //     message:
    //       "Valid filter_type parameter is required (week, month, 3days, year, all)",
    //     success: false,
    //   });
    // }

    const response = await AttendanceService.GetAttendanceStatsService(
      req.user,
      filter_type,
      user_id,
      start_date,
      end_date,
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: `Attendance stats for ${req.user.first_name} fetched successfully`,
      data: response,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetMonthlyAttendance = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const {
      month,
      year,
      department_id,
      search,
      user_id,
      page = 1,
      limit = 10,
    } = req.query;

    if (!month || !year) {
      return AppResponse({
        res,
        statusCode: 400,
        message: "Month and Year are required",
        success: false,
      });
    }

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;

    const data = await AttendanceService.GetMonthlyAttendanceService(
      req.user,
      parseInt(month),
      parseInt(year),
      department_id,
      search,
      user_id,
      pageNumber,
      limitNumber,
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Monthly attendance fetched successfully",
      data,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const GetAttendanceStatusByDate = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { user_id, date } = req.query;

    if (
      req.user.role !== "admin" &&
      user_id &&
      user_id !== req.user._id.toString()
    ) {
      return AppResponse({
        res,
        statusCode: 403,
        message: "Unauthorized: You can only view your own attendance",
        success: false,
      });
    }

    const queryUserId = user_id || req.user._id;

    const response = await AttendanceService.GetAttendanceStatusByDateService(
      queryUserId,
      date,
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: response.message || "Attendance status retrieved successfully",
      data: response.data,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

export const clearAttendanceCache = async (userId) => {
  try {
    const keys = await redisClient.keys(`attendance_*${userId}*`);
    if (keys.length) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error("❌ Error clearing attendance cache:", error.message);
  }
};
export const GetTodayAttendanceStats = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { department_id, employment_type } = req.query;

    const stats = await AttendanceService.GetTodayAttendanceStatsService({
      user: req.user,
      department_id,
      employment_type,
    });

    return AppResponse({
      res,
      statusCode: 200,
      message: "Today's attendance stats fetched successfully",
      data: stats,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch today's attendance stats",
      success: false,
    });
  }
};

export const DownloadAttendanceReport = async (req, res, next) => {
  try {
    const { report_type, file_type, ...filters } = req.body;
    let data;

    switch (report_type) {
      case "month_history":
        data = await AttendanceService.DownloadMonthlyAttendanceService(
          req.user,
          filters.month,
          filters.year,
          filters.department_id,
          filters.search,
        );
        break;

      case "today":
        data = await AttendanceService.DownloadTodaysAttendanceService(
          req.user,
          filters.department_id,
          filters.employment_type,
          filters.search,
        );
        break;

      case "history":
        data = await AttendanceService.DownloadAttendanceHistoryService(
          req.user,
          filters.filter_type,
          filters.start_date,
          filters.end_date,
          filters.status,
          filters.user_id,
          filters.search,
          filters.department_id,
          filters.employment_type,
        );
        break;

      default:
        throw new AppError("Invalid report type", 400);
    }

    let buffer;
    const options = {
      month: filters.month,
      year: filters.year,
    };

    // Helper function to sanitize filename
    const sanitizeFileName = (name) => {
      return name
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    // Generate dynamic filename based on report type and filters
    let filename = `attendance_${report_type}`;
    let employeeName = null;
    let isAllEmployees = false;

    if (report_type === "today") {
      // For "today" report: use employee name if search is provided or only one employee in results
      if (filters.search && data && data.length > 0) {
        employeeName = data[0].employee || filters.search;
      } else if (data && data.length === 1) {
        // Single employee result even without search
        employeeName = data[0].employee;
      } else if (data && data.length > 1) {
        // Multiple employees - all employees report
        isAllEmployees = true;
      }

      if (employeeName) {
        const sanitizedName = sanitizeFileName(employeeName);
        filename = `${sanitizedName} - Today Attendance`;
      } else if (isAllEmployees) {
        const today = new Date();
        const dateStr = today.toISOString().split("T")[0];
        filename = `All Employees - Today Attendance ${dateStr}`;
      }
    } else if (report_type === "history") {
      // For "history" report: use employee name if user_id or search is provided
      if (filters.user_id) {
        try {
          const user = await Users.findById(filters.user_id)
            .select("first_name last_name")
            .lean();
          if (user) {
            employeeName = `${user.first_name} ${user.last_name}`;
          }
        } catch (error) {
          console.error("Error fetching user for filename:", error);
        }
      } else if (filters.search && data && data.length > 0) {
        // Extract name from first record
        const firstRecord = data[0];
        if (firstRecord.user) {
          employeeName =
            firstRecord.user.first_name && firstRecord.user.last_name
              ? `${firstRecord.user.first_name} ${firstRecord.user.last_name}`
              : filters.search;
        } else {
          employeeName = filters.search;
        }
      } else if (data && data.length > 0) {
        // Multiple records without specific user/search - all employees report
        isAllEmployees = true;
      }

      // Get date range for filename
      let dateRange = "";
      if (filters.start_date && filters.end_date) {
        const startDate = new Date(filters.start_date)
          .toISOString()
          .split("T")[0];
        const endDate = new Date(filters.end_date).toISOString().split("T")[0];
        dateRange = ` ${startDate} to ${endDate}`;
      } else if (filters.filter_type) {
        dateRange = ` ${filters.filter_type}`;
      }

      if (employeeName) {
        const sanitizedName = sanitizeFileName(employeeName);
        filename = `${sanitizedName} - Attendance History${dateRange}`;
      } else if (isAllEmployees) {
        filename = `All Employees - Attendance History${dateRange}`;
      }
    } else if (report_type === "month_history") {
      // For "month_history" report: use employee name if search is provided
      if (filters.search && data && data.length > 0) {
        const firstRecord = data[0];
        if (firstRecord.user && firstRecord.user.name) {
          employeeName = firstRecord.user.name;
        } else {
          employeeName = filters.search;
        }
      } else if (data && data.length > 0) {
        // Multiple records without search - all employees report
        isAllEmployees = true;
      }

      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const monthName =
        monthNames[filters.month - 1] || `Month ${filters.month}`;

      if (employeeName) {
        const sanitizedName = sanitizeFileName(employeeName);
        filename = `${sanitizedName} - ${monthName} ${filters.year} Attendance`;
      } else if (isAllEmployees) {
        filename = `All Employees - ${monthName} ${filters.year} Attendance`;
      }
    }

    if (file_type === "excel") {
      buffer = await generateExcel(data, report_type, options);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${filename}.xlsx`,
      );
    } else if (file_type === "pdf") {
      buffer = await generatePDF(data, report_type, options);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${filename}.pdf`,
      );
    } else {
      throw new AppError("Invalid file type", 400);
    }

    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Get today's attendance for manager's team with filters
 * GET /api/attendance/manager/today
 */
export const GetManagerTodayAttendance = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { status, team_id, search, page = 1, limit = 10 } = req.query;

    const result = await AttendanceService.GetManagerTodayAttendanceService(
      req.user,
      {
        status,
        team_id,
        search,
        page,
        limit,
      }
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Today's team attendance fetched successfully",
      data: result,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};

/**
 * Get today's attendance summary for manager's team
 * GET /api/attendance/manager/summary
 */
export const GetManagerTodayAttendanceSummary = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const { team_id } = req.query;

    const summary = await AttendanceService.GetManagerTodayAttendanceSummaryService(
      req.user,
      team_id
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Today's attendance summary fetched successfully",
      data: summary,
      success: true,
    });
  } catch (error) {
    return AppResponse({
      res,
      statusCode: error.statusCode || 500,
      message: error.message,
      success: false,
    });
  }
};
