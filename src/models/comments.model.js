import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    suggestion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Suggestion",
      required: true,
    },
    text: { type: String, required: true },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    role: { type: String },
  },
  { timestamps: true }
);

CommentSchema.index({ company_id: 1, suggestion: 1 });
CommentSchema.index({ suggestion: 1 });

export default mongoose.model("Comment", CommentSchema);
