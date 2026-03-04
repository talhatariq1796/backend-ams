import mongoose from "mongoose";

const TicketSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Companies",
      required: true,
      index: true,
    },
    ticket_id: { type: String }, // TK-001 - will be unique per company
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

// Compound unique: ticket_id must be unique within a company
TicketSchema.index({ company_id: 1, ticket_id: 1 }, { unique: true });
// company_id already has index: true
TicketSchema.index({ company_id: 1, status: 1 });

export default mongoose.model("Ticket", TicketSchema);
