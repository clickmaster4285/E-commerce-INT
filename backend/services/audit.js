// ==========================================================
// AUDIT SERVICE — non-blocking buffer, §3.5
// ----------------------------------------------------------
// record() kabhi caller ko throw nahi karta; events memory me queue
// hokar ~200ms par insertMany se flush hoti hain.
// ==========================================================

const AuditEvent = require("../models/AuditEvent");
const { getStoreId } = require("../utils/tenantContext");
const log = require("../utils/logger");

const FLUSH_MS = 200;
const buffer = [];
let flushTimer = null;
let flushing = false;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_MS);
  if (typeof flushTimer.unref === "function") flushTimer.unref();
}

async function flush() {
  if (flushing || !buffer.length) return;
  flushing = true;
  const batch = buffer.splice(0, buffer.length);
  try {
    await AuditEvent.insertMany(batch, { ordered: false });
  } catch (err) {
    log.error("audit flush error:", err.message);
  } finally {
    flushing = false;
    if (buffer.length) scheduleFlush();
  }
}

/**
 * @param {object} event — storeId optional (getStoreId se fill hota hai)
 */
function record(event = {}) {
  try {
    const storeId = event.storeId || getStoreId();
    if (!storeId) return;

    buffer.push({
      storeId: String(storeId),
      entityType: String(event.entityType || "unknown").trim() || "unknown",
      entityId: event.entityId || null,
      action: String(event.action || "unknown").trim() || "unknown",
      actorType: event.actorType || "system",
      actorId: event.actorId || null,
      actorName: String(event.actorName || "").trim(),
      changes: Array.isArray(event.changes) ? event.changes : [],
      meta: event.meta && typeof event.meta === "object" ? event.meta : {},
      at: event.at instanceof Date ? event.at : new Date(),
    });
    scheduleFlush();
  } catch (err) {
    try {
      log.warn("audit.record skip:", err.message);
    } catch {}
  }
}

module.exports = { record, flush };