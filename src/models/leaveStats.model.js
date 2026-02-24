import mongoose from "mongoose";

const LeaveStatsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    year: {
      type: Number,
      required: true,
      default: new Date().getFullYear(),
    },
    prorated_leave_entitlement: {
      type: Number,
      required: true,
    },
    total_taken_leaves: {
      type: Number,
      default: 0,
    },
    remaining_leaves: {
      type: Number,
      required: true,
    },
    pending_leaves: {
      type: Number,
      default: 0,
    },
    leave_breakdown: {
      annual: {
        allowed: { type: Number, default: 0 },
        taken: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
      },
      sick: {
        allowed: { type: Number, default: 0 },
        taken: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
      },
      casual: {
        allowed: { type: Number, default: 0 },
        taken: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
      },
      demise: {
        allowed: { type: Number, default: 0 },
        taken: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
      },
      "hajj/umrah": {
        allowed: { type: Number, default: 0 },
        taken: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
      },
      marriage: {
        allowed: { type: Number, default: 0 },
        taken: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
      },
      maternity: {
        allowed: { type: Number, default: 0 },
        taken: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
      },
      paternity: {
        allowed: { type: Number, default: 0 },
        taken: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
      },
      probation: {
        allowed: { type: Number, default: 0 },
        taken: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
      },
      unpaid: {
        allowed: { type: Number, default: 0 },
        taken: { type: Number, default: 0 },
        remaining: { type: Number, default: 0 },
      },
    },
    total_restored_leaves: {
      type: Number,
      default: 0,
    },
    last_updated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

LeaveStatsSchema.index({ user: 1, year: 1 }, { unique: true });

export default mongoose.model("LeaveStats", LeaveStatsSchema);
