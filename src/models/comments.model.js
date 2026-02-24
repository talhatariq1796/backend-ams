import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema(
  {
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
  },
  { timestamps: true }
);
export default mongoose.model("Comment", CommentSchema);
