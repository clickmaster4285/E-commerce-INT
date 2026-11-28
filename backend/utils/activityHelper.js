const audit = require("../services/audit");

const pushStoreActivity = async (storeId, req, action, summary, details = null) => {
  if (!storeId) return;
  const actor = req?.superAdmin || req?.user;
  const actorType = req?.superAdmin ? "superadmin" : req?.user ? "employee" : "system";
  const actorName = actor?.name || actor?.email || (actorType === "superadmin" ? "Super Admin" : actorType === "employee" ? "Employee" : "System");
  // AuditEvent only — Store.activity embedding stopped (§3.5 cutover)
  audit.record({
    entityType: "store",
    entityId: storeId,
    action: String(action || "activity"),
    actorType,
    actorId: actor?._id || actor?.id || null,
    actorName,
    meta: { summary, details },
  });
};

/**
 * Helper to compare old vs new data
 */
const getChanges = (oldData, newData, fields) => {
  const changes = [];
  fields.forEach((field) => {
    const oldVal = oldData?.[field];
    const newVal = newData?.[field];
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      changes.push({ field, oldValue: oldVal || "(empty)", newValue: newVal || "(empty)" });
    }
  });
  return changes;
};

/**
 * Value ko stable string mein badalta hai (object ki key order se farq nahi padta,
 * array ki order preserve rehti hai). Audit fields (updated_at / updatedby) ko
 * sirf tab touch karne ke liye compare karte hain jab value waqai badli ho.
 */
const stableStringify = (value) => {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

/**
 * Deep comparison — order-sensitive (images jaisi lists ke liye).
 * FIX: isi se pata chalta hai ke user ne waqai kuch change kiya hai ya nahi,
 * warna same value dobara save karne par bhi "updated" event ban jata tha.
 */
const isSameValue = (a, b) => stableStringify(a) === stableStringify(b);

/**
 * Order-insensitive list comparison (tags ke liye).
 * Sirf re-order karne par "updated" nahi dikhana chahiye.
 */
const isSameList = (a, b) => {
  const norm = (list) =>
    Array.isArray(list) ? list.map((item) => String(item)).sort() : [];
  const left = norm(a);
  const right = norm(b);
  return left.length === right.length && left.every((v, i) => v === right[i]);
};

module.exports = {
  pushStoreActivity,
  getChanges,
  stableStringify,
  isSameValue,
  isSameList,
};
