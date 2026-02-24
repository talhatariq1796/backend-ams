import mongoose from "mongoose";

const AttendanceSchema = mongoose.Schema(
  {
    check_in: { type: Date },
    check_out: { type: Date },
    date: { type: Date },
    is_late: { type: Boolean },
    is_half_day: { type: Boolean },
    analysis: { type: String },
    status: {
      type: String,
      enum: [
        "present",
        "leave",
        "auto-leave",
        "checked-out",
        "late",
        "remote",
        "awaiting",
        "half-day",
        "auto-half-day",
        "holiday",
        "trip",
        "early-leave",
      ],
      trim: true,
    },
    production_time: { type: String },
    action_taken_by: { type: String },
    leave_override: {
      original_leave_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Leave",
      },
      restored_days: {
        type: Number,
      },
      leave_type: {
        type: String,
        enum: [
          "annual",
          "sick",
          "casual",
          "demise",
          "hajj/umrah",
          "marriage",
          "maternity",
          "paternity",
          "probation",
          "unpaid",
        ],
      },
    },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  },
  { timestamps: true }
);

AttendanceSchema.index({ user_id: 1, date: 1 }, { unique: true });
export default mongoose.model("Attendances", AttendanceSchema);
