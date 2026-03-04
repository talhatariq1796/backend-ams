import mongoose from "mongoose";

const AdminTodoSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Companies",
      required: true,
      index: true,
    },
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

// company_id already has index: true
AdminTodoSchema.index({ company_id: 1, is_completed: 1 });

export default mongoose.model("AdminTodo", AdminTodoSchema);
