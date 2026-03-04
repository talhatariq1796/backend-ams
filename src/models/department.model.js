import mongoose from "mongoose";

const DepartmentsSchema = mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Companies",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: "Teams" }],
  },
  { timestamps: true }
);

// Compound unique: department name must be unique within a company
DepartmentsSchema.index({ company_id: 1, name: 1 }, { unique: true });
// company_id already has index: true

export default mongoose.model("Departments", DepartmentsSchema);
