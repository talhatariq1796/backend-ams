import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  notification_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    default: null,
  },
  notification_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    default: null,
  },
  type: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  role: {
    type: String,
  },
});

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
