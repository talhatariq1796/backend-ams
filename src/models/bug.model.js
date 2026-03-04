import mongoose from "mongoose";

const bugSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
    index: true,
  },
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

bugSchema.index({ company_id: 1, created_at: -1 });
bugSchema.index({ company_id: 1, reported_by: 1 });

export default mongoose.model("BugReport", bugSchema);
