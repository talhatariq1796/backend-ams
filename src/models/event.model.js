import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    title: { type: String, required: true },
    date: { type: Date, required: true },
    start_time: { type: Date },
    end_time: { type: Date },
    is_all_day: { type: Boolean, default: false },
    description: { type: String },
    is_public: { type: Boolean, default: true },
    category: {
      type: String,
      enum: [
        "birthday",
        "anniversary",
        "office-event",
        "trip",
        "cricket",
        "public-holiday",
        "others",
      ],
      required: true,
    },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  },
  { timestamps: true }
);

export default mongoose.model("Event", EventSchema);
