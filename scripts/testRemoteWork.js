import mongoose from "mongoose";
import dotenv from "dotenv";
import RemoteWorkRequests from "../src/models/requests/remotework.model.js";
import Attendance from "../src/models/attendance.model.js";
import { DBConnect } from "../src/utils/dbConnect.util.js";

dotenv.config();

// ✅ Use your existing DBConnect utility
await DBConnect();

const UpdateRemoteAttendances = async () => {
  try {
    console.log("🚀 Fetching approved remote work requests...");
    const approvedRequests = await RemoteWorkRequests.find({
      status: "approved",
    });

    if (!approvedRequests.length) {
      console.log("⚠️ No approved remote work requests found.");
      process.exit(0);
    }

    let totalUpdated = 0;
    const result = [];

    for (const request of approvedRequests) {
      const { user_id, start_date, end_date } = request;

      // ✅ Only process records overlapping October 2025
      const octoberStart = new Date("2025-10-01T00:00:00.000Z");
      const octoberEnd = new Date("2025-10-31T23:59:59.000Z");

      if (end_date < octoberStart || start_date > octoberEnd) {
        continue; // skip if not in October range
      }

      // ✅ Update attendances with status "present" → "remote"
      const updateResult = await Attendance.updateMany(
        {
          user_id,
          status: "present",
          date: { $gte: start_date, $lte: end_date },
        },
        { $set: { status: "remote" } }
      );

      if (updateResult.modifiedCount > 0) {
        totalUpdated += updateResult.modifiedCount;

        const updatedAttendances = await Attendance.find({
          user_id,
          date: { $gte: start_date, $lte: end_date },
        }).select("_id user_id date status");

        result.push({
          user_id,
          remote_work_period: { start_date, end_date },
          updated_count: updateResult.modifiedCount,
          attendances: updatedAttendances.map((a) => ({
            _id: a._id,
            date: a.date,
            status: a.status,
          })),
        });

        console.log(
          `✅ Updated ${
            updateResult.modifiedCount
          } attendance(s) for user ${user_id} (${
            start_date.toISOString().split("T")[0]
          } → ${end_date.toISOString().split("T")[0]})`
        );
      }
    }

    console.log(`\n🎯 Total records updated: ${totalUpdated}`);
    console.log("🧾 Final Result:\n", JSON.stringify(result, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
};

// ✅ Run the function
UpdateRemoteAttendances();
