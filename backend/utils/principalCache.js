// ==========================================================
// AUTH PRINCIPAL CACHE (§5.4) — Employee/User slim doc, 45s TTL
// ----------------------------------------------------------
// authMiddleware har request pe findById karta tha. Redis (ya memory)
// se 45s cache; employee/user status/permissions change par invalidate.
// ==========================================================
const TTL_SEC = 45;
const MAX_MEM = 5000;
const mem = new Map(); // key → { value, expires }

function redis() {
  if (!String(process.env.REDIS_URL || "").trim()) return null;
  try {
    return require("../middleware/rateLimit").getRedisClient() || null;
  } catch {
    return null;
  }
}

function keyOf(aud, id) {
  return `auth:principal:${aud}:${String(id)}`;
}

async function getPrincipal(aud, id, loader) {
  if (!id) return null;
  const k = keyOf(aud, id);
  const r = redis();
  if (r) {
    try {
      const raw = await r.get(k);
      if (raw) return JSON.parse(raw);
      const entity = await loader();
      if (entity) {
        await r.set(k, JSON.stringify(entity), "EX", TTL_SEC);
      }
      return entity;
    } catch {
      /* Redis down → memory */
    }
  }
  const hit = mem.get(k);
  if (hit && hit.expires > Date.now()) return hit.value;
  const entity = await loader();
  if (mem.size >= MAX_MEM) mem.delete(mem.keys().next().value);
  if (entity) mem.set(k, { value: entity, expires: Date.now() + TTL_SEC * 1000 });
  return entity;
}

function invalidatePrincipal(aud, id) {
  if (!id) return;
  const k = keyOf(aud, id);
  mem.delete(k);
  const r = redis();
  if (r) r.del(k).catch(() => {});
}

function invalidateEmployee(id) {
  invalidatePrincipal("admin", id);
}

function invalidateUser(id) {
  invalidatePrincipal("user", id);
}

module.exports = {
  getPrincipal,
  invalidatePrincipal,
  invalidateEmployee,
  invalidateUser,
  PRINCIPAL_TTL_SEC: TTL_SEC,
  _mem: mem,
};
