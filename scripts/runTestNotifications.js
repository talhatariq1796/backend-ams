/**
 * Quick script to run test notifications
 * This assumes the server is running and Firebase is initialized there
 * OR that the Firebase service account file exists in the project root
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

// Try to import Firebase service - if server is running, this might work
// If not, it will fail and we'll provide instructions
console.log("🚀 Starting test notification script...\n");

const run = async () => {
  try {
    // Connect to database first
    console.log("📦 Connecting to database...");
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI not found in environment variables");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Database connected\n");

    // Initialize Firebase
    console.log("🔥 Initializing Firebase...");
    const admin = (await import("firebase-admin")).default;
    const { readFileSync, existsSync } = await import("fs");
    const { fileURLToPath } = await import("url");
    const { dirname, resolve } = await import("path");
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    // Try multiple possible locations for Firebase service account
    const possiblePaths = [
      resolve(__dirname, "../whitebox-ams-firebase-adminsdk-fbsvc-388babdf43.json"),
      resolve(process.cwd(), "whitebox-ams-firebase-adminsdk-fbsvc-388babdf43.json"),
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    ].filter(Boolean);
    
    let firebaseInitialized = false;
    
    // Only initialize if not already initialized
    if (admin.apps.length === 0) {
      for (const serviceAccountPath of possiblePaths) {
        if (existsSync(serviceAccountPath)) {
          try {
            const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
            });
            console.log(`✅ Firebase initialized from: ${serviceAccountPath}\n`);
            firebaseInitialized = true;
            break;
          } catch (err) {
            console.error(`❌ Error with path ${serviceAccountPath}:`, err.message);
          }
        }
      }
      
      if (!firebaseInitialized) {
        console.error("❌ Firebase service account file not found in any of these locations:");
        possiblePaths.forEach(p => console.error(`   - ${p}`));
        throw new Error("Firebase initialization failed - service account file not found");
      }
    } else {
      console.log("✅ Firebase already initialized\n");
      firebaseInitialized = true;
    }

    // Import and run the service
    console.log("📱 Loading notification service...");
    const { SendTestNotificationToAllUsersService } = await import("../src/services/notification.service.js");
    
    console.log("📤 Sending test notifications to all users...\n");
    const result = await SendTestNotificationToAllUsersService();

    // Display results
    console.log("\n" + "=".repeat(50));
    console.log("📊 TEST NOTIFICATION RESULTS");
    console.log("=".repeat(50));
    console.log(`✅ Successfully sent: ${result.sentCount}`);
    console.log(`❌ Failed: ${result.failedCount}`);
    console.log(`📊 Total users with FCM tokens: ${result.totalUsers}`);
    console.log(`💬 Status: ${result.message}`);
    console.log("=".repeat(50) + "\n");

    // Close connections
    await mongoose.connection.close();
    console.log("✅ Database connection closed");
    console.log("✨ Script completed successfully!\n");
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("\n💡 Alternative: Use the API endpoint if your server is running:");
    console.error("   POST http://localhost:8000/api/notifications/test-all");
    console.error("   Header: Authorization: Bearer YOUR_AUTH_TOKEN\n");
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

run();

