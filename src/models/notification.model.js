import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Companies",
    required: true,
    index: true,
  },
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

// Indexes
// company_id already has index: true
notificationSchema.index({ company_id: 1, notification_to: 1 });
notificationSchema.index({ company_id: 1, read: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
