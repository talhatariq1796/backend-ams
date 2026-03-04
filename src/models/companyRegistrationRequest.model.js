import mongoose from "mongoose";

const CompanyRegistrationRequestSchema = mongoose.Schema(
  {
    // Company Information
    company_name: {
      type: String,
      required: true,
      trim: true,
    },
    company_domain: {
      type: String,
      trim: true,
      lowercase: true,
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
    logo_url: {
      type: String,
      trim: true,
    },

    // Subscription Details
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
    company_size: {
      type: String,
      required: true,
    },

    // Admin User Data (optional but when provided, requires specific fields)
    admin_user_data: {
      createAdmin: Boolean,
      email: String,
      password: String, // Will be hashed before storing
      designation: String,
      employment_status: String,
      joining_date: Date,
      // Optional fields
      first_name: String,
      last_name: String,
      gender: String,
      contact_number: String,
      address: String,
      city: String,
      state: String,
      cnic: String,
    },

    // Request Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // Review Information
    reviewed_by_superadmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    reviewed_at: {
      type: Date,
      default: null,
    },
    rejection_reason: {
      type: String,
      trim: true,
      default: null,
    },

    // Link to created company (after approval)
    created_company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Companies",
      default: null,
    },

    // Link to created admin user (after approval, if admin data provided)
    created_admin_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes for efficient querying
CompanyRegistrationRequestSchema.index({ status: 1 });
CompanyRegistrationRequestSchema.index({ contact_email: 1 });
CompanyRegistrationRequestSchema.index({ industry: 1 });
CompanyRegistrationRequestSchema.index({ country_region: 1 });
CompanyRegistrationRequestSchema.index({ reviewed_by_superadmin: 1 });
CompanyRegistrationRequestSchema.index({ createdAt: -1 });

export default mongoose.model(
  "CompanyRegistrationRequests",
  CompanyRegistrationRequestSchema,
);
