const mongoose = require("mongoose");

function asObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === "object" && value._id && mongoose.isValidObjectId(value._id)) {
    return new mongoose.Types.ObjectId(String(value._id));
  }
  if (mongoose.isValidObjectId(value)) return new mongoose.Types.ObjectId(String(value));
  return null;
}

/**
 * Ek hi $in query se related docs attach karo (N+1 se bachne ke liye).
 * @param {object[]} docs
 * @param {{ field: string, model: object, select?: string, attachKey?: string }} opts
 */
async function hydrate(docs, { field, model, select = "name", attachKey } = {}) {
  if (!Array.isArray(docs) || !docs.length || !field || !model) return docs || [];

  const ids = new Set();
  for (const doc of docs) {
    const oid = asObjectId(doc[field]);
    if (oid) ids.add(String(oid));
  }
  if (!ids.size) return docs;

  const picked = String(select || "name")
    .split(/\s+/)
    .filter(Boolean);
  const projection = picked.length ? picked.join(" ") : "name";

  const related = await model.find({ _id: { $in: [...ids] } }).select(projection).lean();
  const byId = new Map(related.map((row) => [String(row._id), row]));

  const outKey = attachKey || field;
  return docs.map((doc) => {
    const oid = asObjectId(doc[field]);
    if (!oid) return doc;
    const hit = byId.get(String(oid));
    if (!hit) return doc;
    const payload = { _id: hit._id };
    for (const key of picked) {
      if (key in hit) payload[key] = hit[key];
    }
    if (attachKey) {
      return { ...doc, [outKey]: payload };
    }
    return { ...doc, [field]: payload };
  });
}

module.exports = { hydrate };