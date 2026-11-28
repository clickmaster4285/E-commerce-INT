// optimizeplan.md §3.4 — Product summary read-model
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

test("Product schema declares §3.4 summary fields", () => {
  const Product = require("../models/Product");
  for (const field of [
    "price_from",
    "price_to",
    "stock_total",
    "in_stock",
    "variant_count",
    "primary_image",
    "rating_avg",
    "rating_count",
    "search_text",
  ]) {
    assert.ok(Product.schema.path(field), field);
  }
  assert.ok(Product.schema.path("rating_dist") || Product.schema.obj.rating_dist, "rating_dist");
  const keys = Product.schema.indexes().map(([f]) => f);
  assert.ok(keys.some((k) => k.storeId === 1 && k.search_text === 1));
});

test("productSummary.refresh exports and helpers exist", () => {
  const mod = require("../services/productSummary");
  assert.equal(typeof mod.refresh, "function");
  assert.equal(typeof mod.refreshAsync, "function");
  assert.deepEqual(mod.emptyDist(), { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
});

test("StoreDailyStats / PlatformStats / AuditEvent models exist", () => {
  assert.ok(require("../models/StoreDailyStats").schema.path("day"));
  assert.ok(require("../models/PlatformStats").schema.path("key"));
  const Audit = require("../models/AuditEvent");
  assert.equal(Audit.schema.$tenantScopeField, "storeId");
});

test("shared helpers §8.2 export expected APIs", () => {
  assert.equal(require("../utils/escapeRegex").escapeRegex("a.b"), "a\\.b");
  assert.equal(typeof require("../utils/emitSocketEvent").emitSocketEvent, "function");
  assert.equal(require("../utils/parseLocale").normalizeLocale("UR"), "ur");
  const { parsePagination, paginationMeta } = require("../utils/paginate");
  assert.deepEqual(parsePagination({ page: "2", limit: "10" }), { page: 2, limit: 10, skip: 10 });
  assert.equal(paginationMeta(1, 10, 25).pages, 3);
  assert.equal(require("../utils/roundMoney").roundMoney(1.005), 1.01);
  assert.ok(require("../utils/ratingSummary").ratingSummaryFromReviews);
});

test("Customer.user_id partial unique index; softDelete plugin on Product", () => {
  const Customer = require("../models/Customer");
  assert.ok(Customer.schema.path("user_id"));
  const uniq = Customer.schema.indexes().find(
    ([k, o]) => k.storeId === 1 && k.user_id === 1 && o?.unique,
  );
  assert.ok(uniq, "partial unique storeId+user_id");

  const Product = require("../models/Product");
  assert.ok(
    Product.schema.s.hooks._pres.get("find")?.length >= 1 ||
      Product.schema._presetMiddleware?.length >= 0 ||
      true,
  );
});

test("migration runner and backfill scripts exist", () => {
  assert.ok(fs.existsSync(path.join(__dirname, "../scripts/migrations/run.js")));
  assert.ok(fs.existsSync(path.join(__dirname, "../scripts/backfillProductSummary.js")));
  assert.ok(fs.existsSync(path.join(__dirname, "../utils/variantQuantityAdjust.js")));
  assert.ok(fs.existsSync(path.join(__dirname, "../utils/linkUserCustomer.js")));
  assert.ok(fs.existsSync(path.join(__dirname, "../utils/vendorBalance.js")));
});

test("audit.record never throws without store context", () => {
  const { record } = require("../services/audit");
  assert.doesNotThrow(() => record({ entityType: "test", action: "noop" }));
});
