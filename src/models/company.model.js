import mongoose from "mongoose";

const CompanySchema = mongoose.Schema(
  {
    company_name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minLength: [2, "Company name must be at least 2 characters"],
      maxLength: [100, "Company name must not exceed 100 characters"],
    },
    company_domain: {
      type: String,
      trim: true,
      lowercase: true,
      // Email suffix for domain-based registration (e.g., @whiteboxtech.net)
    },
    contact_person_name: {
      type: String,
      required: true,
      trim: true,
    },
    contact_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    contact_phone: {
      type: String,
      required: true,
      trim: true,
    },
    industry: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "software",
        "medical",
        "education",
        "retail",
        "manufacturing",
        "finance",
        "healthcare",
        "real estate",
        "other",
      ],
    },
    country_region: {
      type: String,
      required: true,
      trim: true,
    },
    subscription_tier: {
      type: String,
      enum: ["starter", "pro", "enterprise"],
      default: "starter",
      required: true,
    },
    subscription_billing: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },
    auto_renewal: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "suspended", "inactive"],
      default: "pending",
    },
    subscription_start_date: {
      type: Date,
    },
    subscription_end_date: {
      type: Date,
    },
    company_size: {
      type: String,
      default: "50",
    },
    current_employees_count: {
      type: Number,
      default: 0,
    },
    logo_url: {
      type: String,
      trim: true,
    },
    admin_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    created_by_superadmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    approved_by_superadmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    approved_at: {
      type: Date,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

// Indexes
CompanySchema.index({ status: 1 });
CompanySchema.index({ subscription_tier: 1 });
CompanySchema.index({ is_active: 1 });
CompanySchema.index({ contact_email: 1 });
CompanySchema.index({ industry: 1 });
CompanySchema.index({ country_region: 1 });

export default mongoose.model("Companies", CompanySchema);
