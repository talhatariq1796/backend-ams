import mongoose from "mongoose";

const TicketSchema = new mongoose.Schema(
  {
    ticket_id: { type: String, unique: true }, // TK-001
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["pending", "in-progress", "resolved"],
      default: "pending",
    },
    category: {
      type: String,
      enum: ["attendance", "general", "payroll", "policy", "access"],
    },
    due_date: Date,
    attachments: {
      type: [String],
      default: [],
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    assigned_to: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    assigned_to_department: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Departments" },
    ],

    created_by_department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Departments",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Ticket", TicketSchema);
