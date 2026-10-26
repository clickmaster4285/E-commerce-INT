// ==========================================
// TRANSLATION PREFLIGHT + BACKFILL
// ==========================================
// Existing English content → auto-translate → MongoDB me persist.
//
// Usage:
//   npm run translation:check                       # sirf connectivity test
//   npm run backfill:translations                   # saare models
//   npm run backfill:translations -- --model=brand --limit=20 --batch=10
//   npm run backfill:translations -- --force        # stale + done dono dobara
//
// Options:
//   --model=all|brand|category|product|attribute|review|vendor|shippingmethod|order|purchaseorder|stockhistory (default: all)
//   --batch=N     har batch me kitne docs   (default: 25)
//   --limit=N     sirf pehle N docs per model (default: 0 = all)
//   --force       hash match hone par bhi dobara translate karo
//                 (default: sirf stale/pending hi translate hote hain, is liye
//                  ye script baar baar chalana safe hai)
//
// Safety:
//   • English `name`/`description` kabhi overwrite/delete nahi hote.
//   • Cursor-based batching — poora dataset memory me nahi aata.
//   • LibreTranslate down ho to docs chhoot jate hain (status `pending` rehta
//     hai); script dobara chalane par sirf wahi process honge.

require("dotenv").config();
const mongoose = require("mongoose");

const Brand = require("../models/brand");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Attribute = require("../models/Attribute");
const Review = require("../models/Review");
const Discount = require("../models/Discount");
const Deal = require("../models/Deal");
const Banner = require("../models/Banner");
const Vendor = require("../models/Vendor");
const ShippingMethod = require("../models/ShippingMethod");
const Order = require("../models/Order");
const PurchaseOrder = require("../models/PurchaseOrder");
const StockHistory = require("../models/StockHistory");
const { checkAvailability } = require("../utils/libreTranslate");
const { backfillTranslations } = require("../utils/translationService");

const DEFAULT_URL = "http://localhost:5055"; // 5000 = Express, 5005 = LibreTranslate

const MODELS = {
  brand: Brand,
  category: Category,
  product: Product,
  attribute: Attribute,
  review: Review,
  discount: Discount,
  deal: Deal,
  banner: Banner,
  vendor: Vendor,
  shippingmethod: ShippingMethod,
  order: Order,
  purchaseorder: PurchaseOrder,
  stockhistory: StockHistory,
};

function parseArgs() {
  const args = {};
  for (const raw of process.argv.slice(2)) {
    const [key, value] = raw.replace(/^--/, "").split("=");
    args[key] = value === undefined ? true : value;
  }
  return {
    model: String(args.model || "all").toLowerCase(),
    batchSize: Number(args.batch) || 25,
    limit: Number(args.limit) || 0,
    force: args.force === true || args.force === "true",
  };
}

/**
 * Sirf connectivity + Urdu-model check. Kuch bhi DB me nahi likhta.
 * @returns {Promise<{ok:boolean, error:string|null}>}
 */
async function runPreflight() {
  const availability = await checkAvailability();

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  Translation engine check (Argos bridge)");
  console.log("══════════════════════════════════════════════════════════");
  console.log("  URL          :", process.env.LIBRETRANSLATE_URL || `(not set — default ${DEFAULT_URL})`);
  console.log("  API key      :", process.env.LIBRETRANSLATE_API_KEY ? "set" : "not set (keyless instance)");
  console.log("  Targets      :", process.env.TRANSLATE_TARGET_LOCALES || "ur");

  if (availability.ok) {
    console.log("  Status       : \x1b[32mOK\x1b[0m — engine reachable, models installed");
    console.log("  Targets      :", availability.targets.join(", "));
    console.log("══════════════════════════════════════════════════════════\n");
  } else {
    console.log("  Status       : \x1b[31mNOT AVAILABLE\x1b[0m —", availability.error);
    if (availability.targets?.length) {
      console.log("  Installed    :", availability.targets.join(", "));
    }
    console.log("\n  Setup:");
    console.log("    1. Argos bridge chalao (local, koi paid API nahi):");
    console.log("         py backend/scripts/argosTranslateServer.py");
    console.log("    2. Models installed hain ya nahi dekho:");
    console.log("         py -m pip install argostranslate");
    console.log("         argospm install translate-ur     # Urdu");
    console.log("         argospm install translate-ar     # Arabic");
    console.log("    3. backend/.env me LIBRETRANSLATE_URL sahi port ke saath set karo");
    console.log("         (5055 — 5000 Express ke liye, 5005 LibreTranslate ke liye reserved)");
    console.log("    4. npm run backfill:translations\n");
    console.log("══════════════════════════════════════════════════════════\n");
  }

  return availability;
}

async function runBackfill() {
  const { model, batchSize, limit, force } = parseArgs();

  const selected =
    model === "all" ? Object.values(MODELS) : MODELS[model] ? [MODELS[model]] : null;

  if (!selected) {
    console.error(`✗ Unknown --model=${model}. Use: all | ${Object.keys(MODELS).join(" | ")}`);
    process.exit(1);
  }

  if (!process.env.MONGO_URI) {
    console.error("✗ MONGO_URI missing in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const availability = await runPreflight();
  if (!availability.ok) {
    console.error("✗ LibreTranslate unavailable — backfill cancel.");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`→ Backfilling ${model} (batch=${batchSize}, limit=${limit || "all"})\n`);

  let lastLine = 0;
  const summary = await backfillTranslations(selected, {
    batchSize,
    limit,
    force,
    onProgress: ({ modelName, processed, translated, failedCount }) => {
      const now = Date.now();
      if (now - lastLine < 400) return; // throttled progress
      lastLine = now;
      const pct = limit ? Math.round((processed / limit) * 100) : null;
      console.log(
        `  ${modelName}: processed=${processed}${pct ? ` (${pct}%)` : ""} ` +
          `translated=${translated} failed=${failedCount}`
      );
    },
  });

  console.log("\n✓ Backfill complete:");
  for (const [name, stats] of Object.entries(summary)) {
    console.log(
      `  ${name.padEnd(10)} processed=${stats.processed} translated=${stats.translated} failed=${stats.failedCount}`
    );
  }

  await mongoose.disconnect();
}

async function main() {
  // Sirf `--check` diya ho to preflight-only (DB tak chhuna nahi).
  if (process.argv.includes("--check")) {
    const availability = await runPreflight();
    process.exit(availability.ok ? 0 : 1);
  }

  await runBackfill().catch(async (error) => {
    console.error("✗ Backfill failed:", error?.message || error);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });
}

if (require.main === module) {
  main();
}

module.exports = { runPreflight, runBackfill };
