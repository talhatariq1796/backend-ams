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
    role: {
      type: String,
      enum: ["admin", "teamLead", "manager", "employee"],
      required: true,
      default: "employee",
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
      unique: true,
      match: [/^WB-[1-9]\d{0,2}$/, "Invalid employee ID format"],
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
  },
  { timestamps: true },
);

export default mongoose.model("Users", UsersSchema);
