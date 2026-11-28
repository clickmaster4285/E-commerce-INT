// ==========================================================
// BACKFILL Product §3.4 summary fields
// ----------------------------------------------------------
//   node scripts/backfillProductSummary.js           → dry run
//   node scripts/backfillProductSummary.js --apply   → write
// ==========================================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
require("../models/Product");
require("../models/Variant");
require("../models/Review");
require("../models/Brand");
require("../models/Category");
const { refresh } = require("../services/productSummary");
const { runWithStore } = require("../utils/tenantContext");

const APPLY = process.argv.includes("--apply");
const BATCH = 50;

(async () => {
  await connectDB();
  const Product = mongoose.model("Product");
  const total = await Product.countDocuments({}).setOptions({ skipTenantScope: true }); // migration/backfill script: saare stores
  console.log(APPLY ? "APPLY mode" : "DRY RUN (add --apply to write)");
  console.log(`Products: ${total}`);

  let done = 0;
  let cursor = Product.find({})
    .select("_id storeId")
    .setOptions({ skipTenantScope: true }) // migration/backfill script: saare stores
    .lean()
    .cursor();

  let batch = [];
  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length < BATCH) continue;
    if (APPLY) {
      await Promise.all(
        batch.map((p) =>
          runWithStore({ _id: p.storeId }, () => refresh(p._id)).catch((e) => {
            console.warn(`  skip ${p._id}: ${e.message}`);
          }),
        ),
      );
    }
    done += batch.length;
    console.log(`  … ${done}/${total}`);
    batch = [];
  }
  if (batch.length) {
    if (APPLY) {
      await Promise.all(
        batch.map((p) =>
          runWithStore({ _id: p.storeId }, () => refresh(p._id)).catch((e) => {
            console.warn(`  skip ${p._id}: ${e.message}`);
          }),
        ),
      );
    }
    done += batch.length;
  }

  console.log(APPLY ? `Updated ${done} products.` : `Would refresh ${done} products.`);
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
