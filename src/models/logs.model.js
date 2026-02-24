import mongoose from "mongoose";

const logSchema = new mongoose.Schema({
  action_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    // required: true,
  },
  action_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Logs = mongoose.model("Logs", logSchema);
export default Logs;
