import { AppResponse } from "../middlewares/error.middleware.js";
import * as DepartmentService from "../services/department.service.js";
import { checkUserAuthorization } from "../utils/getUserRole.util.js";
import redisClient from "../utils/redisClient.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";
import { hasPermissionAsync } from "../utils/checkPermission.util.js";
import Team from "../models/team.model.js";
import AppError from "../middlewares/error.middleware.js";

export const CreateDepartment = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    const newDepartment = await DepartmentService.CreateDepartmentService(
      req,
      req.body,
      req.user
    );

    if (newDepartment) {
      createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.DEPARTMENT,
        message: `created a new department ${newDepartment.name}.`,
        notifyAdmins: false,
      });
    }

    await clearDepartmentCache();
    return AppResponse({
      res,
      statusCode: 201,
      message: "Department created successfully.",
      data: newDepartment,
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

export const GetAllDepartments = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const companyId = req.user?.company_id || req.company_id;
    const departments = await DepartmentService.GetAllDepartmentsService(
      companyId
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Departments fetched successfully.",
      data: departments,
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

export const GetDepartmentById = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const companyId = req.user?.company_id || req.company_id;
    const department = await DepartmentService.GetDepartmentByIdService(
      companyId,
      req.params.departmentId
    );

    return AppResponse({
      res,
      statusCode: 200,
      message: "Department fetched successfully.",
      data: department,
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

export const GetDepartmentStats = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const companyId = req.user?.company_id || req.company_id;
    const stats = await DepartmentService.GetDepartmentStatsService(companyId);

    return AppResponse({
      res,
      statusCode: 200,
      message: "Department stats fetched successfully.",
      data: stats,
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

export const UpdateDepartment = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const canManageAll = await hasPermissionAsync(req, "manage_departments");
    if (!canManageAll) {
      const canManageOwn = await hasPermissionAsync(req, "manage_own_department");
      if (!canManageOwn) {
        throw new AppError("You do not have permission to update departments", 403);
      }
      const team = await Team.findById(req.user.team).select("department").lean();
      if (!team || String(team.department) !== String(req.params.departmentId)) {
        throw new AppError("You can only update your own department", 403);
      }
    }

    const companyId = req.user?.company_id || req.company_id;
    const updatedDepartment = await DepartmentService.UpdateDepartmentService(
      companyId,
      req.params.departmentId,
      req.body
    );
    if (updatedDepartment) {
      createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.DEPARTMENT,
        message: `updated department ${updatedDepartment.name}.`,
        notifyAdmins: false,
      });
    }
    await clearDepartmentCache();

    return AppResponse({
      res,
      statusCode: 200,
      message: "Department updated successfully.",
      data: updatedDepartment,
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

export const DeleteDepartment = async (req, res) => {
  try {
    checkUserAuthorization(req.user);

    const canManageAll = await hasPermissionAsync(req, "manage_departments");
    if (!canManageAll) {
      const canManageOwn = await hasPermissionAsync(req, "manage_own_department");
      if (!canManageOwn) {
        throw new AppError("You do not have permission to delete departments", 403);
      }
      const team = await Team.findById(req.user.team).select("department").lean();
      if (!team || String(team.department) !== String(req.params.departmentId)) {
        throw new AppError("You can only delete your own department", 403);
      }
    }

    const companyId = req.user?.company_id || req.company_id;
    const deleteDepartment = await DepartmentService.DeleteDepartmentService(
      companyId,
      req.params.departmentId
    );

    if (deleteDepartment) {
      createLogsAndNotification({
        notification_by: req.user._id,
        type: NOTIFICATION_TYPES.DEPARTMENT,
        message: `deleted department ${deleteDepartment.name}.`,
        notifyAdmins: false,
      });
    }
    await clearDepartmentCache();
    return AppResponse({
      res,
      statusCode: 200,
      message: "Department deleted successfully.",
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

const clearDepartmentCache = async () => {
  // REDIS DISABLED
  // const keys = await redisClient.keys("departments_*");
  // const statKeys = await redisClient.keys("department_stats_*");
  // const allKeys = [...keys, ...statKeys];

  // if (allKeys.length > 0) {
  //   await redisClient.del(allKeys);
  // }
  console.log("⚠️ Redis is disabled - clearDepartmentCache skipped");
};
