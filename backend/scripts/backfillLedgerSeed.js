// ==========================================================
// BACKFILL ledger chart — ensureChartOfAccounts (§3.9)
// ----------------------------------------------------------
// Optional noop-style script: dry-run sirf accounts list karta hai;
// --apply har store ke liye account_balances seed karta hai.
//
//   node scripts/backfillLedgerSeed.js
//   node scripts/backfillLedgerSeed.js --apply
// ==========================================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Store = require("../models/Store");
const { ensureChartOfAccounts, CHART_OF_ACCOUNTS } = require("../services/ledger");
const { runWithStore } = require("../utils/tenantContext");

const APPLY = process.argv.includes("--apply");

(async () => {
  await connectDB();
  console.log("Chart of accounts:", CHART_OF_ACCOUNTS.join(", "));
  console.log(APPLY ? "APPLY mode" : "DRY RUN (add --apply to seed balances)");

  const stores = await Store.find({}).select("_id store_name subdomain").lean();
  for (const store of stores) {
    console.log(`  store ${store.subdomain || store._id} (${store.store_name})`);
    if (APPLY) {
      await runWithStore(store._id, () => ensureChartOfAccounts(store._id));
    }
  }

  console.log(APPLY ? `\nSeeded ${stores.length} store(s).` : `\n${stores.length} store(s) would be seeded.`);
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});