// ==========================================================
// TENANT SCOPE PLUGIN (Mongoose) — har store ka data alag
// ----------------------------------------------------------
// Jab request kisi store host par ho (tenantContext me storeId ho):
//   • find / findOne / count / update / delete / distinct → filter me `storeId` add
//   • aggregate → pipeline ke shuru me { $match: { storeId } }
//   • create / save / insertMany → naye document par storeId khud set
//   • update ke zariye storeId badalna → ignore (store se bahar nahi nikal sakta)
//
// Platform host (super admin, signup) aur scripts par context nahi hota →
// koi filter nahi lagta (saare stores).
//
// Use:
//   schema.plugin(tenantScope)                                 // field: storeId
//   storeSchema.plugin(tenantScope, { field: "_id", stamp: false }) // Store khud
// ==========================================================

const mongoose = require("mongoose");
const { getStoreId } = require("./tenantContext");

const QUERY_OPS = [
  "find", "findOne", "countDocuments", "distinct",
  "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace",
  "updateOne", "updateMany", "replaceOne", "deleteOne", "deleteMany",
];
const UPDATE_OPS = new Set(["findOneAndUpdate", "updateOne", "updateMany"]);
const REPLACE_OPS = new Set(["findOneAndReplace", "replaceOne"]);

const toId = (id) => (mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(String(id)) : id);

function tenantScope(schema, { field = "storeId", stamp = true } = {}) {
  if (field !== "_id" && !schema.path(field)) {
    schema.add({ [field]: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null, index: true } });
  }

  // ── Queries ──
  schema.pre(QUERY_OPS, { query: true, document: false }, function tenantQueryFilter() {
    const storeId = getStoreId();
    if (!storeId || this.getOptions()?.skipTenantScope) return;

    // $and se — agar query me pehle se storeId/_id ho to dono shart lagengi
    this.and([{ [field]: toId(storeId) }]);

    if (field === "_id") return;

    if (UPDATE_OPS.has(this.op)) {
      const update = this.getUpdate() || {};
      delete update[field];
      if (update.$set) delete update.$set[field];
      if (update.$unset) delete update.$unset[field];
      if (this.getOptions()?.upsert) {
        update.$setOnInsert = { ...(update.$setOnInsert || {}), [field]: toId(storeId) };
      }
      this.setUpdate(update);
    } else if (REPLACE_OPS.has(this.op)) {
      const replacement = this.getUpdate();
      if (replacement && typeof replacement === "object") replacement[field] = toId(storeId);
    }
  });

  // ── Aggregate ──
  schema.pre("aggregate", function tenantAggregateFilter() {
    const storeId = getStoreId();
    if (!storeId || this.options?.skipTenantScope) return;
    const pipeline = this.pipeline();
    const match = { $match: { [field]: toId(storeId) } };
    // $geoNear / $search ko pehli stage rehna zaroori hai
    const first = pipeline[0] && Object.keys(pipeline[0])[0];
    if (first === "$geoNear" || first === "$search" || first === "$vectorSearch") pipeline.splice(1, 0, match);
    else pipeline.unshift(match);
  });

  if (!stamp || field === "_id") return;

  // ── Create / save ──
  schema.pre("validate", function tenantStampDocument() {
    const storeId = getStoreId();
    if (!storeId) return;
    const current = this.get(field);
    if (!current) {
      this.set(field, toId(storeId));
    } else if (String(current) !== String(storeId)) {
      throw new Error(`Cross-store write blocked on ${this.constructor.modelName}.`);
    }
  });

  schema.pre("insertMany", function tenantStampInsertMany(...args) {
    const storeId = getStoreId();
    if (!storeId) return;
    const docs = args.find(Array.isArray) || [];
    for (const doc of docs) {
      if (doc && typeof doc === "object" && !doc[field]) doc[field] = toId(storeId);
    }
  });
}

module.exports = tenantScope;
