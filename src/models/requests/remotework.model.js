import mongoose from "mongoose";

const RemoteWorkSchema = new mongoose.Schema(
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
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    total_days: { type: Number, required: true },
    reason: { type: String, required: true, match: /^.{10,250}$/s },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    action_taken_by: {
      type: String,
      trim: true,
      // required: true,
    },
    rejection_reason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

// company_id already has index: true
RemoteWorkSchema.index({ company_id: 1, status: 1 });
RemoteWorkSchema.index({ company_id: 1, user_id: 1 });

export default mongoose.model("RemoteWorkRequests", RemoteWorkSchema);
