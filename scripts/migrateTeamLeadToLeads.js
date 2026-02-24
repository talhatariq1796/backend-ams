/**
 * One-time migration: copy team.lead -> team.leads for existing documents.
 * Run after deploying the "multiple leads per team" changes.
 *
 * Usage: node scripts/migrateTeamLeadToLeads.js
 * (Ensure DB connection is configured, or run from app context.)
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function migrate() {
  if (!MONGODB_URI) {
    console.error("Set MONGODB_URI or MONGO_URI in env");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db;
  const teams = db.collection("teams");

  const withLegacyLead = await teams.find({
    lead: { $exists: true, $ne: null },
  }).toArray();

  let updated = 0;
  for (const doc of withLegacyLead) {
    const hasNewLeads = Array.isArray(doc.leads) && doc.leads.length > 0;
    if (hasNewLeads) continue;

    await teams.updateOne(
      { _id: doc._id },
      { $set: { leads: [doc.lead] }, $unset: { lead: "" } }
    );
    updated++;
  }

  console.log(`Migrated ${updated} team(s) from lead -> leads.`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
