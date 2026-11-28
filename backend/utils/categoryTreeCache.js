// ==========================================================
// CATEGORY TREE CACHE (§4.4) — per-store Redis + memory, 60s
// ----------------------------------------------------------
// Public / options list pehle har request pe Category.find().
// Ab store-scoped cache; create/update/delete par invalidate.
// ==========================================================
const TTL_SEC = 60;
const MAX_MEM = 500;
const mem = new Map();

function redis() {
  if (!String(process.env.REDIS_URL || "").trim()) return null;
  try {
    return require("../middleware/rateLimit").getRedisClient() || null;
  } catch {
    return null;
  }
}

function keyOf(storeId, kind) {
  return `cat:tree:${String(storeId || "platform")}:${kind}`;
}

async function getTree(storeId, kind, loader) {
  const k = keyOf(storeId, kind);
  const r = redis();
  if (r) {
    try {
      const raw = await r.get(k);
      if (raw) return JSON.parse(raw);
      const data = await loader();
      await r.set(k, JSON.stringify(data), "EX", TTL_SEC);
      return data;
    } catch {
      /* memory fallback */
    }
  }
  const hit = mem.get(k);
  if (hit && hit.expires > Date.now()) return hit.value;
  const data = await loader();
  if (mem.size >= MAX_MEM) mem.delete(mem.keys().next().value);
  mem.set(k, { value: data, expires: Date.now() + TTL_SEC * 1000 });
  return data;
}

function invalidateTree(storeId) {
  const prefix = `cat:tree:${String(storeId || "platform")}:`;
  for (const k of [...mem.keys()]) {
    if (k.startsWith(prefix) || storeId == null) mem.delete(k);
  }
  if (storeId == null) mem.clear();
  const r = redis();
  if (!r) return;
  // Known kinds — short list, avoid KEYS scan
  for (const kind of ["public", "options"]) {
    r.del(keyOf(storeId, kind)).catch(() => {});
  }
}

module.exports = { getTree, invalidateTree, CATEGORY_TREE_TTL_SEC: TTL_SEC, _mem: mem };
