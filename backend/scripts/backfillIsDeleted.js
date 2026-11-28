// ==========================================================
// BACKFILL is_deleted:false — tight index bounds (§3.3)
// ----------------------------------------------------------
// Documents jahan is_deleted missing / null hai unko false set karo,
// taake { is_deleted: false } filters IXSCAN use kar saken.
//
//   node scripts/backfillIsDeleted.js              → dry run
//   node scripts/backfillIsDeleted.js --apply      → write
// ==========================================================
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");

const APPLY = process.argv.includes("--apply");

(async () => {
  await connectDB();
  const modelsDir = path.join(__dirname, "..", "models");
  for (const file of fs.readdirSync(modelsDir)) require(path.join(modelsDir, file));

  console.log(APPLY ? "APPLY mode" : "DRY RUN (add --apply to write)");

  let total = 0;
  for (const name of mongoose.modelNames()) {
    const Model = mongoose.model(name);
    if (!Model.schema.path("is_deleted")) continue;

    const filter = {
      $or: [{ is_deleted: { $exists: false } }, { is_deleted: null }],
    };
    const count = await Model.countDocuments(filter);
    if (!count) continue;

    console.log(`  ${name}: ${count} doc(s) missing is_deleted`);
    total += count;
    if (APPLY) {
      const res = await Model.updateMany(filter, { $set: { is_deleted: false } });
      console.log(`    → modified ${res.modifiedCount}`);
    }
  }

  console.log(total ? `\n${total} document(s)${APPLY ? " updated." : " would be updated."}` : "\nNothing to backfill.");
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
