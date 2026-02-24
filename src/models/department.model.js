import mongoose from "mongoose";

const DepartmentsSchema = mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: "Teams" }],
  },
  { timestamps: true }
);

export default mongoose.model("Departments", DepartmentsSchema);
