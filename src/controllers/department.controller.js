import { AppResponse } from "../middlewares/error.middleware.js";
import * as DepartmentService from "../services/department.service.js";
import { checkUserAuthorization, isAdmin } from "../utils/getUserRole.util.js";
import redisClient from "../utils/redisClient.js";
import { createLogsAndNotification } from "../utils/logNotification.js";
import { NOTIFICATION_TYPES } from "../constants/notificationTypes.js";

export const CreateDepartment = async (req, res) => {
  try {
    checkUserAuthorization(req.user);
    isAdmin(req.user);
    const newDepartment = await DepartmentService.CreateDepartmentService(
      req.body
    );

    if (newDepartment) {
      await createLogsAndNotification({
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
    isAdmin(req.user);

    const departments = await DepartmentService.GetAllDepartmentsService();

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
    isAdmin(req.user);

    const department = await DepartmentService.GetDepartmentByIdService(
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
    isAdmin(req.user);

    const stats = await DepartmentService.GetDepartmentStatsService();

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
    isAdmin(req.user);

    const updatedDepartment = await DepartmentService.UpdateDepartmentService(
      req.params.departmentId,
      req.body
    );
    if (updatedDepartment) {
      await createLogsAndNotification({
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
    isAdmin(req.user);
    checkUserAuthorization(req.user);

    const deleteDepartment = await DepartmentService.DeleteDepartmentService(
      req.params.departmentId
    );

    if (deleteDepartment) {
      await createLogsAndNotification({
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
  const keys = await redisClient.keys("departments_*");
  const statKeys = await redisClient.keys("department_stats_*");
  const allKeys = [...keys, ...statKeys];

  if (allKeys.length > 0) {
    await redisClient.del(allKeys);
  }
};
