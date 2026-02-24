import mongoose from "mongoose";

const RemoteWorkSchema = new mongoose.Schema(
  {
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

export default mongoose.model("RemoteWorkRequests", RemoteWorkSchema);
