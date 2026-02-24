/**
 * Script to send test notifications to all users
 * Usage: node scripts/sendTestNotifications.js
 * 
 * Note: This script requires the Firebase service account JSON file to be present
 * at: whitebox-ams-firebase-adminsdk-fbsvc-388babdf43.json (project root)
 * 
 * Alternative: If server is running, use the API endpoint:
 * curl -X POST http://localhost:8000/api/notifications/test-all \
 *   -H "Authorization: Bearer YOUR_TOKEN" \
 *   -H "Content-Type: application/json"
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

// Import Firebase service (this will initialize Firebase Admin)
// This uses the same initialization as the main app
try {
  await import("../src/services/firebase_services.js");
  console.log("🔥 Firebase Admin initialized");
} catch (error) {
  console.error("❌ Error initializing Firebase:", error.message);
  console.error("\n💡 Make sure the Firebase service account file exists at:");
  console.error("   whitebox-ams-firebase-adminsdk-fbsvc-388babdf43.json (project root)");
  console.error("\n💡 Or use the API endpoint if your server is running:");
  console.error("   POST http://localhost:8000/api/notifications/test-all");
  console.error("   Header: Authorization: Bearer YOUR_TOKEN\n");
  process.exit(1);
}

const runTestNotifications = async () => {
  try {
    console.log("🚀 Starting test notification script...");
    
    // Connect to database
    console.log("📦 Connecting to database...");
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is not set");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Database connected successfully");

    // Import notification service after Firebase is initialized
    const { SendTestNotificationToAllUsersService } = await import("../src/services/notification.service.js");

    // Wait a moment to ensure everything is ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send test notifications
    console.log("📱 Sending test notifications to all users...");
    const result = await SendTestNotificationToAllUsersService();

    console.log("\n📊 Results:");
    console.log(`✅ Successfully sent: ${result.sentCount}`);
    console.log(`❌ Failed: ${result.failedCount}`);
    console.log(`📊 Total users: ${result.totalUsers}`);
    console.log(`💬 Message: ${result.message}`);

    // Close database connection
    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    console.log("✨ Script completed successfully!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error running test notifications:", error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

runTestNotifications();

