/**
 * Script to create CompanyConfigs for WhiteBox company
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Company from "../models/company.model.js";
import CompanyConfigs from "../models/config.model.js";

// Load environment variables
dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error connecting to database: ${error.message}`);
    process.exit(1);
  }
};

const createCompanyConfig = async () => {
  try {
    console.log("\n🚀 Starting CompanyConfig Creation...\n");

    // Find WhiteBox company
    const company = await Company.findOne({
      company_name: { $regex: /^WhiteBox$/i },
    });

    if (!company) {
      console.log(
        "❌ WhiteBox company not found. Please run migration script first."
      );
      process.exit(1);
    }

    console.log(`✅ Found company: ${company.company_name} (${company._id})\n`);

    // Check if config already exists
    let config = await CompanyConfigs.findOne({ company_id: company._id });

    if (config) {
      console.log("✅ CompanyConfig already exists!");
      console.log("   Config ID:", config._id);
    } else {
      console.log("📝 Creating CompanyConfig...");

      // Get current date for working hours
      const now = new Date();
      const checkinTime = new Date(now);
      checkinTime.setHours(9, 0, 0, 0);

      const checkoutTime = new Date(now);
      checkoutTime.setHours(18, 0, 0, 0);

      const bdCheckinTime = new Date(now);
      bdCheckinTime.setHours(9, 0, 0, 0);

      const bdCheckoutTime = new Date(now);
      bdCheckoutTime.setHours(18, 0, 0, 0);

      config = await CompanyConfigs.create({
        company_id: company._id,
        office_info: {
          name: "WhiteBox",
          business_field: "Software Development",
          email: "info@whiteboxtech.net",
          contact: "03004949543",
        },
        office_location: {
          latitude: 31.5204, // Default to Lahore
          longitude: 74.3587,
        },
        working_hours: {
          checkin_time: checkinTime,
          checkout_time: checkoutTime,
        },
        bd_working_hours: {
          checkin_time: bdCheckinTime,
          checkout_time: bdCheckoutTime,
        },
        general_leave_types: {
          annual: 10,
          casual: 7,
          demise: 5,
          "hajj/umrah": 5,
          marriage: 5,
          maternity: 90,
          paternity: 5,
          probation: 3,
          sick: 7,
          unpaid: 10,
        },
        business_leave_types: {
          annual: 10,
          casual: 7,
          demise: 5,
          "hajj/umrah": 5,
          marriage: 5,
          maternity: 90,
          paternity: 5,
          probation: 3,
          sick: 7,
          unpaid: 10,
        },
        allowedLeaveForPermanentEmployees: 24,
        allowedLeaveForPermanentBusinessDevelopers: 24,
        allowedLeaveForProbationInternshipEmployees: 3,
        working_days: [1, 2, 3, 4, 5], // Monday to Friday
      });

      console.log(`✅ CompanyConfig created successfully!`);
      console.log("   Config ID:", config._id);
      console.log("   Company ID:", company._id);
    }

    console.log("\n✅ COMPLETED!\n");
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
};

// Run the script
const runScript = async () => {
  await connectDB();
  await createCompanyConfig();
  console.log("✅ Script completed successfully!");
  process.exit(0);
};

// Execute
runScript().catch((error) => {
  console.error("❌ Script error:", error);
  process.exit(1);
});
