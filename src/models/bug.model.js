import mongoose from "mongoose";

const bugSchema = new mongoose.Schema({
  title: { type: String, required: true },
  details: { type: String },
  screenshots: [{ type: String }],
  reported_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  status: {
    type: String,
    enum: ["in_progress", "resolved"],
    default: "in_progress",
  },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model("BugReport", bugSchema);
