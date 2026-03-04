import mongoose from "mongoose";
import CompanyConfigs from "../models/config.model.js";
import Users from "../models/user.model.js";
import PermissionChangeLog from "../models/permissionChangeLog.model.js";
import AppError from "../middlewares/error.middleware.js";
import {
  PERMISSION_DEFINITIONS,
  PERMISSION_CATEGORIES,
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
} from "../constants/permissions.js";

const VALID_ROLES = ["super_admin", "admin", "teamLead", "employee"];

/**
 * Get all permission definitions grouped by category (for admin UI).
 */
export const getPermissionDefinitions = () => {
  const byCategory = {};
  Object.values(PERMISSION_CATEGORIES).forEach((cat) => {
    byCategory[cat] = PERMISSION_DEFINITIONS.filter((p) => p.category === cat);
  });
  return {
    categories: PERMISSION_CATEGORIES,
    definitions: PERMISSION_DEFINITIONS,
    byCategory,
  };
};

/**
 * Get role default permission keys for a company (from office config or app defaults).
 */
export const getRoleDefaultPermissions = async (companyId) => {
  if (!companyId) {
    return { ...DEFAULT_ROLE_PERMISSIONS };
  }
  const config = await CompanyConfigs.findOne({ company_id: companyId }).select(
    "role_permissions"
  );
  const rolePerms = config?.role_permissions || {};
  const result = {};
  for (const role of VALID_ROLES) {
    const arr = rolePerms[role];
    result[role] =
      Array.isArray(arr) && arr.length > 0
        ? arr
        : DEFAULT_ROLE_PERMISSIONS[role] || [];
  }
  return result;
};

/**
 * Get default permission keys for a single role in a company.
 */
export const getRoleDefaultPermissionsForRole = async (companyId, role) => {
  const all = await getRoleDefaultPermissions(companyId);
  return all[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
};

/**
 * Compute effective permission keys for a user in a company.
 * Formula: (role default permissions) + overrides; when override is false, permission is denied.
 */
export const getEffectivePermissionsForUser = async (userId, companyId) => {
  const user = await Users.findById(userId)
    .select("role company_id permission_overrides")
    .lean();
  if (!user) throw new AppError("User not found", 404);
  const userCompanyId = user.company_id?.toString();
  const targetCompanyId = companyId?.toString();
  if (targetCompanyId && userCompanyId !== targetCompanyId) {
    throw new AppError("User does not belong to this company", 403);
  }
  const effectiveCompanyId = targetCompanyId || userCompanyId;
  const role = user.role || "employee";
  const roleDefaults = await getRoleDefaultPermissionsForRole(
    effectiveCompanyId,
    role
  );
  const defaultSet = new Set(roleDefaults);
  const overrides = user.permission_overrides;
  const overrideMap =
    overrides && overrides instanceof Map
      ? Object.fromEntries(overrides)
      : overrides && typeof overrides === "object"
        ? overrides
        : {};
  const effective = new Set(defaultSet);
  for (const [key, enabled] of Object.entries(overrideMap)) {
    if (!ALL_PERMISSION_KEYS.includes(key)) continue;
    if (enabled) {
      effective.add(key);
    } else {
      effective.delete(key);
    }
  }
  return Array.from(effective);
};

/**
 * Get permission state for UI: returns ALL permissions with enabled (true/false) and overridden flag.
 * FE can display the full list and set checkboxes from enabled; overridden means admin explicitly set it.
 * Also returns categories so FE can group by category.
 */
export const getPermissionStateForUser = async (userId, companyId) => {
  const [effectiveList, definitions] = await Promise.all([
    getEffectivePermissionsForUser(userId, companyId),
    Promise.resolve(PERMISSION_DEFINITIONS),
  ]);
  const effectiveSet = new Set(effectiveList);
  const user = await Users.findById(userId)
    .select("permission_overrides role")
    .lean();
  const overrides =
    user?.permission_overrides instanceof Map
      ? Object.fromEntries(user.permission_overrides)
      : user?.permission_overrides && typeof user.permission_overrides === "object"
        ? user.permission_overrides
        : {};

  const permissions = [];
  const byCategory = {};

  for (const def of definitions) {
    const enabled = effectiveSet.has(def.key);
    const overridden = Object.prototype.hasOwnProperty.call(overrides, def.key);
    const item = {
      ...def,
      enabled,
      overridden,
    };
    permissions.push(item);
    if (!byCategory[def.category]) byCategory[def.category] = [];
    byCategory[def.category].push(item);
  }

  const activeCount = effectiveSet.size;
  const totalCount = definitions.length;
  const categoriesCount = Object.keys(byCategory).length;

  const recentChangesCount = companyId
    ? await PermissionChangeLog.countDocuments({
        user_id: userId,
        company_id: companyId,
      })
    : 0;

  return {
    categories: { ...PERMISSION_CATEGORIES },
    permissions,
    permissionsByCategory: byCategory,
    summary: {
      activePermissions: activeCount,
      totalPermissions: totalCount,
      categoriesCount,
      recentChangesCount,
    },
    role: user?.role || "employee",
  };
};

/**
 * Check if user has a specific permission in the given company.
 */
export const hasPermission = async (user, permissionKey, companyId) => {
  if (!user || !permissionKey) return false;
  if (user.is_super_admin || user.role === "super_admin") return true;
  const cid = companyId || user.company_id;
  if (!cid) return false;
  const effective = await getEffectivePermissionsForUser(user._id, cid);
  return effective.includes(permissionKey);
};

/**
 * Update a user's permission overrides (admin editing custom permissions).
 * Only the keys present in overrides are updated; all other permissions are left unchanged.
 * overrides: { [permission_key]: boolean } — can be a single key or multiple.
 */
export const updateUserPermissionOverrides = async (
  userId,
  companyId,
  overrides,
  updatedBy
) => {
  if (!userId || !companyId) throw new AppError("User and company required", 400);
  const user = await Users.findById(userId);
  if (!user) throw new AppError("User not found", 404);
  const userCompanyId = user.company_id?.toString();
  if (userCompanyId !== companyId.toString()) {
    throw new AppError("User does not belong to this company", 403);
  }
  const map = user.permission_overrides instanceof Map
    ? new Map(user.permission_overrides)
    : user.permission_overrides && typeof user.permission_overrides === "object"
      ? new Map(Object.entries(user.permission_overrides))
      : new Map();

  const changesToLog = [];
  for (const [key, enabled] of Object.entries(overrides)) {
    if (!ALL_PERMISSION_KEYS.includes(key)) continue;
    if (enabled !== true && enabled !== false) continue;
    const previousOverride = map.has(key) ? map.get(key) : null;
    if (previousOverride === enabled) continue;
    map.set(key, enabled);
    changesToLog.push({
      permission_key: key,
      previous_value: previousOverride === undefined ? null : previousOverride,
      new_value: enabled,
    });
  }

  user.permission_overrides = map;
  await user.save({ validateModifiedOnly: true });

  if (changesToLog.length > 0) {
    const batchId = new mongoose.Types.ObjectId();
    await PermissionChangeLog.insertMany(
      changesToLog.map((c) => ({
        user_id: userId,
        company_id: companyId,
        permission_key: c.permission_key,
        previous_value: c.previous_value,
        new_value: c.new_value,
        changed_by: updatedBy,
        batch_id: batchId,
      }))
    );
  }

  return getPermissionStateForUser(userId, companyId);
};

/**
 * Revert user's custom permissions to role defaults (Remove all overrides).
 */
export const revertUserPermissionsToRoleDefault = async (
  userId,
  companyId,
  updatedBy
) => {
  if (!userId || !companyId) throw new AppError("User and company required", 400);
  const user = await Users.findById(userId);
  if (!user) throw new AppError("User not found", 404);
  const userCompanyId = user.company_id?.toString();
  if (userCompanyId !== companyId.toString()) {
    throw new AppError("User does not belong to this company", 403);
  }
  user.permission_overrides = new Map();
  await user.save({ validateModifiedOnly: true });
  return getPermissionStateForUser(userId, companyId);
};

/**
 * Bulk set: enable all or disable all for a user (sets overrides for every permission).
 */
export const bulkUpdateUserPermissions = async (
  userId,
  companyId,
  action,
  updatedBy
) => {
  if (!["enable_all", "disable_all"].includes(action)) {
    throw new AppError("Invalid action. Use enable_all or disable_all", 400);
  }
  const overrides = {};
  for (const key of ALL_PERMISSION_KEYS) {
    overrides[key] = action === "enable_all";
  }
  return updateUserPermissionOverrides(userId, companyId, overrides, updatedBy);
};

/**
 * Get role default permissions from office config for a company (for admin UI).
 */
export const getOfficeRolePermissions = async (companyId) => {
  const config = await CompanyConfigs.findOne({ company_id: companyId }).select(
    "role_permissions"
  );
  const defaults = { ...DEFAULT_ROLE_PERMISSIONS };
  const rolePerms = config?.role_permissions || {};
  for (const role of VALID_ROLES) {
    const arr = rolePerms[role];
    if (Array.isArray(arr) && arr.length > 0) {
      defaults[role] = arr;
    }
  }
  return defaults;
};

/**
 * Update role default permissions in office config (per company).
 * rolePermissions: { employee: [keys], admin: [keys], ... }
 */
export const updateOfficeRolePermissions = async (
  companyId,
  rolePermissions,
  updatedBy
) => {
  if (!companyId) throw new AppError("Company ID required", 400);
  const config = await CompanyConfigs.findOne({ company_id: companyId });
  if (!config) throw new AppError("Company configuration not found", 404);
  const valid = {};
  for (const role of VALID_ROLES) {
    const arr = rolePermissions[role];
    if (Array.isArray(arr)) {
      valid[role] = arr.filter((k) => ALL_PERMISSION_KEYS.includes(k));
    }
  }
  config.role_permissions = valid;
  await config.save({ validateModifiedOnly: true });
  return getOfficeRolePermissions(companyId);
};

const definitionsByKey = new Map(
  PERMISSION_DEFINITIONS.map((d) => [d.key, d])
);

/**
 * Get recent permission changes for a user (for "Recent Permission Changes" UI).
 * Returns flat list (each change) and batches (grouped by batch_id) so FE can show one row per "action" and undo the whole action.
 */
export const getRecentPermissionChanges = async (
  userId,
  companyId,
  limit = 50
) => {
  const logs = await PermissionChangeLog.find({
    user_id: userId,
    company_id: companyId,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("changed_by", "first_name last_name role")
    .lean();

  const items = logs.map((log) => {
    const def = definitionsByKey.get(log.permission_key);
    const label = def?.label || log.permission_key;
    const action = log.new_value === true ? "enabled" : "disabled";
    return {
      _id: log._id,
      batch_id: log.batch_id || null,
      permission_key: log.permission_key,
      permission_label: label,
      action,
      message: `${label} permission was ${action}`,
      new_value: log.new_value,
      changed_by: log.changed_by,
      changed_at: log.createdAt,
      can_undo: !log.undone,
    };
  });

  const batchMap = new Map();
  for (const item of items) {
    let bid;
    if (item.batch_id) {
      bid = item.batch_id.toString();
    } else {
      const t = new Date(item.changed_at).getTime();
      const by = item.changed_by?._id?.toString() || "";
      bid = `legacy:${t}:${by}`;
    }
    if (!batchMap.has(bid)) {
      batchMap.set(bid, {
        batch_id: item.batch_id || item._id,
        changed_at: item.changed_at,
        changed_by: item.changed_by,
        changes: [],
        can_undo: item.can_undo,
      });
    }
    const batch = batchMap.get(bid);
    batch.changes.push({
      _id: item._id,
      permission_label: item.permission_label,
      action: item.action,
    });
    if (!item.can_undo) batch.can_undo = false;
  }

  const batches = Array.from(batchMap.values())
    .map((b) => ({
      batch_id: b.batch_id,
      changed_at: b.changed_at,
      changed_by: b.changed_by,
      changes: b.changes,
      can_undo: b.can_undo,
    }))
    .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));

  return {
    items,
    batches,
  };
};

/**
 * Undo a permission change: restore the override to its previous value (or remove override if it was role default).
 */
export const undoPermissionChange = async (
  userId,
  companyId,
  changeId,
  undoneBy
) => {
  const log = await PermissionChangeLog.findOne({
    _id: changeId,
    user_id: userId,
    company_id: companyId,
  });
  if (!log) throw new AppError("Permission change not found", 404);
  if (log.undone) throw new AppError("This change was already undone", 400);

  const user = await Users.findById(userId);
  if (!user) throw new AppError("User not found", 404);
  const userCompanyId = user.company_id?.toString();
  if (userCompanyId !== companyId.toString()) {
    throw new AppError("User does not belong to this company", 403);
  }

  const map = user.permission_overrides instanceof Map
    ? new Map(user.permission_overrides)
    : user.permission_overrides && typeof user.permission_overrides === "object"
      ? new Map(Object.entries(user.permission_overrides))
      : new Map();

  if (log.previous_value === null || log.previous_value === undefined) {
    map.delete(log.permission_key);
  } else {
    map.set(log.permission_key, log.previous_value);
  }
  user.permission_overrides = map;
  await user.save({ validateModifiedOnly: true });

  log.undone = true;
  log.undone_at = new Date();
  log.undone_by = undoneBy;
  await log.save({ validateModifiedOnly: true });

  return getPermissionStateForUser(userId, companyId);
};

/**
 * Undo all permission changes in a batch (one request = one batch_id).
 * Use this when the user clicks "Undo" on a whole action (e.g. "20 permissions were disabled").
 * If no logs have this batch_id (e.g. legacy data), tries to undo a single change by _id so FE can always send batch_id from the batches array.
 */
export const undoPermissionChangeByBatch = async (
  userId,
  companyId,
  batchId,
  undoneBy
) => {
  let logs = await PermissionChangeLog.find({
    user_id: userId,
    company_id: companyId,
    batch_id: batchId,
  });
  if (!logs || logs.length === 0) {
    const single = await PermissionChangeLog.findOne({
      _id: batchId,
      user_id: userId,
      company_id: companyId,
    });
    if (single) {
      if (single.batch_id) {
        return undoPermissionChange(userId, companyId, batchId, undoneBy);
      }
      const ts = new Date(single.createdAt).getTime();
      const sec = Math.floor(ts / 1000) * 1000;
      const start = new Date(sec);
      const end = new Date(sec + 999);
      logs = await PermissionChangeLog.find({
        user_id: userId,
        company_id: companyId,
        batch_id: null,
        createdAt: { $gte: start, $lte: end },
        changed_by: single.changed_by,
      });
      if (!logs.length) {
        return undoPermissionChange(userId, companyId, batchId, undoneBy);
      }
    } else {
      throw new AppError("No permission changes found for this batch", 404);
    }
  }
  const anyUndone = logs.some((l) => l.undone);
  if (anyUndone) {
    throw new AppError("This batch was already undone", 400);
  }

  const user = await Users.findById(userId);
  if (!user) throw new AppError("User not found", 404);
  const userCompanyId = user.company_id?.toString();
  if (userCompanyId !== companyId.toString()) {
    throw new AppError("User does not belong to this company", 403);
  }

  const map = user.permission_overrides instanceof Map
    ? new Map(user.permission_overrides)
    : user.permission_overrides && typeof user.permission_overrides === "object"
      ? new Map(Object.entries(user.permission_overrides))
      : new Map();

  for (const log of logs) {
    if (log.previous_value === null || log.previous_value === undefined) {
      map.delete(log.permission_key);
    } else {
      map.set(log.permission_key, log.previous_value);
    }
    log.undone = true;
    log.undone_at = new Date();
    log.undone_by = undoneBy;
    await log.save({ validateModifiedOnly: true });
  }

  user.permission_overrides = map;
  await user.save({ validateModifiedOnly: true });

  return getPermissionStateForUser(userId, companyId);
};
