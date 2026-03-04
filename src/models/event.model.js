import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Companies",
      required: true,
      index: true,
    },
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

// Indexes
// company_id already has index: true
EventSchema.index({ company_id: 1, category: 1 });

export default mongoose.model("Event", EventSchema);
