// ==========================================================
// MIGRATE ATTRIBUTES PER STORE — purane GLOBAL attributes → har store ki copy
// ----------------------------------------------------------
// Attribute pehle global tha (koi bhi store admin sab ke attributes badal /
// delete kar sakta tha). Ab tenantScope hai. Ye script:
//   1. har GLOBAL attribute (storeId null) ki har store me copy banata hai
//      (us store me usi code ka attribute pehle se ho to wahi use hota hai)
//   2. har store ki categories me `attributes.attribute_id` purane global id
//      se us store ki copy ki id par badal deta hai
//   3. --apply ke saath global docs delete (warna sirf report)
//
// ⚠️ PEHLE: node scripts/migrateTenantIndexes.js --apply
//    (purana global unique index {code, is_deleted} hatana zaroori hai, warna
//    dusre store me wahi code nahi ban sakta)
//
//   node scripts/migrateAttributesPerStore.js          → dry run
//   node scripts/migrateAttributesPerStore.js --apply  → copy + remap + global delete
// ==========================================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Attribute = require("../models/Attribute");
const Category = require("../models/Category");
const Store = require("../models/Store");

const APPLY = process.argv.includes("--apply");
const GLOBAL = { $or: [{ storeId: null }, { storeId: { $exists: false } }] };

(async () => {
  await connectDB();
  console.log(APPLY ? "APPLY mode" : "DRY RUN (add --apply to change the DB)");

  const indexes = await Attribute.collection.indexes().catch(() => []);
  const stale = indexes.find((ix) => ix.unique && !("storeId" in ix.key) && "code" in ix.key);
  if (stale) {
    console.error(`\nGlobal unique index "${stale.name}" still exists. Run first:\n  node scripts/migrateTenantIndexes.js --apply`);
    process.exitCode = 1;
    return;
  }

  // Koi tenant context nahi → plugin filter nahi lagata (jaan boojh kar saare docs)
  const globals = await Attribute.find(GLOBAL).lean();
  const stores = await Store.find({}).select("_id subdomain").setOptions({ skipTenantScope: true }).lean(); // migration script: saare stores
  console.log(`${globals.length} global attribute(s), ${stores.length} store(s)`);
  if (!globals.length) return;

  const globalIds = new Set(globals.map((g) => String(g._id)));

  for (const store of stores) {
    const idMap = new Map(); // global _id → store copy _id
    let copied = 0;
    let reused = 0;

    for (const g of globals) {
      const existing = await Attribute.findOne({ storeId: store._id, code: g.code, is_deleted: g.is_deleted })
        .select("_id")
        .lean();
      if (existing) {
        idMap.set(String(g._id), existing._id);
        reused++;
        continue;
      }
      const copyId = new mongoose.Types.ObjectId();
      idMap.set(String(g._id), copyId);
      copied++;
      if (APPLY) {
        const { _id, __v, ...rest } = g;
        // collection.insertOne: timestamps / translations jaise ke taise
        await Attribute.collection.insertOne({ ...rest, _id: copyId, storeId: store._id });
      }
    }

    const categories = await Category.find({ storeId: store._id, "attributes.attribute_id": { $in: [...globalIds] } })
      .select("attributes")
      .lean();
    let remapped = 0;
    for (const category of categories) {
      const attributes = category.attributes.map((a) => {
        const next = idMap.get(String(a.attribute_id));
        if (!next) return a;
        remapped++;
        return { ...a, attribute_id: next };
      });
      if (APPLY) await Category.collection.updateOne({ _id: category._id }, { $set: { attributes } });
    }

    console.log(
      `  ${store.subdomain || store._id}: ${copied} copied, ${reused} already present, ` +
        `${remapped} category link(s) in ${categories.length} categor(ies) remapped`,
    );
  }

  if (APPLY) {
    const { deletedCount } = await Attribute.collection.deleteMany(GLOBAL);
    console.log(`\nDeleted ${deletedCount} global attribute(s).`);
  }
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log(APPLY ? "Done." : "\nNothing changed.");
  });
