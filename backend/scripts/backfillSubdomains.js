// ==========================================================
// BACKFILL SUBDOMAINS — purane stores ko subdomain do (ek dafa chalao)
//   cd backend && node scripts/backfillSubdomains.js            → sirf dikhata hai (dry run)
//   cd backend && node scripts/backfillSubdomains.js --apply    → DB me save karta hai
// ==========================================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Store = require("../models/Store");
const { ROOT_DOMAIN } = require("../utils/tenantHost");

const APPLY = process.argv.includes("--apply");

(async () => {
  await connectDB();
  await Store.createIndexes(); // naye unique (partial) indexes bana do (purane indexes ko chhedta nahi)

  const stores = await Store.find({ $or: [{ subdomain: { $exists: false } }, { subdomain: null }, { subdomain: "" }] })
    .sort({ createdAt: 1 });

  console.log(`${stores.length} store(s) without a subdomain${APPLY ? "" : " (dry run — add --apply to save)"}`);
  const reserved = new Set();

  for (const store of stores) {
    let sub = await Store.generateUniqueSubdomain(store.store_name, store._id);
    // Dry run me ek hi run ke andar duplicate se bacho
    for (let i = 2; reserved.has(sub); i += 1) sub = `${sub.replace(/-\d+$/, "")}-${i}`;
    reserved.add(sub);

    console.log(`  ${store._id}  "${store.store_name}"  →  ${sub}${ROOT_DOMAIN ? `.${ROOT_DOMAIN}` : ""}`);
    if (APPLY) await Store.updateOne({ _id: store._id }, { $set: { subdomain: sub } });
  }

  await mongoose.disconnect();
  console.log(APPLY ? "Done." : "Nothing saved.");
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
