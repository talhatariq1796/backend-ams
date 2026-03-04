import mongoose from "mongoose";

const TeamSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Companies",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Departments",
      required: true,
    },
    leads: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    managers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  },
  { timestamps: true },
);

// Compound unique: team name must be unique within a company
TeamSchema.index({ company_id: 1, name: 1 }, { unique: true });
// company_id already has index: true
TeamSchema.index({ company_id: 1, department: 1 });

export default mongoose.model("Teams", TeamSchema);
