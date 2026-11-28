// ==========================================================
// CHAT UNREAD COUNTER (§4.5) — admin inbox ka total unread
// ----------------------------------------------------------
// Pehle har message / read par ChatConversation.aggregate($group) poore store par chalta tha.
// Ab per-store counter: Redis INCRBY (REDIS_URL ho) warna process-memory Map.
//   • counter nahi (cold / expire) → ek baar aggregate se seed, phir sirf INCRBY/DECRBY
//   • TTL short rakhi hai (self-heal): kisi drift par kuch minute me aggregate se dobara sahi
// ==========================================================

const TTL_SEC = 300;
const MAX_MEM = 2000;
const mem = new Map(); // storeKey → { n, expires }

const keyOf = (storeId) => `chat:unread:${String(storeId || "platform")}`;

function redis() {
  if (!String(process.env.REDIS_URL || "").trim()) return null;
  try { return require("../middleware/rateLimit").getRedisClient() || null; } catch { return null; }
}

/** Counter padho; na ho to `seed()` (aggregate) se bharo */
async function getUnread(storeId, seed) {
  const k = keyOf(storeId);
  const r = redis();
  if (r) {
    try {
      const v = await r.get(k);
      if (v !== null && v !== undefined) return Math.max(0, Number(v) || 0);
      const n = Math.max(0, Number(await seed()) || 0);
      await r.set(k, String(n), "EX", TTL_SEC);
      return n;
    } catch { /* Redis down → memory path */ }
  }
  const hit = mem.get(k);
  if (hit && hit.expires > Date.now()) return hit.n;
  const n = Math.max(0, Number(await seed()) || 0);
  if (mem.size >= MAX_MEM) mem.delete(mem.keys().next().value);
  mem.set(k, { n, expires: Date.now() + TTL_SEC * 1000 });
  return n;
}

/** Sirf tab adjust karo jab counter pehle se seeded ho (warna agla read aggregate se seed karega) */
async function adjustUnread(storeId, delta) {
  if (!delta) return;
  const k = keyOf(storeId);
  const r = redis();
  if (r) {
    try {
      if (!(await r.exists(k))) return;
      const next = await r.incrby(k, delta);
      if (next < 0) await r.del(k); // drift → delete, agla read dobara seed
      return;
    } catch { /* memory fallback */ }
  }
  const hit = mem.get(k);
  if (!hit || hit.expires <= Date.now()) return;
  hit.n += delta;
  if (hit.n < 0) mem.delete(k);
}

function resetUnreadCache(storeId) {
  if (storeId === undefined) { mem.clear(); return; }
  mem.delete(keyOf(storeId));
  const r = redis();
  if (r) r.del(keyOf(storeId)).catch(() => {});
}

module.exports = { getUnread, adjustUnread, resetUnreadCache, _mem: mem };
