import mongoose from "mongoose";

const LikeSchema = new mongoose.Schema(
  {
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
export default mongoose.model("Like", LikeSchema);
