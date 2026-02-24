import mongoose from "mongoose";

const AdminTodoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    is_completed: { type: Boolean, default: false },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      trim: true,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      trim: true,
    },
    category: {
      type: String,
      enum: ["urgent", "normal", "low"],
    },
  },
  { timestamps: true }
);

export default mongoose.model("AdminTodo", AdminTodoSchema);
