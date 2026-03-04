import mongoose from "mongoose";

const LikeSchema = new mongoose.Schema(
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
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
  },
  { timestamps: true }
);

LikeSchema.index({ company_id: 1, suggestion: 1 });
LikeSchema.index({ suggestion: 1 });
LikeSchema.index({ company_id: 1, user: 1, suggestion: 1 }, { unique: true });

export default mongoose.model("Like", LikeSchema);
