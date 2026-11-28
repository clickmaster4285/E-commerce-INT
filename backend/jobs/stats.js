// ==========================================================
// STATS JOB (§6.3) — StoreDailyStats / PlatformStats bumps on queue
// ==========================================================
const queue = require("./queue");
const log = require("../utils/logger");

const STATS_JOB = "stats.bump";

queue.register(STATS_JOB, async (payload) => {
  const StoreDailyStats = require("../models/StoreDailyStats");
  const PlatformStats = require("../models/PlatformStats");
  const { runWithStore } = require("../utils/tenantContext");

  if (payload?.kind === "store" && payload.storeId && payload.day && payload.$inc) {
    await runWithStore(payload.storeId, async () => {
      await StoreDailyStats.updateOne(
        { day: payload.day },
        { $inc: payload.$inc, $setOnInsert: { day: payload.day } },
        { upsert: true },
      );
    });
    return;
  }
  if (payload?.kind === "platform" && payload.$inc) {
    await PlatformStats.updateOne(
      { key: "global" },
      { $inc: payload.$inc, $set: { updated_at: new Date() }, $setOnInsert: { key: "global" } },
      { upsert: true },
    );
  }
});

function enqueueStoreDailyBump(storeId, day, $inc) {
  if (!storeId || !day || !Object.keys($inc || {}).length) return Promise.resolve({ queued: false });
  // Unique jobId — each bump must apply (no merge/dedupe of counters)
  return queue.add(
    STATS_JOB,
    { kind: "store", storeId: String(storeId), day, $inc },
    {
      jobId: `stats-store-${storeId}-${day}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      attempts: 3,
      backoffMs: 500,
    },
  ).catch((err) => {
    log.warn("[jobs/stats] store bump enqueue failed:", err?.message || err);
    return { queued: false };
  });
}

function enqueuePlatformBump($inc) {
  if (!Object.keys($inc || {}).length) return Promise.resolve({ queued: false });
  return queue.add(
    STATS_JOB,
    { kind: "platform", $inc },
    {
      jobId: `stats-platform-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      attempts: 3,
      backoffMs: 500,
    },
  ).catch((err) => {
    log.warn("[jobs/stats] platform bump enqueue failed:", err?.message || err);
    return { queued: false };
  });
}

module.exports = { STATS_JOB, enqueueStoreDailyBump, enqueuePlatformBump };
