// ==========================================================
// ONE-TIME TOKEN — "ye token pehli baar use ho raha hai?" (atomic)
// ----------------------------------------------------------
// Pehle store handoff ka jti in-memory Map me tha → backend restart ya dusre
// server par wahi sign-in link dobara chal jata tha.
//   1) Redis (REDIS_URL) → SET key 1 EX ttl NX  (atomic, saare servers share)
//   2) Redis na ho / error → MongoDB UsedToken (unique _id + TTL), wahi guarantee
// ==========================================================

const log = require("./logger");

/**
 * @param {string} purpose  e.g. "handoff"
 * @param {string} id       token ki unique id (jti)
 * @param {number} ttlSeconds token kitni der valid hai
 * @param {object} [deps]   tests: { redis, UsedToken }
 * @returns {Promise<boolean>} true = pehli baar (allow), false = dobara (reject)
 */
async function claimOnce(purpose, id, ttlSeconds, deps = {}) {
  if (!id) return false;
  const key = `${purpose}:${id}`;
  const ttl = Math.max(1, Math.ceil(Number(ttlSeconds) || 1));

  const redis = deps.redis !== undefined ? deps.redis : require("../middleware/rateLimit").getRedisClient();
  if (redis) {
    try {
      return (await redis.set(`onetime:${key}`, "1", "EX", ttl, "NX")) === "OK";
    } catch (error) {
      log.error("[oneTimeToken] Redis failed, falling back to MongoDB:", error.message);
    }
  }

  const UsedToken = deps.UsedToken || require("../models/UsedToken");
  try {
    await UsedToken.create({ _id: key, expiresAt: new Date(Date.now() + ttl * 1000) });
    return true;
  } catch (error) {
    if (error?.code === 11000) return false; // pehle se use ho chuka
    throw error;
  }
}

module.exports = { claimOnce };
