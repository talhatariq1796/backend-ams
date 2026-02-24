import mongoose from "mongoose";

const TeamSchema = new mongoose.Schema(
  {
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

export default mongoose.model("Teams", TeamSchema);
