import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseInitialized = false;

// Only initialize if not already initialized
if (admin.apps.length === 0) {
  try {
    let serviceAccount;

    // Priority 1: Use environment variable (for Vercel/production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("🔥 Firebase Admin Initialized from environment variable");
      firebaseInitialized = true;
    }
    // Priority 2: Try local file (for development)
    else {
      const localPath = path.resolve(__dirname, "../../whitebox-ams-firebase-adminsdk-fbsvc-388babdf43.json");
      if (existsSync(localPath)) {
        serviceAccount = JSON.parse(readFileSync(localPath, "utf-8"));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("🔥 Firebase Admin Initialized from local file");
        firebaseInitialized = true;
      }
    }

    if (!firebaseInitialized) {
      console.error("❌ Firebase Admin initialization failed");
      console.error("   Ensure FIREBASE_SERVICE_ACCOUNT_JSON env variable is set on Vercel");
    }
  } catch (error) {
    console.error("❌ Error initializing Firebase:", error.message);
  }
} else {
  console.log("🔥 Firebase Admin already initialized");
  firebaseInitialized = true;
}

export default admin;
