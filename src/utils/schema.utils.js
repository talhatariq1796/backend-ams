import mongoose from "mongoose";

export const DaySchema = new mongoose.Schema({
  day: { type: String, required: true },
  checkin_time: { type: Date, required: true },
  checkout_time: { type: Date, required: true },
});
