// ==========================================================
// MIGRATE TENANT INDEXES — multi-tenant ke liye DB indexes theek karo
// ----------------------------------------------------------
// Har store-scoped model par:
//   • purane GLOBAL unique indexes (jin me storeId nahi) hatao — warna store B
//     wo code/number use nahi kar sakta jo store A ke paas hai
//   • schema me se gayab stale indexes drop (unique + non-unique)
//   • naye schema indexes createIndexes() se banao
//   • bina storeId wale documents report karo
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

/** Stable key fingerprint for comparing index definitions. */
function keyFingerprint(key) {
  const ordered = {};
  for (const k of Object.keys(key).sort()) ordered[k] = key[k];
  return JSON.stringify(ordered);
}

function declaredIndexKeys(Model) {
  const declared = Model.schema.indexes();
  const keys = new Set(declared.map(([fields]) => keyFingerprint(fields)));
  const unique = new Set(
    declared.filter(([, opts]) => opts?.unique).map(([fields]) => keyFingerprint(fields)),
  );
  // Field-level index/unique (duplicate unique+index ek hi key banata hai)
  for (const [pathName, pathType] of Object.entries(Model.schema.paths)) {
    const opts = pathType?.options || {};
    if (opts.index || opts.unique) {
      const fp = keyFingerprint({ [pathName]: 1 });
      keys.add(fp);
      if (opts.unique) unique.add(fp);
    }
  }
  return { keys, unique };
}

async function reportAndDropStaleIndexes(Model, name) {
  const existing = await Model.collection.indexes().catch(() => []);
  const { keys: declaredKeys, unique: declaredUnique } = declaredIndexKeys(Model);

  const staleGlobalUnique = existing.filter(
    (ix) => ix.unique && ix.name !== "_id_" && !("storeId" in ix.key) && !declaredUnique.has(keyFingerprint(ix.key)),
  );
  const obsolete = existing.filter(
    (ix) =>
      ix.name !== "_id_" &&
      !declaredKeys.has(keyFingerprint(ix.key)) &&
      !ix.textIndexVersion,
  );

  if (!staleGlobalUnique.length && !obsolete.length) return;

  console.log(`\n${name} (${Model.collection.name})`);
  for (const ix of staleGlobalUnique) {
    console.log(`  drop global unique index ${ix.name}  ${JSON.stringify(ix.key)}`);
    if (APPLY) await Model.collection.dropIndex(ix.name).catch((e) => console.warn(`    skip: ${e.message}`));
  }
  for (const ix of obsolete) {
    if (staleGlobalUnique.some((s) => s.name === ix.name)) continue;
    console.log(`  drop obsolete index ${ix.name}  ${JSON.stringify(ix.key)}`);
    if (APPLY) await Model.collection.dropIndex(ix.name).catch((e) => console.warn(`    skip: ${e.message}`));
  }
}

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

  // ── Orphan storeId (tenant-scoped models only) ──
  for (const name of mongoose.modelNames()) {
    const Model = mongoose.model(name);
    if (name === "Store" || !Model.schema.$tenantScopeField) continue;
    const copyPerStore = name === "Attribute";

    const orphans = await Model.countDocuments({ $or: [{ storeId: null }, { storeId: { $exists: false } }] });
    if (!orphans) continue;
    console.log(`\n${name} (${Model.collection.name})`);
    if (orphans && copyPerStore) {
      console.log(`  ${orphans} global document(s) → copy into every store: node scripts/migrateAttributesPerStore.js --apply`);
    } else {
      console.log(`  ${orphans} document(s) without storeId${assignStore ? ` → ${assignStore.subdomain}` : " (use --assign <subdomain>)"}`);
      if (APPLY && assignStore) {
        await Model.updateMany(
          { $or: [{ storeId: null }, { storeId: { $exists: false } }] },
          { $set: { storeId: assignStore._id } },
        );
      }
    }
  }

  // ── Har model: schema.indexes() vs collection — stale drop (dry-run default) ──
  for (const name of mongoose.modelNames()) {
    if (name === "Store") continue;
    await reportAndDropStaleIndexes(mongoose.model(name), name);
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
      (ix) => ix.unique && keyFingerprint(ix.key) === keyFingerprint(key),
    );
    if (!stale) continue;
    console.log(`\n${name}: drop soft-delete unique ${stale.name} ${JSON.stringify(stale.key)}`);
    if (APPLY) await Model.collection.dropIndex(stale.name).catch((e) => console.warn(`  skip: ${e.message}`));
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
