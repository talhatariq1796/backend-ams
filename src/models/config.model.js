import { add } from "date-fns";
import mongoose from "mongoose";

const CompanyConfigSchema = new mongoose.Schema({
  // Reference to company (tenant isolation)
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Companies",
    required: true,
    unique: true,
    index: true,
  },

  // Office Information (Existing)
  office_info: {
    name: { type: String, trim: true },
    business_field: { type: String, trim: true },
    company_logo: { type: String, trim: true },
    address: { type: String, trim: true },
    email: { type: String, trim: true },
    contact: { type: String, trim: true },
    logo: { type: String, trim: true },
    linkedin: { type: String, trim: true },
    instagram: { type: String, trim: true },
    facebook: { type: String, trim: true },
    youtube: { type: String, trim: true },
    tiktok: { type: String, trim: true },
    website: { type: String, trim: true },
  },

  // Allowed IPs (Existing)
  allowed_ips: {
    type: Map,
    of: String,
  },

  // Office Location (Existing)
  office_location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },

  // Working Hours (Existing)
  working_hours: {
    checkin_time: { type: Date, required: true },
    checkout_time: { type: Date, required: true },
  },

  bd_working_hours: {
    checkin_time: { type: Date, required: true },
    checkout_time: { type: Date, required: true },
  },

  // Leave Types (Existing)
  general_leave_types: {
    annual: { type: Number, default: 10 },
    casual: { type: Number, default: 7 },
    demise: { type: Number, default: 5 },
    "hajj/umrah": { type: Number, default: 5 },
    marriage: { type: Number, default: 5 },
    maternity: { type: Number, default: 90 },
    paternity: { type: Number, default: 5 },
    probation: { type: Number, default: 3 },
    sick: { type: Number, default: 7 },
    unpaid: { type: Number, default: 10 },
  },

  business_leave_types: {
    annual: { type: Number, default: 10 },
    casual: { type: Number, default: 7 },
    demise: { type: Number, default: 5 },
    "hajj/umrah": { type: Number, default: 5 },
    marriage: { type: Number, default: 5 },
    maternity: { type: Number, default: 90 },
    paternity: { type: Number, default: 5 },
    probation: { type: Number, default: 3 },
    sick: { type: Number, default: 7 },
    unpaid: { type: Number, default: 10 },
  },

  allowedLeaveForPermanentEmployees: {
    type: Number,
    required: true,
    default: 24,
  },

  allowedLeaveForPermanentBusinessDevelopers: {
    type: Number,
    required: true,
    default: 24,
  },

  allowedLeaveForProbationInternshipEmployees: {
    type: Number,
    required: true,
    default: 3,
  },

  isSignup: {
    type: Boolean,
    default: false,
  },

  // ============= NEW: BUSINESS RULES CONFIGURATION =============

  // Attendance Rules
  attendance_rules: {
    buffer_time_minutes: {
      type: Number,
      default: 30,
      min: [0, "Buffer time cannot be negative"],
      max: [120, "Buffer time cannot exceed 2 hours"],
    },
    enable_weekend_checkin: { type: Boolean, default: false },
    enable_ip_check: { type: Boolean, default: true },
    max_early_leaves_per_month: { type: Number, default: 5 },
    late_checkin_threshold_minutes: { type: Number, default: 30 },
    enable_early_leave_deduction: { type: Boolean, default: true },
  },

  // Auto-Checkout Rules (for missing checkout)
  auto_checkout_rules: {
    enabled: { type: Boolean, default: true },
    auto_checkout_hours_after_checkin: {
      type: Number,
      default: 5,
      min: [0, "Hours must be positive"],
      max: [12, "Cannot exceed 12 hours"],
    },
    status_on_auto_checkout: {
      type: String,
      enum: ["auto-half-day", "leave", "present"],
      default: "auto-half-day",
    },
    trigger_missing_checkout_deduction: { type: Boolean, default: true },
  },

  // Leave Auto-Application Rules
  leave_deduction_rules: {
    on_missing_attendance: {
      enabled: { type: Boolean, default: true },
      leave_type: {
        type: String,
        enum: ["unpaid", "annual", "casual", "sick"],
        default: "unpaid",
      },
      is_half_day: { type: Boolean, default: false },
    },
    on_missing_checkout: {
      enabled: { type: Boolean, default: true },
      leave_type: {
        type: String,
        enum: ["unpaid", "annual", "casual", "sick"],
        default: "unpaid",
      },
      is_half_day: { type: Boolean, default: true },
    },
    on_missing_checkout_hours_assumed: { type: Number, default: 5 },
  },

  // Half-Day Detection Rules
  half_day_rules: {
    minimum_hours_for_full_day: { type: Number, default: 7 },
    maximum_hours_for_half_day: { type: Number, default: 5 },
  },

  // Working Hours Validation Rules
  working_hours_rules: {
    enable_location_check: { type: Boolean, default: true },
    allowed_cities: [{ type: String }], // e.g., ["lahore", "faisalabad"]
    block_vpn_proxy: { type: Boolean, default: true },
    allow_remote_without_ip_check: { type: Boolean, default: false },
    timezone: { type: String, default: "Asia/Karachi" },
  },

  // Cron Job Configuration
  cron_job_rules: {
    auto_attendance_regularization: {
      enabled: { type: Boolean, default: true },
      run_time: { type: String, default: "06:00" }, // Time in company timezone
      run_days: [{ type: Number }], // [1,2,3,4,5] = Mon-Fri
      apply_to_active_users_only: { type: Boolean, default: true },
    },
    auto_trip_event_handling: { type: Boolean, default: true },
    auto_office_event_handling: { type: Boolean, default: true },
    auto_holiday_marking: { type: Boolean, default: true },
  },

  // Team-Specific Rules
  team_specific_rules: {
    bd_team: {
      custom_working_hours: { type: Boolean, default: true },
      bd_checkin_time: { type: Date },
      bd_checkout_time: { type: Date },
    },
  },

  // Notification Rules
  notification_rules: {
    notify_on_late_checkin: { type: Boolean, default: true },
    notify_on_early_leave: { type: Boolean, default: true },
    notify_on_missing_checkout: { type: Boolean, default: true },
    notify_admins_on_attendance_override: { type: Boolean, default: true },
    notify_on_auto_checkout: { type: Boolean, default: true },
    notify_on_leave_override: { type: Boolean, default: true },
  },

  // Working Days Configuration
  working_days: {
    type: [Number],
    default: [1, 2, 3, 4, 5], // Monday to Friday
  },

  // ============= ROLE & PERMISSIONS (per company/office) =============
  // Each company has its own default permissions per role. Keys: employee, admin, teamLead, super_admin.
  // Value: array of permission keys (see constants/permissions.js). If missing, app defaults are used.
  role_permissions: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },

  // Backward compatibility fields (deprecated but kept for migration)
  buffer_time_minutes: { type: Number, default: 30 },
  enable_ip_check: {
    type: Boolean,
    default: true,
  },
});

// Indexes for faster queries (company_id already has index: true, unique: true)

export default mongoose.model("CompanyConfigs", CompanyConfigSchema);

// Keep the old model export for backward compatibility during migration
export const OfficeConfigs = mongoose.model(
  "OfficeConfigs",
  CompanyConfigSchema
);
