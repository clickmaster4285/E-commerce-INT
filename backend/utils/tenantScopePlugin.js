// ==========================================================
// TENANT SCOPE PLUGIN (Mongoose) — har store ka data alag
// ----------------------------------------------------------
// Jab request kisi store host par ho (tenantContext me storeId ho):
//   • find / findOne / count / update / delete / distinct → filter me `storeId` add
//   • aggregate → pipeline ke shuru me { $match: { storeId } }
//   • create / save / insertMany → naye document par storeId khud set
//   • update ke zariye storeId badalna → ignore (store se bahar nahi nikal sakta)
//   • bulkWrite → har op (insert / update / replace / delete) par wahi scope
//   • aggregate ke $lookup / $unionWith / $graphLookup → store-owned collection
//     me bhi isi store ki shart (sub-pipeline)
//   • estimatedDocumentCount → store context me mana (countDocuments use karo)
//   • doc.deleteOne() / doc.updateOne() → Mongoose andar se query chalata hai,
//     wahi query hook scope karta hai
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

// ── Sub-pipelines ($lookup / $unionWith / $graphLookup) ──
// Collection name → scope field (sirf un collections ke liye jin par ye plugin laga hai)
function scopeFieldForCollection(collectionName) {
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    if (model.collection?.collectionName === collectionName && model.schema.$tenantScopeField) {
      return model.schema.$tenantScopeField;
    }
  }
  return null;
}

/** Pipeline ke andar dusre store-owned collections me jaane wale stages ko bhi isi store tak rakho */
function scopeSubPipelines(pipeline, storeId) {
  if (!Array.isArray(pipeline)) return pipeline;
  for (const stage of pipeline) {
    if (!stage || typeof stage !== "object") continue;

    if (stage.$lookup && typeof stage.$lookup.from === "string") {
      const f = scopeFieldForCollection(stage.$lookup.from);
      const inner = scopeSubPipelines(stage.$lookup.pipeline || [], storeId);
      // MongoDB 5+: localField/foreignField ke saath pipeline bhi chal sakti hai
      stage.$lookup.pipeline = f ? [{ $match: { [f]: toId(storeId) } }, ...inner] : inner;
      if (!f && !stage.$lookup.pipeline.length) delete stage.$lookup.pipeline;
    }

    if (stage.$unionWith) {
      const spec = typeof stage.$unionWith === "string" ? { coll: stage.$unionWith } : stage.$unionWith;
      const f = scopeFieldForCollection(spec.coll);
      const inner = scopeSubPipelines(spec.pipeline || [], storeId);
      spec.pipeline = f ? [{ $match: { [f]: toId(storeId) } }, ...inner] : inner;
      stage.$unionWith = spec;
    }

    if (stage.$graphLookup) {
      const f = scopeFieldForCollection(stage.$graphLookup.from);
      if (f) {
        stage.$graphLookup.restrictSearchWithMatch = {
          ...(stage.$graphLookup.restrictSearchWithMatch || {}),
          [f]: toId(storeId),
        };
      }
    }

    if (stage.$facet) {
      for (const key of Object.keys(stage.$facet)) scopeSubPipelines(stage.$facet[key], storeId);
    }
  }
  return pipeline;
}

// ── bulkWrite ── har operation par wahi scope jo normal query/save par lagta hai
function scopeBulkOps(ops, field, storeId) {
  const id = toId(storeId);
  const scopeFilter = (filter) => ({ $and: [filter || {}, { [field]: id }] });
  const stripField = (update) => {
    if (!update || typeof update !== "object") return update;
    if (Array.isArray(update)) {
      for (const stage of update) {
        for (const key of ["$set", "$addFields", "$unset"]) {
          if (stage?.[key] && typeof stage[key] === "object" && !Array.isArray(stage[key])) delete stage[key][field];
        }
        if (Array.isArray(stage?.$unset)) stage.$unset = stage.$unset.filter((k) => k !== field);
      }
      return update;
    }
    delete update[field];
    for (const key of ["$set", "$unset", "$setOnInsert", "$rename"]) if (update[key]) delete update[key][field];
    return update;
  };

  for (const op of ops) {
    const [type] = Object.keys(op || {});
    const spec = op?.[type];
    if (!spec) continue;
    if (type === "insertOne") {
      if (field === "_id") continue;
      const doc = spec.document || spec;
      if (doc[field] && String(doc[field]) !== String(storeId)) {
        throw new Error("Cross-store bulkWrite insert blocked.");
      }
      doc[field] = id;
      continue;
    }
    spec.filter = scopeFilter(spec.filter);
    if (field === "_id") continue;
    if (type === "updateOne" || type === "updateMany") {
      spec.update = stripField(spec.update);
      if (spec.upsert && !Array.isArray(spec.update)) {
        spec.update.$setOnInsert = { ...(spec.update.$setOnInsert || {}), [field]: id };
      }
    } else if (type === "replaceOne" && spec.replacement) {
      spec.replacement[field] = id;
    }
  }
}

function tenantScope(schema, { field = "storeId", stamp = true, index = true } = {}) {
  // index:false when the schema already declares a compound unique starting with storeId (§3.3)
  if (field !== "_id" && !schema.path(field)) {
    schema.add({
      [field]: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store",
        default: null,
        index: Boolean(index),
      },
    });
  }
  // Sub-pipeline scoping ke liye pehchan (scopeFieldForCollection)
  schema.$tenantScopeField = field;

  // estimatedDocumentCount filter nahi le sakta (collection metadata) → saare stores
  // ka count deta. Store context me mana — countDocuments({}) use karo.
  schema.pre("estimatedDocumentCount", { query: true, document: false }, function tenantRefuseEstimate() {
    if (getStoreId() && !this.getOptions()?.skipTenantScope) {
      throw new Error("estimatedDocumentCount is not store-scoped; use countDocuments() instead.");
    }
  });

  schema.pre("bulkWrite", function tenantScopeBulkWrite(...args) {
    const storeId = getStoreId();
    const ops = args.find(Array.isArray);
    const options = args.find((a) => a && typeof a === "object" && !Array.isArray(a));
    if (!storeId || !ops || options?.skipTenantScope) return;
    scopeBulkOps(ops, field, storeId);
  });

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
    // $lookup / $unionWith / $graphLookup dusre store-owned collections me → wahan bhi isi store
    scopeSubPipelines(pipeline, storeId);
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
module.exports.scopeSubPipelines = scopeSubPipelines;
module.exports.scopeBulkOps = scopeBulkOps;
