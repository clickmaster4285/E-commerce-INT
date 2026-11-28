// ==========================================================
// BACKFILL CATEGORY ANCESTORS — har category par `ancestors: [root ... parent]` (§4.4)
// ----------------------------------------------------------
//   node scripts/backfillCategoryAncestors.js          → dry run (sirf report)
//   node scripts/backfillCategoryAncestors.js --apply  → DB update
// Idempotent hai: sirf wahi docs likhta hai jinki ancestors galat/khali hain.
// Ye chalne ke baad productController ka category-subtree fast path (ancestors) active ho jata hai.
// ==========================================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const connectDB = require("../config/db");
const Category = require("../models/Category");
const Store = require("../models/Store");
const { buildAncestorMap } = require("../utils/categoryAncestors");

const APPLY = process.argv.includes("--apply");
const sameIds = (a = [], b = []) => a.length === b.length && a.every((x, i) => String(x) === String(b[i]));

(async () => {
  await connectDB();
  console.log(APPLY ? "APPLY mode" : "DRY RUN (add --apply to change the DB)");

  // Koi tenant context nahi, phir bhi skipTenantScope explicit — har store alag process hota hai
  const stores = await Store.find({}).select("_id subdomain").setOptions({ skipTenantScope: true }).lean();
  let changed = 0;
  let total = 0;
  for (const store of stores) {
    const cats = await Category.find({ storeId: store._id })
      .select("_id parent_category_id ancestors").setOptions({ skipTenantScope: true }).lean();
    const map = buildAncestorMap(cats);
    const ops = [];
    for (const c of cats) {
      const next = map.get(String(c._id)) || [];
      if (!sameIds(c.ancestors || [], next)) {
        ops.push({ updateOne: { filter: { _id: c._id }, update: { $set: { ancestors: next } } } });
      }
    }
    total += cats.length;
    changed += ops.length;
    console.log(`${store.subdomain || store._id}: ${cats.length} categories, ${ops.length} to update`);
    if (APPLY && ops.length) await Category.bulkWrite(ops, { ordered: false, skipTenantScope: true });
  }
  console.log(`Done. ${changed}/${total} categories ${APPLY ? "updated" : "would be updated"}.`);
})()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => require("mongoose").disconnect());
