// ==========================================================
// SANITIZE BODY — mass assignment guard (optimizeplan.md §2.2)
// ----------------------------------------------------------
// Kai controllers `{ ...req.body }` seedha Model.create / $set me dete the →
// client server-managed fields bhi set kar sakta tha (usedCount, vendor balance,
// is_deleted, createdBy, storeId, activity log, translations ...).
//
// withoutProtected(body, extra) ek SHALLOW copy deta hai jisme:
//   • common protected keys nahi (neeche list) + model-specific `extra`
//   • `$` se shuru hone wali keys nahi (Mongo operator injection: {$set:..})
//   • dotted keys nahi ("activity.0" / "storeId.x" jaise path writes)
// Asal hal per-endpoint zod schema (§5.3) hai; ye tab tak ka guard hai.
// ==========================================================

const COMMON_PROTECTED = [
  "_id", "id", "__v", "storeId",
  "createdby", "updatedby", "deletedby", "createdBy", "updatedBy", "deletedBy",
  "is_deleted", "deleted_at", "deletedAt",
  "created_at", "updated_at", "createdAt", "updatedAt",
  "translations", "translation_source", "translation_status",
  "activity", "activities", "history", "edit_history",
];

function withoutProtected(body, extra = []) {
  const out = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) return out;
  const blocked = new Set([...COMMON_PROTECTED, ...extra]);
  for (const [key, value] of Object.entries(body)) {
    if (blocked.has(key)) continue;
    if (key.startsWith("$") || key.includes(".")) continue;
    out[key] = value;
  }
  return out;
}

module.exports = { withoutProtected, COMMON_PROTECTED };
