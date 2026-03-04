import mongoose from "mongoose";
import { DaySchema } from "../utils/schema.utils.js";

const WorkingHoursSchema = mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Companies",
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    is_week_custom_working_hours: { type: Boolean, default: false },
    custom_working_hours: [DaySchema],
    checkin_time: { type: Date },
    checkout_time: { type: Date },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    expiry_date: { type: Date, default: null },
  },
  { timestamps: true }
);

WorkingHoursSchema.index({ company_id: 1, user_id: 1 }, { unique: true });
// company_id already has index: true

export default mongoose.model("WorkingHours", WorkingHoursSchema);
