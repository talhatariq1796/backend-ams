/**
 * Quick script to update all comments and likes with a specific company_id
 */

import mongoose from "mongoose";
import Comment from "../models/comments.model.js";
import Like from "../models/likes.model.js";
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

const updateCommentsAndLikes = async () => {
  try {
    console.log("\n🚀 Starting update of Comments and Likes...\n");

    // Update Comments
    console.log("📊 Updating Comments...");
    const commentsUpdate = await Comment.updateMany(
      {
        $or: [{ company_id: { $exists: false } }, { company_id: null }],
      },
      { $set: { company_id: new mongoose.Types.ObjectId(COMPANY_ID) } }
    );
    console.log(`   ✅ Updated ${commentsUpdate.modifiedCount} comments`);

    // Update Likes
    console.log("📊 Updating Likes...");
    const likesUpdate = await Like.updateMany(
      {
        $or: [{ company_id: { $exists: false } }, { company_id: null }],
      },
      { $set: { company_id: new mongoose.Types.ObjectId(COMPANY_ID) } }
    );
    console.log(`   ✅ Updated ${likesUpdate.modifiedCount} likes`);

    console.log("\n✅ Update complete!\n");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating:", error);
    process.exit(1);
  }
};

// Run the script
connectDB().then(() => {
  updateCommentsAndLikes();
});

