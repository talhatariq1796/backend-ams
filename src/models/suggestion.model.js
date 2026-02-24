import mongoose from "mongoose";

const SuggestionSchema = mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true },
    image: { type: String, trim: false },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      trim: true,
      ref: "Users",
      required: false,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      trim: true,
      ref: "Users",
    },
    created_for_user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    category: {
      type: String,
      enum: ["facility", "technology", "culture", "other"],
      required: true,
    },
    celebration_type: {
      type: String,
      enum: ["birthday", "anniversary"],
    },
    is_visible_to_admin_only: { type: Boolean, default: false },
    is_identity_hidden: { type: Boolean, default: false },
    is_public: { type: Boolean, default: false },
    is_responded: { type: Boolean, default: false },

    response: {
      message: { type: String, trim: true },
      responded_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        // first_name: { type: String, trim: true },
        // last_name: { type: String, trim: true },
        // profile_picture: { type: String, trim: true },
      },
      responded_at: { type: Date },
    },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    likes_count: { type: Number, default: 0 },
    comments_count: { type: Number, default: 0 },

    visible_to_departments: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Departments" },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("suggestion", SuggestionSchema);
