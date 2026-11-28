// ==========================================================
// MIGRATION RUNNER — §3.8
// ----------------------------------------------------------
// scripts/migrations/ me `NNN-name.js` load karta hai (001-noop-example.js waghera).
// Har file `exports.up({ dryRun })` export kare.
// Applied migrations `migrations` collection me { name, appliedAt }.
//
//   node scripts/migrations/run.js           → dry run (default)
//   node scripts/migrations/run.js --apply   → run + record
// ==========================================================

const fs = require("fs");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", "..", ".env"),
  quiet: true,
});

const mongoose = require("mongoose");
const connectDB = require("../../config/db");

const APPLY = process.argv.includes("--apply");
const MIGRATIONS_DIR = __dirname;

const migrationLedgerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    appliedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

const Migration =
  mongoose.models.Migration || mongoose.model("Migration", migrationLedgerSchema);

async function main() {
  await connectDB();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}-.+\.js$/.test(f))
    .sort();

  const appliedRows = await Migration.find().select("name").lean();
  const applied = new Set(appliedRows.map((r) => r.name));

  let exitCode = 0;

  for (const file of files) {
    const name = file.replace(/\.js$/, "");
    if (applied.has(name)) {
      console.log(`skip (already applied): ${name}`);
      continue;
    }

    const modPath = path.join(MIGRATIONS_DIR, file);
    delete require.cache[require.resolve(modPath)];
    const mod = require(modPath);

    if (typeof mod.up !== "function") {
      console.warn(`skip (missing exports.up): ${file}`);
      continue;
    }

    console.log(`\n${APPLY ? "APPLY" : "DRY-RUN"}: ${name}`);
    try {
      await mod.up({ dryRun: !APPLY });
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      exitCode = 1;
      break;
    }

    if (APPLY) {
      await Migration.create({ name, appliedAt: new Date() });
      console.log(`  recorded in migrations: ${name}`);
    }
  }

  await mongoose.disconnect();
  if (exitCode) process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});