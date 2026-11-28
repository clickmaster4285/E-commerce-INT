// Storefront DTO leaks + legacy list caps + tenantScope index:false + purgeStore
// (optimizeplan.md §4.5, §9.2, §3.3, §3.7)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const request = require("supertest");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";
process.env.JWT_USER_ACCESS_SECRET = process.env.JWT_USER_ACCESS_SECRET || "test-user-access-secret";

const app = require("../app");
const tokens = require("../utils/tokens");
const { legacyCap } = require("../utils/legacyListCap");
const Store = require("../models/Store");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Discount = require("../models/Discount");
const Review = require("../models/Review");
const Order = require("../models/Order");
const Category = require("../models/Category");
const Address = require("../models/Address");
const Wishlist = require("../models/Wishlist");
const ShippingConfig = require("../models/ShippingConfig");
const ShippingMethod = require("../models/ShippingMethod");
const Lead = require("../models/Lead");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_sf_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `sf${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: storeId, store_name: "SF Store", subdomain, store_status: "open", is_deleted: false,
    activity: [{ action: "secret" }], planId: oid(),
    logo: { img_url: "/uploads/logo.webp", public_id: "secret-cloud" },
    domainVerifyToken: "verify-secret",
    quote_terms: "hidden terms", invoice_terms: "hidden invoice",
  });
  const adminId = oid();
  await Employee.collection.insertOne({
    _id: adminId, storeId, name: "Owner", username: `sfown${Date.now()}`,
    email: `sfown${Date.now()}@example.com`, password: "x".repeat(60),
    role: "admin", status: "active", is_deleted: false, permissions: {},
  });
  const userId = oid();
  await User.collection.insertOne({
    _id: userId, storeId, name: "Shopper", username: `sfuser${Date.now()}`,
    email: `sfuser${Date.now()}@example.com`, password: "x".repeat(60),
    status: "active", is_deleted: false,
  });
  const categoryId = oid();
  await Category.collection.insertOne({
    _id: categoryId, storeId, category_code: "SF-C1", name: "Gear", is_deleted: false,
  });
  const productId = oid();
  await Product.collection.insertOne({
    _id: productId, storeId, name: "Public Mug", category_id: categoryId,
    status: "active", is_deleted: false, createdby: adminId, updatedby: adminId,
  });
  await Variant.collection.insertOne({
    _id: oid(), storeId, product_id: productId, sku: "MUG-1", title: "Default",
    selling_price: 250, cost_price: 99, quantity: 10, min_qnt: 1, max_qnt: 99, topup: 5,
    status: "active", is_deleted: false, createdby: adminId, updatedby: adminId,
  });
  await Discount.collection.insertOne({
    _id: oid(), storeId, name: "Flash", code: "SECRET10", type: "percentage", value: 10,
    applyTo: "all", isActive: true, status: "active", is_deleted: false,
    startDate: new Date(Date.now() - 864e5), endDate: new Date(Date.now() + 864e5),
    usageLimit: 100, perUserLimit: 1, minOrderValue: 500, priority: 1,
  });
  await Review.collection.insertOne({
    _id: oid(), storeId, product_id: productId, user_id: userId,
    rating: 5, title: "Great", comment: "Nice mug", status: "active", is_deleted: false,
    storeResponse: { message: "Thanks!", responded_at: new Date(), responded_by_name: "Staff Secret" },
  });
  // Seed many orders to prove legacy cap
  const orderDocs = Array.from({ length: 60 }, (_, i) => ({
    _id: oid(), storeId, user_id: userId, order_number: `ORD-SF-${i}`,
    status: "pending", total: 10 + i, items: [], created_at: new Date(Date.now() - i * 1000),
  }));
  await Order.collection.insertMany(orderDocs);

  ctx = {
    storeId, productId, userId, host: `${subdomain}.${ROOT}`,
    adminToken: tokens.signAccess("admin", { subjectId: adminId, role: "admin", storeId, sid: "t" }),
    userToken: tokens.signAccess("user", { subjectId: userId, role: "user", storeId, sid: "t" }),
  };
});

test.after(async () => {
  if (mongoose.connection.readyState === 1) {
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init().catch(() => {})));
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
  setImmediate(() => process.exit(0));
});

test("legacyCap defaults to 50 and clamps requested values", () => {
  assert.equal(legacyCap(undefined, 50), 50);
  assert.equal(legacyCap(0, 50), 50);
  assert.equal(legacyCap(10, 50), 10);
  assert.equal(legacyCap(999, 50), 50);
});

test("tenantScope index:false on models with compound storeId indexes", () => {
  for (const Model of [Address, Wishlist, ShippingMethod, ShippingConfig]) {
    const storePath = Model.schema.path("storeId");
    assert.ok(storePath, `${Model.modelName}.storeId`);
    // Plugin should not have left a plain single-field index:true on the path
    assert.equal(storePath.options.index, false, `${Model.modelName}.storeId index`);
  }
});

test("purgeStore.js exists and requires soft-deleted store", () => {
  const src = fs.readFileSync(path.join(__dirname, "../scripts/purgeStore.js"), "utf8");
  assert.match(src, /is_deleted/);
  assert.match(src, /--apply/);
  assert.match(src, /UPLOAD_ROOT|uploads/);
  assert.match(src, /\$tenantScopeField/);
});

test("GET /store/public omits activity, planId, public_id, terms, domainVerifyToken", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app).get(`${API}/store/public`).set("Host", ctx.host);
  assert.equal(res.status, 200);
  const data = res.body.data;
  assert.equal(data.store_name, "SF Store");
  assert.equal(data.activity, undefined);
  assert.equal(data.planId, undefined);
  assert.equal(data.domainVerifyToken, undefined);
  assert.equal(data.quote_terms, undefined);
  assert.equal(data.invoice_terms, undefined);
  assert.equal(data.__v, undefined);
  if (data.logo) assert.equal(data.logo.public_id, undefined);
});

test("GET /discounts/public omits code, usageLimit, perUserLimit, minOrderValue", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app).get(`${API}/discounts/public`).set("Host", ctx.host);
  assert.equal(res.status, 200);
  const rows = res.body.data || [];
  assert.ok(rows.length >= 1);
  for (const d of rows) {
    assert.equal(d.code, undefined);
    assert.equal(d.usageLimit, undefined);
    assert.equal(d.perUserLimit, undefined);
    assert.equal(d.minOrderValue, undefined);
    assert.ok(d.name);
    assert.ok(d.type);
  }
});

test("GET /reviews/product/:id uses ReviewItem DTO (no raw user_id / responder name)", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/reviews/product/${ctx.productId}`)
    .set("Host", ctx.host);
  assert.equal(res.status, 200);
  const reviews = res.body.reviews || [];
  assert.ok(reviews.length >= 1);
  const r = reviews[0];
  assert.equal(r.user_id, undefined);
  assert.ok(r.user?.name);
  assert.equal(r.storeResponse?.responded_by_name, undefined);
  assert.ok(r.storeResponse?.message);
});

test("GET /products (public) never returns cost_price or staff emails", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/products?limit=10`)
    .set("Host", ctx.host);
  assert.equal(res.status, 200);
  const products = res.body.products || res.body;
  assert.ok(Array.isArray(products) && products.length >= 1);
  const p = products.find((row) => String(row._id) === String(ctx.productId)) || products[0];
  assert.equal(p.createdby, undefined);
  assert.equal(p.updatedby, undefined);
  for (const v of p.variants || []) {
    assert.equal(v.cost_price, undefined);
    assert.equal(v.min_qnt, undefined);
    assert.equal(v.max_qnt, undefined);
    assert.equal(v.topup, undefined);
    assert.ok(v.selling_price != null);
  }
});

test("GET /orders/my legacy mode hard-caps at 50", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/orders/my`)
    .set("Host", ctx.host)
    .set("Authorization", `Bearer ${ctx.userToken}`)
    .set("X-Auth-Aud", "user");
  assert.equal(res.status, 200);
  const data = res.body.data || res.body;
  assert.ok(Array.isArray(data));
  assert.ok(data.length <= 50);
  assert.equal(data.length, 50);
});

test("leadController no longer embeds customer_history", () => {
  const src = fs.readFileSync(path.join(__dirname, "../controllers/leadController.js"), "utf8");
  assert.doesNotMatch(src, /customer_history\s*:/);
  assert.match(src, /customer_history.*removed|removed.*customer_history/i);
});

test("legacy list controllers call legacyCap", () => {
  const files = [
    "orderController.js", "discountController.js", "dealController.js",
    "quoteController.js", "invoiceController.js", "vendorController.js",
    "variantController.js", "categoryController.js", "shippingController.js",
    "posController.js", "reviewController.js", "chatController.js",
    "customerController.js",
  ];
  for (const file of files) {
    const src = fs.readFileSync(path.join(__dirname, "../controllers", file), "utf8");
    assert.match(src, /legacyCap/, `${file} should use legacyCap`);
  }
});
