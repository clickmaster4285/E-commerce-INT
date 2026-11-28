// ==========================================================
// SCHEDULER LEADER LOCK (optimizeplan.md §6.2)
// ----------------------------------------------------------
// Multi-instance deploy me har server par cron chalta hai → banner / theme / cleanup
// job N baar chalti thi. Ab har tick se pehle Redis lock:
//   SET lock:scheduler:<name> <token> NX PX 55000
// Jo instance lock le le wahi kaam kare, baaki skip. TTL 55s < 1 minute tick, is liye
// leader crash ho to agla tick koi aur utha leta hai.
// REDIS_URL na ho (single instance) → lock hamesha mil jata hai, behavior pehle jaisa.
// Redis error → fail-open (kaam chalao): scheduler jobs idempotent hain, skip karna zyada nuqsan deta hai.
// ==========================================================

const crypto = require("crypto");
const log = require("./logger");

const DEFAULT_TTL_MS = 55000;
const INSTANCE_ID = crypto.randomBytes(6).toString("hex");

const getRedis = () => {
  if (!String(process.env.REDIS_URL || "").trim()) return null;
  try { return require("../middleware/rateLimit").getRedisClient() || null; } catch { return null; }
};

/**
 * @param {string} name  e.g. "banner"
 * @param {object} [opts] { ttlMs, redis } (tests: redis inject)
 * @returns {Promise<boolean>} true = kaam karo, false = skip (dusra instance leader hai)
 */
async function acquireLeaderLock(name, opts = {}) {
  const redis = opts.redis !== undefined ? opts.redis : getRedis();
  if (!redis) return true; // Redis nahi → single instance
  const ttl = Math.max(1000, Number(opts.ttlMs) || DEFAULT_TTL_MS);
  try {
    return (await redis.set(`lock:scheduler:${name}`, INSTANCE_ID, "PX", ttl, "NX")) === "OK";
  } catch (error) {
    log.warn(`[leaderLock] ${name}: Redis error, running anyway: ${error.message}`);
    return true;
  }
}

/** Lock mile to fn() chalao, warna null (skip). */
async function withLeaderLock(name, fn, opts = {}) {
  if (!(await acquireLeaderLock(name, opts))) return null;
  return fn();
}

module.exports = { acquireLeaderLock, withLeaderLock, INSTANCE_ID, DEFAULT_TTL_MS };
