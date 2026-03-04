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
  for (const serviceAccountPath of possiblePaths) {
    if (existsSync(serviceAccountPath)) {
      try {
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("🔥 Firebase Admin Initialized from:", serviceAccountPath);
        firebaseInitialized = true;
        break;
      } catch (error) {
        console.error(`❌ Error initializing Firebase from ${serviceAccountPath}:`, error.message);
      }
    }
  }
  
  if (!firebaseInitialized) {
    console.error("❌ Firebase Admin initialization failed - service account file not found");
    console.error("   Tried paths:", possiblePaths);
  }
} else {
  console.log("🔥 Firebase Admin already initialized");
  firebaseInitialized = true;
}

export default admin;
