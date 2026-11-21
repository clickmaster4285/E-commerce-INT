// resolveStore middleware — platform host lockdown + x-store-host secret
// DB ki zaroorat nahi: Store.findOne ko stub kiya gaya hai.
process.env.ROOT_DOMAIN = "root.test";
process.env.INTERNAL_PROXY_SECRET = "s3cret-for-tests";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Store = require("../models/Store");
const { resolveStore, clearStoreHostCache } = require("../middleware/resolveStore");
const { getStoreId } = require("../utils/tenantContext");

const STORE_A = { _id: new mongoose.Types.ObjectId(), subdomain: "alpha", store_name: "Alpha" };

Store.findOne = (filter) => ({
  lean: async () => (filter?.subdomain === "alpha" ? STORE_A : null),
});

function run(host, path, headers = {}) {
  clearStoreHostCache();
  const req = { headers: { host, ...headers }, path };
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ blocked: true, status: this.statusCode, body, req }); },
    };
    resolveStore(req, res, (err) => {
      if (err) return reject(err);
      resolve({ blocked: false, req, storeId: getStoreId() });
    });
  });
}

test("platform host: store-owned APIs are blocked with STORE_REQUIRED", async () => {
  for (const path of ["/products", "/orders", "/customers", "/store", "/store/public", "/users/me", "/dashboard/stats", "/seller/dashboard"]) {
    const r = await run("root.test:5000", path);
    assert.equal(r.blocked, true, path);
    assert.equal(r.status, 404, path);
    assert.equal(r.body.code, "STORE_REQUIRED", path);
  }
});

test("platform host: platform APIs stay open and unscoped", async () => {
  for (const path of [
    "/health", "/store/resolve", "/store/check-subdomain",
    "/users/register", "/users/admin/login", "/users/admin/handoff", "/users/logout",
    "/super-admin/auth/login", "/super-admin/stores", "/seller/apply", "/seller/apply/setup",
  ]) {
    const r = await run("root.test", path);
    assert.equal(r.blocked, false, path);
    assert.equal(r.storeId, null, path);
  }
});

test("store host: request runs inside that store's context", async () => {
  const r = await run("alpha.root.test:5000", "/products");
  assert.equal(r.blocked, false);
  assert.equal(r.storeId, String(STORE_A._id));
});

test("store host: super-admin API is hidden", async () => {
  const r = await run("alpha.root.test", "/super-admin/stores");
  assert.equal(r.blocked, true);
  assert.equal(r.status, 404);
});

test("unknown store subdomain → STORE_NOT_FOUND", async () => {
  const r = await run("nope.root.test", "/products");
  assert.equal(r.status, 404);
  assert.equal(r.body.code, "STORE_NOT_FOUND");
});

test("x-store-host WITHOUT the internal secret is ignored", async () => {
  const r = await run("root.test", "/products", { "x-store-host": "alpha.root.test" });
  assert.equal(r.blocked, true);
  assert.equal(r.body.code, "STORE_REQUIRED");
});

test("x-store-host with a WRONG secret is ignored", async () => {
  const r = await run("root.test", "/products", { "x-store-host": "alpha.root.test", "x-internal-proxy-secret": "nope" });
  assert.equal(r.body.code, "STORE_REQUIRED");
});

test("x-store-host with the correct secret selects that store", async () => {
  const r = await run("root.test", "/banners/active", {
    "x-store-host": "alpha.root.test",
    "x-internal-proxy-secret": "s3cret-for-tests",
  });
  assert.equal(r.blocked, false);
  assert.equal(r.storeId, String(STORE_A._id));
});

test("x-store-host is never honoured on a store host (can't hop to another store)", async () => {
  const r = await run("nope.root.test", "/products", {
    "x-store-host": "alpha.root.test",
    "x-internal-proxy-secret": "s3cret-for-tests",
  });
  assert.equal(r.body.code, "STORE_NOT_FOUND");
});
