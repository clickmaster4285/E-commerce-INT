const Plan = require("../models/Plan");
const Store = require("../models/Store");
const Product = require("../models/Product");
const Employee = require("../models/Employee");
const { getStoreId } = require("./tenantContext");

const KIND_META = {
  products: {
    limitKey: "maxProducts",
    label: "products",
    count: () => Product.countDocuments({}),
  },
  staff: {
    limitKey: "maxStaffAccounts",
    label: "staff accounts",
    count: () => Employee.countDocuments({}),
  },
};

/** Store doc ya storeId se plan resolve — plan missing/null → null (no limits) */
async function resolveStorePlan(storeOrId) {
  let planId = null;
  if (storeOrId && typeof storeOrId === "object") {
    planId = storeOrId.planId?._id || storeOrId.planId || null;
    if (storeOrId.limits || storeOrId.features) return storeOrId; // already a plan-like doc
  } else if (storeOrId) {
    planId = storeOrId;
  }

  if (!planId) {
    const storeId = getStoreId();
    if (!storeId) return null;
    const store = await Store.findById(storeId).select("planId").lean();
    planId = store?.planId || null;
  }

  if (!planId) return null;
  return Plan.findById(planId).lean();
}

/**
 * Current tenant ke liye limit check.
 * kind: "products" | "staff"
 * Returns null jab OK; warna { status, message } jo controller res me bhej de.
 */
async function assertWithinLimit(kind) {
  const meta = KIND_META[kind];
  if (!meta) return null;

  const storeId = getStoreId();
  if (!storeId) return null;

  const store = await Store.findById(storeId).select("planId").lean();
  if (!store?.planId) return null;

  const plan = await Plan.findById(store.planId).select("name limits status").lean();
  if (!plan) return null;

  const cap = plan.limits?.[meta.limitKey];
  if (cap == null || !Number.isFinite(Number(cap))) return null; // unlimited

  const max = Math.max(0, Math.floor(Number(cap)));
  const used = await meta.count();
  if (used < max) return null;

  return {
    status: 403,
    message: `Your "${plan.name}" plan allows up to ${max} ${meta.label}. Upgrade the plan to add more.`,
  };
}

module.exports = { resolveStorePlan, assertWithinLimit };
