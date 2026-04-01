import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple possible paths for Firebase service account
const possiblePaths = [
  path.resolve(__dirname, "../../whitebox-ams-firebase-adminsdk-fbsvc-388babdf43.json"),
  path.resolve(process.cwd(), "whitebox-ams-firebase-adminsdk-fbsvc-388babdf43.json"),
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
].filter(Boolean);

let firebaseInitialized = false;

// Only initialize if not already initialized
if (admin.apps.length === 0) {
  // Try environment variable JSON content first (standard for Vercel)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("🔥 Firebase Admin Initialized from FIREBASE_SERVICE_ACCOUNT_JSON env");
      firebaseInitialized = true;
    } catch (error) {
      console.error("❌ Error initializing Firebase from environment variable:", error.message);
    }
  }

  // If not initialized via env, try file paths
  if (!firebaseInitialized) {
    for (const serviceAccountPath of possiblePaths) {
      if (serviceAccountPath && existsSync(serviceAccountPath)) {
        try {
          const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          console.log("🔥 Firebase Admin Initialized from file:", serviceAccountPath);
          firebaseInitialized = true;
          break;
        } catch (error) {
          console.error(`❌ Error initializing Firebase from ${serviceAccountPath}:`, error.message);
        }
      }
    }
  }
  
  if (!firebaseInitialized) {
    console.error("❌ Firebase Admin initialization failed - no service account found");
    console.error("   Please ensure FIREBASE_SERVICE_ACCOUNT_JSON env variable is set on Vercel");
    console.error("   Tried file paths:", possiblePaths);
  }
} else {
  console.log("🔥 Firebase Admin already initialized");
  firebaseInitialized = true;
}

export default admin;
