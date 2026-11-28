// ==========================================================
// AUDIT JOB (§6.3) — buffered flush via queue when Redis/BullMQ on
// ==========================================================
const queue = require("./queue");
const log = require("../utils/logger");

const AUDIT_JOB = "audit.batch";

queue.register(AUDIT_JOB, async (batch) => {
  const events = Array.isArray(batch?.events) ? batch.events : [];
  if (!events.length) return;
  const AuditEvent = require("../models/AuditEvent");
  await AuditEvent.insertMany(events, { ordered: false });
});

/**
 * Persist a batch of audit events (queue when Bull/Redis available).
 * @param {object[]} events
 */
function enqueueAuditBatch(events, opts = {}) {
  const list = Array.isArray(events) ? events.filter(Boolean) : [];
  if (!list.length) return Promise.resolve({ queued: false });
  return queue.add(
    AUDIT_JOB,
    { events: list },
    {
      jobId: opts.jobId || `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      attempts: 3,
      backoffMs: 500,
      ...opts,
    },
  ).catch((err) => {
    log.warn("[jobs/audit] enqueue failed, inline insert:", err?.message || err);
    const AuditEvent = require("../models/AuditEvent");
    return AuditEvent.insertMany(list, { ordered: false })
      .then(() => ({ queued: false, inline: true }))
      .catch((e) => {
        log.error("[jobs/audit] inline insert failed:", e?.message || e);
        return { queued: false, error: e?.message };
      });
  });
}

module.exports = { AUDIT_JOB, enqueueAuditBatch };
