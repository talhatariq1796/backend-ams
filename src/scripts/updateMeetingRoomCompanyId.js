/**
 * Quick script to update all meeting room bookings with a specific company_id
 */

import mongoose from "mongoose";
import BookMeetingRoom from "../models/requests/bookmeetingroom.model.js";
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

const updateBookings = async () => {
  try {
    console.log("\n🚀 Starting update of Meeting Room Bookings...\n");

    // Update bookings without company_id, getting company_id from user
    const bookingsWithoutCompanyId = await BookMeetingRoom.find({
      $or: [{ company_id: { $exists: false } }, { company_id: null }],
    }).lean();

    let bookingsBackfilled = 0;
    for (const booking of bookingsWithoutCompanyId) {
      let bookingCompanyId = COMPANY_ID; // Default

      // Try to get from user
      if (booking.user) {
        const user = await User.findById(booking.user)
          .select("company_id")
          .lean();
        if (user?.company_id) {
          bookingCompanyId = user.company_id;
        }
      }

      await BookMeetingRoom.updateOne(
        { _id: booking._id },
        { $set: { company_id: new mongoose.Types.ObjectId(bookingCompanyId) } }
      );
      bookingsBackfilled++;
    }

    console.log(`   ✅ Updated ${bookingsBackfilled} bookings`);

    console.log("\n✅ Update complete!\n");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating:", error);
    process.exit(1);
  }
};

// Run the script
connectDB().then(() => {
  updateBookings();
});

