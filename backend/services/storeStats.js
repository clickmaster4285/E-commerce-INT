const StoreDailyStats = require("../models/StoreDailyStats");
const PlatformStats = require("../models/PlatformStats");
const log = require("../utils/logger");
const { getStoreId } = require("../utils/tenantContext");

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Fire-and-forget daily counter bump (order / POS / invoice).
 * @param {{ revenue?: number, orders?: number, items?: number, newCustomers?: number }} delta
 */
function bumpStoreDaily(delta = {}) {
  const storeId = getStoreId();
  if (!storeId) return;
  const day = dayKey();
  const $inc = {};
  for (const [k, v] of Object.entries(delta)) {
    const n = Number(v) || 0;
    if (n) $inc[k] = n;
  }
  if (!Object.keys($inc).length) return;
  StoreDailyStats.updateOne({ day }, { $inc, $setOnInsert: { day } }, { upsert: true }).catch((err) =>
    log.warn("storeStats.bumpStoreDaily:", err?.message || err),
  );
}

function bumpPlatform(delta = {}) {
  const $inc = {};
  for (const [k, v] of Object.entries(delta)) {
    const n = Number(v) || 0;
    if (n) $inc[k] = n;
  }
  if (!Object.keys($inc).length) return;
  PlatformStats.updateOne(
    { key: "global" },
    { $inc, $set: { updated_at: new Date() }, $setOnInsert: { key: "global" } },
    { upsert: true },
  ).catch((err) => log.warn("storeStats.bumpPlatform:", err?.message || err));
}

// Super-admin dashboard: PlatformStats se counters (fresh ho to) — warna null, caller live countDocuments chalata hai.
// Fresh = updated_at PLATFORM_STATS_MAX_AGE_MS (default 5 min) ke andar; 0/missing field = "pata nahi" → fallback.
const PLATFORM_STATS_MAX_AGE_MS = Number(process.env.PLATFORM_STATS_MAX_AGE_MS) || 5 * 60 * 1000;

async function readPlatformTotals() {
  try {
    const doc = await PlatformStats.findOne({ key: "global" }).lean();
    if (!doc) return null;
    const age = Date.now() - new Date(doc.updated_at || 0).getTime();
    if (!Number.isFinite(age) || age > PLATFORM_STATS_MAX_AGE_MS) return null;
    const pick = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : null);
    return { stores: pick(doc.stores), sellers: pick(doc.sellers), customers: pick(doc.customers) };
  } catch (err) {
    log.warn("storeStats.readPlatformTotals:", err?.message || err);
    return null;
  }
}

module.exports = { bumpStoreDaily, bumpPlatform, dayKey, readPlatformTotals };
