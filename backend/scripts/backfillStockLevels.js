// ==========================================================
// BACKFILL stock_levels — Variant.quantity se (§3.9)
// ----------------------------------------------------------
//   node scripts/backfillStockLevels.js           → dry run
//   node scripts/backfillStockLevels.js --apply
// ==========================================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Variant = require("../models/Variant");
const StockLevel = require("../models/StockLevel");
const StockMovement = require("../models/StockMovement");

const APPLY = process.argv.includes("--apply");
const LOCATION = "main";

(async () => {
  await connectDB();
  await Variant.init();
  await StockLevel.init();
  await StockMovement.init();

  console.log(APPLY ? "APPLY mode" : "DRY RUN (add --apply to write)");

  const cursor = Variant.find({ is_deleted: { $ne: true } })
    .select("_id storeId quantity sku title")
  .lean()
    .cursor();

  let seen = 0;
  let created = 0;
  let skipped = 0;

  for await (const v of cursor) {
    seen++;
    const exists = await StockLevel.exists({
      storeId: v.storeId,
      variant_id: v._id,
      location_id: LOCATION,
    });
    if (exists) {
      skipped++;
      continue;
    }

    const on_hand = Math.max(0, Number(v.quantity) || 0);
    console.log(`  store ${v.storeId} variant ${v._id} → on_hand ${on_hand}`);

    if (APPLY) {
      await StockLevel.create({
        storeId: v.storeId,
        variant_id: v._id,
        location_id: LOCATION,
        on_hand,
        reserved: 0,
      });
      await StockMovement.create({
        storeId: v.storeId,
        variant_id: v._id,
        location_id: LOCATION,
        qty_delta: on_hand,
        on_hand_after: on_hand,
        kind: "opening_balance",
        sku: v.sku || "",
        variant_title: v.title || "",
        explanation: "Backfill from Variant.quantity",
        idempotency_key: `opening:${v._id}:${LOCATION}`,
      });
    }
    created++;
  }

  console.log(
    `\n${seen} variant(s) scanned; ${created} level(s)${APPLY ? " created" : " would be created"}; ${skipped} already had levels.`,
  );
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});