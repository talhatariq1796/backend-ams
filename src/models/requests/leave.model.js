import mongoose from "mongoose";

const LeaveSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    leave_type: {
      type: String,
      enum: [
        "annual",
        "casual",
        "sick",
        "demise",
        "hajj/umrah",
        "marriage",
        "maternity",
        "paternity",
        "probation",
        "unpaid",
      ],
      required: true,
      default: "annual",
    },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    total_days: { type: Number, required: true },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teams",
    },
    substitute: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
      name: String,
    },
    reason: {
      type: String,
      required: true,
      minLength: [10, "Reason must be atleast 10 characters."],
      maxLength: [250, "Reason must not exceed 250 characters."],
    },
    is_half_day: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    attendance_overrides: [
      {
        date: {
          type: Date,
          required: true,
        },
        restored_days: {
          type: Number,
          required: true,
        },
        created_at: {
          type: Date,
          default: Date.now,
        },
        created_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    rejection_reason: { type: String },
    notice_violation_note: { type: String },
    action_taken_by: {
      type: String,
      default: "No action has been taken yet.",
    },
    applied_by_admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Leaves", LeaveSchema);
