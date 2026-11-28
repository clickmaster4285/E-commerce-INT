// §6.1 cache foundations + §4.5 CRM hot paths (resolveStore bound, invalidateOn, wishlist atomic, translation single source)
process.env.ROOT_DOMAIN = "root.test";
process.env.API_PREFIX = "/api";
process.env.STORE_CACHE_MAX = "2"; // tiny bound taake eviction test me dikhe
process.env.LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || "http://127.0.0.1:5999";
process.env.LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY || "test-key";
// libreTranslate.js require time par ye env maangta hai — .env na ho to test defaults
for (const [k, v] of Object.entries({
  TRANSLATE_TIMEOUT_MS: "1000", TRANSLATE_MAX_RETRIES: "1", TRANSLATE_BATCH_SIZE: "10",
  TRANSLATE_RETRY_BASE_DELAY_MS: "10", TRANSLATE_SOURCE_LANG: "en", TRANSLATE_TARGET_LOCALES: "ur,ar",
})) process.env[k] = process.env[k] || v;

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");
const mongoose = require("mongoose");

const Store = require("../models/Store");
const rs = require("../middleware/resolveStore");
const { publicCache } = require("../utils/publicCache");
const { invalidateOn } = require("../middleware/invalidateOn");

const read = (...p) => fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

// ── A: resolveStore bounded cache ──
test("resolveStore cache stays within STORE_CACHE_MAX and uses slim projection", async () => {
  const calls = [];
  const orig = Store.findOne;
  Store.findOne = (filter, projection) => {
    calls.push(projection);
    return { lean: async () => ({ _id: new mongoose.Types.ObjectId(), subdomain: filter.subdomain }) };
  };
  try {
    rs.invalidateStoreCache();
    for (const sub of ["a1", "b1", "c1", "d1"]) await rs.resolveStoreByHost(`${sub}.root.test`);
    assert.ok(rs._cacheSize() <= 2, `cache size ${rs._cacheSize()} > 2`);
    assert.ok(calls.every((p) => typeof p === "string" && p.includes("subdomain") && !p.includes("activity")));

    // LRU: sabse purana (c1) nikla hoga, d1 abhi cache me → DB call nahi
    const before = calls.length;
    await rs.resolveStoreByHost("d1.root.test");
    assert.equal(calls.length, before, "recent host must be a cache hit");

    rs.invalidateStoreCache("d1.root.test");
    await rs.resolveStoreByHost("d1.root.test");
    assert.equal(calls.length, before + 1, "invalidated host re-fetches");
  } finally {
    Store.findOne = orig;
    rs.invalidateStoreCache();
  }
});

// ── B: invalidateOn registers finish hook, drops only after 2xx ──
function cachedGet(url) {
  const req = { method: "GET", originalUrl: url, store: null };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {},
      set(k, v) { this.headers[k] = v; return this; },
      status(c) { this.statusCode = c; return this; },
      json(body) { resolve(this.headers["X-Cache"]); return this; },
    };
    publicCache(60 * 1000)(req, res, () => res.json({ ok: 1 }));
  });
}

test("invalidateOn registers a finish hook and drops cache only after 2xx", async () => {
  const url = "/api/brands?t=inv1";
  assert.equal(await cachedGet(url), "MISS");
  assert.equal(await cachedGet(url), "HIT");

  const res = Object.assign(new EventEmitter(), { statusCode: 200 });
  let nexted = false;
  invalidateOn("brands")({ store: null }, res, () => { nexted = true; });
  assert.ok(nexted);
  assert.equal(res.listenerCount("finish"), 1, "finish hook registered");
  assert.equal(await cachedGet(url), "HIT", "must NOT drop before the controller finishes");

  res.statusCode = 500; // failed write → cache bachao
  res.emit("finish");
  assert.equal(await cachedGet(url), "HIT", "non-2xx keeps cache");

  const ok = Object.assign(new EventEmitter(), { statusCode: 201 });
  invalidateOn(["brands"])({ store: null }, ok, () => {});
  ok.emit("finish");
  assert.equal(await cachedGet(url), "MISS", "2xx finish drops namespace");
});

test("product/brand/category/banner routes use invalidateOn (no pre-controller drop)", () => {
  for (const f of ["productRoutes", "brandRoutes", "categoryRoutes", "bannerRoutes"]) {
    const src = read("routes", `${f}.js`);
    assert.match(src, /invalidateOn\(/, f);
    assert.doesNotMatch(src, /\(req, res, next\) => \{\s*invalidate\(/, f);
  }
});

// ── D: wishlist / checkout draft atomic ──
test("wishlist toggle + checkout drafts use atomic operators, not read-modify-save", () => {
  const src = read("controllers", "userController.js");
  const toggle = src.slice(src.indexOf("const toggleWishlist"), src.indexOf("// CHECKOUT DRAFTS"));
  assert.match(toggle, /\$addToSet/);
  assert.match(toggle, /\$pull/);
  assert.doesNotMatch(toggle, /\.save\(\)/);
  const update = src.slice(src.indexOf("const updateCheckoutDraft"), src.indexOf("const deleteCheckoutDraft"));
  assert.match(update, /drafts\.\$\./);
  assert.doesNotMatch(update, /\.save\(\)/);
  assert.match(src.slice(src.indexOf("const deleteCheckoutDraft")), /\$pull: \{ drafts:/);
});

// ── E: subscriber export streams ──
test("subscriber export streams via cursor", () => {
  const src = read("controllers", "subscriberController.js");
  const exp = src.slice(src.indexOf("exports.exportSubscribers"), src.indexOf("exports.updateSubscriber"));
  assert.match(exp, /\.cursor\(\)/);
  assert.match(exp, /res\.write\(/);
});

// ── F: theme draft_hash stored ──
test("theme stores draft_hash on write", () => {
  const src = read("controllers", "themeController.js");
  assert.match(src, /draft_hash: themeHash\(result\.data\)/);
  assert.match(read("models", "StoreTheme.js"), /draft_hash/);
});

// ── J: translation single source ──
test("TRANSLATABLE_FIELDS derives from CONTENT_FIELDS", () => {
  const { TRANSLATABLE_FIELDS } = require("../utils/translationService");
  const src = read("utils", "translationService.js");
  assert.match(src, /Object\.entries\(CONTENT_FIELDS\)/);
  assert.deepEqual(TRANSLATABLE_FIELDS.StorePage, ["title"]);
  assert.ok(TRANSLATABLE_FIELDS.Product.includes("name"));
  assert.equal(TRANSLATABLE_FIELDS.Customer, undefined);
});

test("Variant has tag_ids refs", () => {
  const Variant = require("../models/Variant");
  assert.ok(Variant.schema.path("tag_ids"));
});
