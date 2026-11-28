const User = require("../models/User");
const log = require("./logger");
const audit = require("../services/audit");

const CATEGORY_ENTITY = {
  "Brand Management": "brand",
  "Category Management": "category",
  "Product Management": "product",
  "Vendor Management": "vendor",
  "Stock Management": "stock",
  "Authentication": "auth",
  "Employee Management": "employee",
  "Store Management": "store",
  "Order Management": "order",
  "Coupon Management": "discount",
};

const inferAction = (activityData) => {
  const text = String(activityData?.action || "").toLowerCase();
  if (text.includes("created")) return "created";
  if (text.includes("deleted")) return "deleted";
  if (text.includes("updated") || text.includes("modified")) return "updated";
  return "activity";
};

const pickEntityId = (details = {}) => {
  if (!details || typeof details !== "object") return null;
  return (
    details.brandId
    || details.categoryId
    || details.vendorId
    || details.productId
    || details.orderId
    || details.discountId
    || details.dealId
    || null
  );
};

const auditFromActivity = (activityData, performerId) => {
  const details = activityData?.details || {};
  const category = activityData?.category || "";
  audit.record({
    entityType: CATEGORY_ENTITY[category] || String(category || "activity").toLowerCase().replace(/\s+/g, "_"),
    entityId: pickEntityId(details),
    action: inferAction(activityData),
    actorType: "employee",
    actorId: activityData?.performedBy || performerId || null,
    actorName: activityData?.performedByName || "Admin",
    changes: Array.isArray(activityData?.changes) ? activityData.changes : [],
    meta: {
      category,
      summary: activityData?.action || "",
      details,
    },
  });
};

const pushStoreActivity = async (storeId, req, action, summary, details = null) => {
  if (!storeId) return;
  const actor = req?.superAdmin || req?.user;
  const actorType = req?.superAdmin ? "superadmin" : req?.user ? "employee" : "system";
  const actorName = actor?.name || actor?.email || (actorType === "superadmin" ? "Super Admin" : actorType === "employee" ? "Employee" : "System");
  const Store = require("../models/Store");
  await Store.updateOne(
    { _id: storeId },
    { $push: { activity: { $each: [{ action, summary, actorType, actorId: actor?._id || actor?.id || null, actorName, at: new Date(), details }], $position: 0, $slice: 100 } } },
  ).setOptions({ skipTenantScope: true }); // activity log: employee lookup cross-store (background helper)
};

/**
 * Pushes activity to a specific user's array
 */
const pushActivityToUser = async (userId, activityData) => {
  try {
    audit.record({
      entityType: "user",
      entityId: userId || null,
      action: String(activityData?.action || activityData?.type || "activity"),
      actorType: "system",
      actorId: userId || null,
      actorName: activityData?.performedByName || "",
      meta: activityData || {},
    });
    if (!userId) return;
    await User.findByIdAndUpdate(userId, {
      $push: {
        activities: {
          $each: [{ ...activityData, timestamp: new Date() }],
          $position: 0, // Newest first
          $slice: 100,  // Keep last 100
        },
      },
    });
  } catch (err) {
    log.error("⚠️ pushActivityToUser error:", err.message);
  }
};

/**
 * §3.5: purana User-scan wala global push hata diya — sirf audit_events me likhte hain.
 * Embedded document pushes (Store.activity waghera) alag migration se aayenge.
 */
const pushGlobalActivity = async (_io, activityData, performerId) => {
  try {
    auditFromActivity(activityData || {}, performerId);
  } catch (err) {
    log.debug?.("pushGlobalActivity audit skip:", err.message);
  }
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
  pushActivityToUser,
  pushGlobalActivity,
  getChanges,
  stableStringify,
  isSameValue,
  isSameList,
};
