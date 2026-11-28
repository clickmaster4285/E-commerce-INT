// ======================================================
// PUBLIC-CACHE — expensive public GETs (§6.1)
// REDIS_URL → versioned Redis keys (multi-instance safe)
// warna in-memory Map (dev / single instance)
//
// Key: pc:{storeId}:{ns}:v{n}:{hash(url)}
// Invalidate = INCR pc:{storeId}:{ns}:v  (saari pehli keys miss)
// ======================================================

const crypto = require("crypto");
const { getStoreId } = require("./tenantContext");

const localStore = new Map(); // fallback
const MAX_ENTRIES = 500;
const now = () => Date.now();

const scopeOf = (storeId = getStoreId()) => (storeId ? String(storeId) : "platform");

function getRedis() {
  if (!String(process.env.REDIS_URL || "").trim()) return null;
  try {
    return require("../middleware/rateLimit").getRedisClient() || null;
  } catch {
    return null;
  }
}

function hashUrl(url) {
  return crypto.createHash("sha1").update(String(url || "")).digest("hex").slice(0, 16);
}

function nsFromUrl(url) {
  const { API_PREFIX } = require("../config/constants");
  const prefix = API_PREFIX;
  const path = String(url || "").split("?")[0];
  const rest = path.startsWith(prefix) ? path.slice(prefix.length) : path;
  const seg = rest.replace(/^\/+/, "").split("/")[0] || "root";
  return seg;
}

async function versionKey(storeId, ns) {
  return `pc:${scopeOf(storeId)}:${ns}:v`;
}

async function cacheKey(storeId, ns, url) {
  const redis = getRedis();
  let ver = "0";
  if (redis) {
    try {
      ver = String((await redis.get(await versionKey(storeId, ns))) || "0");
    } catch {
      ver = "0";
    }
  }
  return `pc:${scopeOf(storeId)}:${ns}:v${ver}:${hashUrl(url)}`;
}

function localKeyOf(req) {
  const storeId = req.store?._id || getStoreId();
  return `${scopeOf(storeId)}|${req.method} ${req.originalUrl || req.url}`;
}

function localSet(key, status, body) {
  if (localStore.size >= MAX_ENTRIES) {
    const oldest = localStore.keys().next().value;
    if (oldest) localStore.delete(oldest);
  }
  localStore.set(key, { t: now(), status, body });
}

function publicCache(ttlMs = 30 * 1000) {
  return async (req, res, next) => {
    if (req.method !== "GET") return next();
    const storeId = req.store?._id || getStoreId();
    const url = req.originalUrl || req.url;
    const ns = nsFromUrl(url);
    const redis = getRedis();
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));

    if (redis) {
      try {
        const key = await cacheKey(storeId, ns, url);
        const raw = await redis.get(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          res.set("X-Cache", "HIT");
          return res.status(parsed.status || 200).json(parsed.body);
        }
        const origJson = res.json.bind(res);
        res.json = (body) => {
          if (res.statusCode === 200) {
            redis.set(key, JSON.stringify({ status: 200, body }), "EX", ttlSec).catch(() => {});
          }
          return origJson(body);
        };
        res.set("X-Cache", "MISS");
        return next();
      } catch {
        // fall through to local
      }
    }

    const key = localKeyOf(req);
    const hit = localStore.get(key);
    if (hit && now() - hit.t < ttlMs) {
      res.set("X-Cache", "HIT");
      return res.status(hit.status).json(hit.body);
    }
    const origJson = res.json.bind(res);
    res.json = (body) => {
      try {
        if (res.statusCode === 200) localSet(key, 200, body);
      } catch (_) { /* ignore */ }
      return origJson(body);
    };
    res.set("X-Cache", "MISS");
    return next();
  };
}

function invalidate(namespaces) {
  const list = Array.isArray(namespaces) ? namespaces : [namespaces];
  const storeId = getStoreId();
  const redis = getRedis();

  if (redis) {
    const scopes = storeId ? [scopeOf(storeId)] : null;
    Promise.resolve()
      .then(async () => {
        for (const ns of list) {
          if (scopes) {
            await redis.incr(`pc:${scopes[0]}:${ns}:v`);
          } else {
            // platform / no context — bump common ns for all via pattern is expensive;
            // incr platform + rely on store-scoped invalidateOn from controllers
            await redis.incr(`pc:platform:${ns}:v`);
          }
        }
      })
      .catch(() => {});
  }

  // Always clear local process cache too
  const { API_PREFIX } = require("../config/constants");
  const prefix = API_PREFIX;
  const onlyScope = storeId ? `${scopeOf(storeId)}|` : null;
  for (const key of [...localStore.keys()]) {
    if (onlyScope && !key.startsWith(onlyScope)) continue;
    const request = key.slice(key.indexOf("|") + 1);
    if (list.some((ns) => {
      const base = `GET ${prefix}/${ns}`;
      return request === base || request.startsWith(`${base}?`) || request.startsWith(`${base}/`);
    })) {
      localStore.delete(key);
    }
  }
}

function keyOf(req) {
  return localKeyOf(req);
}

module.exports = { publicCache, invalidate, keyOf };
