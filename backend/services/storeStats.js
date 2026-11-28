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

module.exports = { bumpStoreDaily, bumpPlatform, dayKey };
