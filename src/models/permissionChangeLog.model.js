import mongoose from "mongoose";

/**
 * Logs each permission override change so we can show "Recent Permission Changes"
 * and support "Undo Changes". Stores the override value before/after; undo restores previous.
 */
const PermissionChangeLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Companies",
      required: true,
      index: true,
    },
    permission_key: {
      type: String,
      required: true,
      index: true,
    },
    /** Override value before this change. null = no override (was using role default). */
    previous_value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    /** Override value after this change (what the admin set). */
    new_value: {
      type: Boolean,
      required: true,
    },
    changed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    /** All changes made in the same request share this id; undo by batchId undoes all. */
    batch_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    undone: {
      type: Boolean,
      default: false,
    },
    undone_at: { type: Date },
    undone_by: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  },
  { timestamps: true }
);

PermissionChangeLogSchema.index(
  { user_id: 1, company_id: 1, createdAt: -1 }
);

export default mongoose.model(
  "PermissionChangeLog",
  PermissionChangeLogSchema
);
