/**
 * Quick script to update all bug reports with a specific company_id
 */

import mongoose from "mongoose";
import BugReport from "../models/bug.model.js";
import User from "../models/user.model.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const COMPANY_ID = "6900ce8c47160e3598a51254";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error connecting to database: ${error.message}`);
    process.exit(1);
  }
};

const updateBugs = async () => {
  try {
    console.log("\n🚀 Starting update of Bug Reports...\n");

    // Update bugs without company_id, getting company_id from user
    const bugsWithoutCompanyId = await BugReport.find({
      $or: [{ company_id: { $exists: false } }, { company_id: null }],
    }).lean();

    let bugsBackfilled = 0;
    for (const bug of bugsWithoutCompanyId) {
      let bugCompanyId = COMPANY_ID; // Default

      // Try to get from user who reported it
      if (bug.reported_by) {
        const user = await User.findById(bug.reported_by)
          .select("company_id")
          .lean();
        if (user?.company_id) {
          bugCompanyId = user.company_id;
        }
      }

      await BugReport.updateOne(
        { _id: bug._id },
        { $set: { company_id: new mongoose.Types.ObjectId(bugCompanyId) } }
      );
      bugsBackfilled++;
    }

    console.log(`   ✅ Updated ${bugsBackfilled} bug reports`);

    console.log("\n✅ Update complete!\n");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating:", error);
    process.exit(1);
  }
};

// Run the script
connectDB().then(() => {
  updateBugs();
});

