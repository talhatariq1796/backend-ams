import mongoose from "mongoose";

const MeetingRoomSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    start_date: { type: Date },
    end_date: { type: Date },
    duration: { type: Number, required: true },
    time_slot: { type: String },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    title: { type: String, required: true },
    location: {
      type: String,
      enum: ["meeting-room", "online"],
      default: "meeting-room",
    },
    description: {
      type: String,
      maxLength: [250, "Description must not exceed 250 characters."],
    },
    recurrence_type: {
      type: String,
      enum: ["none", "weekly", "monthly", "custom"],
      required: true,
    },
    recurrence_details: {
      days: [{ type: String }],
      date: { type: Number },
      end_month: { type: Number },
    },
  },
  { timestamps: true }
);

export default mongoose.model("MeetingRoom", MeetingRoomSchema);
