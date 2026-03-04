import mongoose from "mongoose";

const UsersSchema = mongoose.Schema(
  {
    fcmToken: { type: String },
    first_name: {
      type: String,
      required: true,
      trim: true,
      minLength: [2, "First name must be atleast 2 characters."],
      maxLength: [50, "First name must not exceed 50 characters."],
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
      minLength: [2, "Last name must be atleast 2 characters."],
      maxLength: [50, "Last name must not exceed 50 characters."],
    },
    profile_picture: {
      type: String,
      trim: true,
      match: /^(https?:\/\/)?([\w\d-]+\.)+[\w-]+(\/.*)?$/,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      // match: /^[a-zA-Z0-9._%+-]+@whiteboxtech\.net$/,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      required: true,
    },
    contact_number: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{11}$/,
    },
    reference_contact_number: {
      type: String,
      trim: true,
      match: /^\d{11}$/,
    },
    date_of_birth: { type: Date, trim: true },
    address: {
      type: String,
      required: true,
      trim: true,
      minLength: [5, "Address must be atleast 5 characters."],
      maxLength: [100, "Address must not exceed 100 characters."],
    },
    city: {
      type: String,
      required: true,
      trim: true,
      minLength: [2, "City must be atleast 2 characters."],
      maxLength: [100, "City must not exceed 100 characters."],
    },
    state: {
      type: String,
      required: true,
      trim: true,
      minLength: [2, "State must be atleast 2 characters."],
      maxLength: [100, "State must not exceed 100 characters."],
    },
    cnic: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{5}-\d{7}-\d{1}$/,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
      maxLength: [40, "Designation must not exceed 40 characters."],
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      trim: true,
      required: true,
      ref: "Teams",
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      trim: true,
      ref: "Users",
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      trim: true,
      ref: "Users",
    },
    // attendance_status: {
    //   type: String,
    //   enum: ["present", "awaiting", "leave", "wfh", "late"],
    //   default: "awaiting",
    // },
    // Company/Tenant reference
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Companies",
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: ["super_admin", "admin", "teamLead", "employee", "manager"],
      required: true,
      default: "employee",
    },

    // Super admin flag (platform-level admin, not company admin)
    is_super_admin: {
      type: Boolean,
      default: false,
    },
    employment_status: {
      type: String,
      enum: ["permanent", "probation", "internship"],
      required: true,
      trim: true,
    },
    joining_date: {
      type: Date,
      required: true,
      trim: true,
    },
    is_active: { type: Boolean, default: true },
    employee_id: {
      type: String,
      required: true,
      match: [/^WB-[1-9]\d{0,2}$/, "Invalid employee ID format"],
      // Note: Will add compound unique index with company_id after schema definition
    },
    password: { type: String, required: true },
    is_default_working_hours: { type: Boolean, default: true },
    reset_password_token: {
      type: String,
      default: null,
    },
    reset_password_token_id: {
      type: String,
      default: null,
    },
    reset_password_expires: {
      type: Date,
      default: null,
    },
    // Per-user permission overrides (admin can enable/disable specific permissions for a user).
    // Effective permissions = role defaults from office config + these overrides (override wins).
    // Stored as object: { permission_key: true|false }. Only keys that are explicitly overridden are present.
    permission_overrides: {
      type: Map,
      of: Boolean,
      default: () => new Map(),
    },
  },
  { timestamps: true },
);

// Compound unique indexes for company-scoped uniqueness
UsersSchema.index({ company_id: 1, employee_id: 1 }, { unique: true });
UsersSchema.index({ company_id: 1, email: 1 }, { unique: true });

export default mongoose.model("Users", UsersSchema);
