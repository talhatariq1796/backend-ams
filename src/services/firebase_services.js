import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple possible sources for Firebase service account.
// Prefer environment variables (base64/raw) before any repo file paths so
// serverless deployments (Vercel) will use secrets from env.
const possiblePaths = [];

// Env-first: base64 then raw JSON then path (explicit path)
if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  possiblePaths.push("ENV_FIREBASE_JSON_B64");
}
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  possiblePaths.push("ENV_FIREBASE_JSON");
}
if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  possiblePaths.push(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

// Lastly, try common repo locations (only useful for local dev)
possiblePaths.push(
  path.resolve(
    __dirname,
    "../../whitebox-ams-firebase-adminsdk-fbsvc-388babdf43.json",
  ),
);
possiblePaths.push(
  path.resolve(
    process.cwd(),
    "whitebox-ams-firebase-adminsdk-fbsvc-388babdf43.json",
  ),
);

// Filter out any falsy entries
possiblePaths = possiblePaths.filter(Boolean);

let firebaseInitialized = false;

// Only initialize if not already initialized
if (admin.apps.length === 0) {
  for (const serviceAccountPath of possiblePaths) {
    try {
      let serviceAccount;

      if (serviceAccountPath === "ENV_FIREBASE_JSON") {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } else if (serviceAccountPath === "ENV_FIREBASE_JSON_B64") {
        const decoded = Buffer.from(
          process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
          "base64",
        ).toString("utf8");
        serviceAccount = JSON.parse(decoded);
      } else if (existsSync(serviceAccountPath)) {
        serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
      } else {
        continue;
      }

      // Basic validation of required fields to avoid obscure errors later
      if (
        !serviceAccount ||
        !serviceAccount.client_email ||
        !serviceAccount.private_key
      ) {
        throw new Error("Invalid Firebase service account JSON (missing keys)");
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("🔥 Firebase Admin Initialized from:", serviceAccountPath);
      firebaseInitialized = true;
      break;
    } catch (error) {
      console.error(
        `❌ Error initializing Firebase from ${serviceAccountPath}:`,
        error && error.stack ? error.stack : error,
      );
    }
  }

  if (!firebaseInitialized) {
    const msg = [
      "Firebase Admin initialization failed - no valid service account found.",
      "Set one of the following in your deployment environment:",
      " - FIREBASE_SERVICE_ACCOUNT (raw JSON)",
      " - FIREBASE_SERVICE_ACCOUNT_BASE64 (base64-encoded JSON)",
      " - FIREBASE_SERVICE_ACCOUNT_PATH (path to JSON file)",
      "Tried paths:",
      JSON.stringify(possiblePaths),
    ].join("\n");
    console.error(msg);
    // Throw to make the failure explicit in serverless environments (helps Vercel logs)
    throw new Error(msg);
  }
} else {
  console.log("🔥 Firebase Admin already initialized");
  firebaseInitialized = true;
}

export default admin;
