// Public GET cache (utils/publicCache.js) must never serve one store's response to another
process.env.API_PREFIX = "/api";

const test = require("node:test");
const assert = require("node:assert/strict");
const { publicCache, invalidate } = require("../utils/publicCache");
const { runWithStore } = require("../utils/tenantContext");

const STORE_A = "6affcafd86c732e1c90f74ec";
const STORE_B = "6afef2c9c05e45bb516dcd32";

// Middleware + "controller" (har store apne brands deta hai) ek saath chalao
function get(url, storeId, brandsByStore) {
  const req = { method: "GET", originalUrl: url, store: storeId ? { _id: storeId } : null };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      set(k, v) { this.headers[k] = v; return this; },
      status(c) { this.statusCode = c; return this; },
      json(body) { resolve({ cache: this.headers["X-Cache"], body }); return this; },
    };
    const run = () => publicCache(60 * 1000)(req, res, () => res.json({ data: brandsByStore[storeId || "platform"] }));
    storeId ? runWithStore(storeId, run) : run();
  });
}

const brands = { [STORE_A]: [], [STORE_B]: ["nike", "yo"], platform: ["?"] };

test("same URL on two stores: each store gets its own data (no cross-store HIT)", async () => {
  const url = "/api/brands?slim=1&t=1";
  const a1 = await get(url, STORE_A, brands);
  const b1 = await get(url, STORE_B, brands);
  assert.equal(a1.cache, "MISS");
  assert.equal(b1.cache, "MISS", "store B must not get store A's cached response");
  assert.deepEqual(b1.body.data, ["nike", "yo"]);
  const a2 = await get(url, STORE_A, brands);
  assert.equal(a2.cache, "HIT");
  assert.deepEqual(a2.body.data, []);
});

test("invalidate inside a store drops only that store's entries", async () => {
  const url = "/api/brands?slim=1&t=2";
  await get(url, STORE_A, brands);
  await get(url, STORE_B, brands);
  runWithStore(STORE_B, () => invalidate("brands"));
  assert.equal((await get(url, STORE_B, brands)).cache, "MISS");
  assert.equal((await get(url, STORE_A, brands)).cache, "HIT");
});

test("invalidate without a store (scripts / scheduler) drops every store", async () => {
  const url = "/api/banners/active?t=3";
  await get(url, STORE_A, brands);
  await get(url, STORE_B, brands);
  invalidate("banners");
  assert.equal((await get(url, STORE_A, brands)).cache, "MISS");
  assert.equal((await get(url, STORE_B, brands)).cache, "MISS");
});

test("other namespaces are untouched by invalidate", async () => {
  const url = "/api/deals/active?t=4";
  await get(url, STORE_A, brands);
  runWithStore(STORE_A, () => invalidate("brands"));
  assert.equal((await get(url, STORE_A, brands)).cache, "HIT");
});

test("Redis version keys: INCR bumps namespace so next GET misses", async () => {
  const kv = new Map();
  const redis = {
    get: async (k) => (kv.has(k) ? kv.get(k) : null),
    set: async (k, v, ..._rest) => { kv.set(k, v); return "OK"; },
    incr: async (k) => {
      const n = Number(kv.get(k) || 0) + 1;
      kv.set(k, String(n));
      return n;
    },
  };

  const {
    publicCache: pc,
    invalidate: inv,
    cacheKey,
    versionKey,
    _setRedisForTests,
  } = require("../utils/publicCache");
  _setRedisForTests(redis);

  const url = "/api/brands?slim=1&t=redis-v";
  const storeId = STORE_A;

  const hitOnce = () =>
    new Promise((resolve) => {
      const req = { method: "GET", originalUrl: url, store: { _id: storeId } };
      const res = {
        statusCode: 200,
        headers: {},
        set(k, v) { this.headers[k] = v; return this; },
        status(c) { this.statusCode = c; return this; },
        json(body) { resolve({ cache: this.headers["X-Cache"], body }); return this; },
      };
      runWithStore(storeId, () => pc(60 * 1000)(req, res, () => res.json({ data: ["a"] })));
    });

  try {
    assert.equal((await hitOnce()).cache, "MISS");
    assert.equal((await hitOnce()).cache, "HIT");
    const v0 = await redis.get(await versionKey(storeId, "brands"));
    runWithStore(storeId, () => inv("brands"));
    await new Promise((r) => setImmediate(r));
    const v1 = await redis.get(await versionKey(storeId, "brands"));
    assert.notEqual(String(v1 || "0"), String(v0 || "0"));
    const keyAfter = await cacheKey(storeId, "brands", url);
    assert.match(keyAfter, /:v\d+:/);
    assert.equal((await hitOnce()).cache, "MISS");
  } finally {
    _setRedisForTests(null);
  }
});
