import mongoose from "mongoose";
import { DaySchema } from "../../utils/schema.utils.js";

const WorkingHoursSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: false },
    total_days: { type: Number, required: false },
    expiry_date: { type: Date, default: null },
    is_week_custom_working_hours: {
      type: Boolean,
      required: true,
    },
    checkin_time: { type: Date },
    checkout_time: { type: Date },
    custom_working_hours: [DaySchema],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    action_taken_by: {
      type: String,
      default: "No action has been taken yet.",
    },
    rejection_reason: {
      type: String,
      default: null,
      trim: true,
    },
    until_i_change: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("WorkingHoursRequests", WorkingHoursSchema);
