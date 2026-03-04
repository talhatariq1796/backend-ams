import mongoose from "mongoose";

const LeaveStatsSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Companies",
      required: true,
      index: true,
    },
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

// Compound unique: user can only have one leave stats per year within a company
LeaveStatsSchema.index({ company_id: 1, user: 1, year: 1 }, { unique: true });
// company_id already has index: true in field definition

export default mongoose.model("LeaveStats", LeaveStatsSchema);
