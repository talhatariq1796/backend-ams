import dotenv from "dotenv";
import express from "express";
import { DBConnect } from "./utils/dbConnect.util.js";

dotenv.config();

const app = express();
app.set("trust proxy", true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure DB is connected (safe to call per cold-start caching in DBConnect)
DBConnect().catch((err) => {
  // Log but don't crash on import — callers can handle failures as needed
  console.error("DB connect error in app.js:", err);
});

export { app };
