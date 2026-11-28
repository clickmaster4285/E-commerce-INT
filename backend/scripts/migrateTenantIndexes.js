// ==========================================================
// MIGRATE TENANT INDEXES — multi-tenant ke liye DB indexes theek karo
// ----------------------------------------------------------
// Har store-scoped model par:
//   • purane GLOBAL unique indexes (jin me storeId nahi) hatao — warna store B
//     wo code/number use nahi kar sakta jo store A ke paas hai
//   • naye { storeId, field } unique indexes banao
//   • bina storeId wale documents report karo (kisi store me nazar nahi aayenge)
//
//   node scripts/migrateTenantIndexes.js                         → dry run
//   node scripts/migrateTenantIndexes.js --apply                 → indexes theek
//   node scripts/migrateTenantIndexes.js --apply --assign <sub>  → + bina storeId docs us store ko
// ==========================================================
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");

const APPLY = process.argv.includes("--apply");
const assignIdx = process.argv.indexOf("--assign");
const ASSIGN_TO = assignIdx > -1 ? process.argv[assignIdx + 1] : null;

(async () => {
  await connectDB();
  const modelsDir = path.join(__dirname, "..", "models");
  for (const file of fs.readdirSync(modelsDir)) require(path.join(modelsDir, file));

  const Store = mongoose.model("Store");
  let assignStore = null;
  if (ASSIGN_TO) {
    assignStore = await Store.findOne({ subdomain: ASSIGN_TO }).lean();
    if (!assignStore) throw new Error(`No store with subdomain "${ASSIGN_TO}"`);
  }

  console.log(APPLY ? "APPLY mode" : "DRY RUN (add --apply to change the DB)");

  for (const name of mongoose.modelNames()) {
    const Model = mongoose.model(name);
    // Sirf tenantScope wale models (storeId field hona kaafi nahi — RefreshSession
    // me storeId hai lekin superadmin sessions ka store null hi rehna chahiye)
    if (name === "Store" || !Model.schema.$tenantScopeField) continue;
    // Global attributes kisi EK store ko assign nahi hote — har store ki copy bannti hai
    const copyPerStore = name === "Attribute";

    const existing = await Model.collection.indexes().catch(() => []); // collection na ho to []
    // Sirf wo global unique indexes jo ab schema me NAHI hain (schema me jaan boojh kar global
    // rakhe gaye — jaise Review {product_id,user_id}, Quote token — chhed‑e nahi jate)
    // (key + unique dono match hone chahiye — `index: true` wala non-unique index alag hai)
    const declaredUnique = new Set(
      Model.schema.indexes().filter(([, opts]) => opts?.unique).map(([fields]) => JSON.stringify(fields)),
    );
    const stale = existing.filter(
      (ix) => ix.unique && ix.name !== "_id_" && !("storeId" in ix.key) && !declaredUnique.has(JSON.stringify(ix.key)),
    );
    const orphans = await Model.countDocuments({ $or: [{ storeId: null }, { storeId: { $exists: false } }] });

    if (!stale.length && !orphans) continue;
    console.log(`\n${name} (${Model.collection.name})`);
    for (const ix of stale) {
      console.log(`  drop global unique index ${ix.name}  ${JSON.stringify(ix.key)}`);
      if (APPLY) await Model.collection.dropIndex(ix.name);
    }
    if (orphans && copyPerStore) {
      console.log(`  ${orphans} global document(s) → copy into every store: node scripts/migrateAttributesPerStore.js --apply`);
    } else if (orphans) {
      console.log(`  ${orphans} document(s) without storeId${assignStore ? ` → ${assignStore.subdomain}` : " (use --assign <subdomain>)"}`);
      if (APPLY && assignStore) {
        await Model.updateMany(
          { $or: [{ storeId: null }, { storeId: { $exists: false } }] },
          { $set: { storeId: assignStore._id } },
        );
      }
    }
  }

  // Soft-delete unique compounds `{storeId, code, is_deleted}` → partial unique
  // on `is_deleted:false` (optimizeplan.md §3.3). Drop the old key so createIndexes
  // can build the new partial index.
  const SOFT_UNIQUE_LEGACY = {
    Brand: { storeId: 1, brand_code: 1, is_deleted: 1 },
    Attribute: { storeId: 1, code: 1, is_deleted: 1 },
    Category: { storeId: 1, category_code: 1, is_deleted: 1 },
    Vendor: { storeId: 1, vendor_code: 1, is_deleted: 1 },
  };
  for (const [name, key] of Object.entries(SOFT_UNIQUE_LEGACY)) {
    if (!mongoose.modelNames().includes(name)) continue;
    const Model = mongoose.model(name);
    const existing = await Model.collection.indexes().catch(() => []);
    const stale = existing.find(
      (ix) => ix.unique && JSON.stringify(ix.key) === JSON.stringify(key),
    );
    if (!stale) continue;
    console.log(`\n${name}: drop soft-delete unique ${stale.name} ${JSON.stringify(stale.key)}`);
    if (APPLY) await Model.collection.dropIndex(stale.name);
  }

  if (APPLY) {
    for (const name of mongoose.modelNames()) await mongoose.model(name).createIndexes();
    console.log("\nPer-store indexes created.");
  }
  await mongoose.disconnect();
  console.log(APPLY ? "Done." : "\nNothing changed.");
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
