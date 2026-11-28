// Admin options + FE debounce/socket waste follow-ups (§9.3/§9.4)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const request = require("supertest");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";
process.env.JWT_SA_ACCESS_SECRET = process.env.JWT_SA_ACCESS_SECRET || "test-sa-access-secret";

const app = require("../app");
const tokens = require("../utils/tokens");
const Store = require("../models/Store");
const Employee = require("../models/Employee");
const SuperAdmin = require("../models/SuperAdmin");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Plan = require("../models/Plan");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_opts_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();
const fe = (...parts) => path.join(__dirname, "..", "..", "frontend", "src", ...parts);

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `opts${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: storeId, store_name: "Opts Store", subdomain, store_status: "open", is_deleted: false,
  });
  const adminId = oid();
  await Employee.collection.insertOne({
    _id: adminId, storeId, name: "Owner", username: `oown${Date.now()}`,
    email: `oown${Date.now()}@example.com`, password: "x".repeat(60),
    role: "admin", status: "active", is_deleted: false, permissions: {},
  });
  const saId = oid();
  await SuperAdmin.collection.insertOne({
    _id: saId, name: "SA", email: `saopts${Date.now()}@example.com`,
    passwordHash: "x".repeat(60), role: "superadmin", status: "active",
  });
  const productId = oid();
  await Product.collection.insertOne({
    _id: productId, storeId, name: "Opts Product", status: "active", is_deleted: false,
  });
  await Variant.collection.insertOne({
    _id: oid(), storeId, product_id: productId, sku: "OPT-1", title: "Default",
    selling_price: 42, quantity: 5, status: "active", is_deleted: false,
    images: [{ img_url: "/opt.webp" }],
  });
  await Plan.collection.insertOne({
    _id: oid(), name: "Starter", slug: "starter", status: "active", sortOrder: 1,
    price: 0, billingInterval: "month", currency: "USD",
  });
  ctx = {
    storeId, productId, host: `${subdomain}.${ROOT}`,
    adminToken: tokens.signAccess("admin", { subjectId: adminId, role: "admin", storeId, sid: "t" }),
    saToken: tokens.signAccess("superadmin", { subjectId: saId, role: "superadmin", sid: "t" }),
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

test("GET /products/options returns slim rows", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/products/options?limit=20`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  const rows = res.body.data || [];
  assert.ok(rows.length >= 1);
  const row = rows.find((r) => String(r._id) === String(ctx.productId)) || rows[0];
  assert.ok(row._id && row.name);
  assert.equal(row.variants, undefined);
  assert.equal(row.description, undefined);
  assert.equal(typeof row.price, "number");
});

test("GET /super-admin/plans/options returns id/name/status", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/super-admin/plans/options`)
    .set("Host", ROOT)
    .set("X-Auth-Aud", "superadmin")
    .set("Authorization", `Bearer ${ctx.saToken}`);
  assert.equal(res.status, 200);
  const rows = res.body.data || [];
  assert.ok(rows.length >= 1);
  assert.ok(rows[0].name);
  assert.ok(rows[0].status);
  assert.equal(rows[0].limits, undefined);
  assert.equal(rows[0].features, undefined);
  assert.equal(rows[0].storeCount, undefined);
});

test("FE wires options, debounce, and drops Showcase (source)", () => {
  assert.match(fs.readFileSync(fe("apis", "admin", "productApi.js"), "utf8"), /\/products\/options/);
  assert.match(fs.readFileSync(fe("apis", "superadmin", "superAdminApi.js"), "utf8"), /\/super-admin\/plans\/options/);

  const banners = fs.readFileSync(fe("app", "admin", "banners", "page.js"), "utf8");
  assert.match(banners, /productApi\.getOptions/);
  assert.match(banners, /categoryApi\.getOptions/);
  assert.doesNotMatch(banners, /productApi\.getAll/);

  const deals = fs.readFileSync(fe("app", "admin", "deals", "page.js"), "utf8");
  assert.match(deals, /productApi\.getOptions/);
  assert.match(deals, /categoryApi\.getOptions/);

  const fields = fs.readFileSync(fe("app", "admin", "store-editor", "components", "fields.js"), "utf8");
  assert.match(fields, /adminProductApi\.getOptions/);
  assert.match(fields, /adminCategoryApi\.getOptions/);

  const storeForm = fs.readFileSync(fe("components", "superadmin", "StoreFormDialog.js"), "utf8");
  assert.match(storeForm, /listPlanOptions/);

  const quotes = fs.readFileSync(fe("app", "admin", "quotes", "new", "page.js"), "utf8");
  assert.match(quotes, /customerApi\.search/);
  assert.doesNotMatch(quotes, /customerApi\.getAll\(\{ limit: 500 \}\)/);

  const cart = fs.readFileSync(fe("app", "(user)", "cart", "page.js"), "utf8");
  assert.match(cart, /debouncedShipKey/);
  assert.match(cart, /setTimeout\(\(\) => setDebouncedShipKey/);

  const checkout = fs.readFileSync(fe("app", "(user)", "checkout", "page.js"), "utf8");
  assert.match(checkout, /debouncedShipKey/);

  const pos = fs.readFileSync(fe("app", "admin", "pos", "page.js"), "utf8");
  assert.match(pos, /debouncedProductSearch/);
  assert.match(pos, /debouncedCustomerSearch/);
  assert.match(pos, /debouncedHistorySearch/);

  const finance = fs.readFileSync(fe("app", "admin", "finance", "page.js"), "utf8");
  assert.match(finance, /debouncedSearch/);
  assert.match(finance, /search: debouncedSearch/);

  const dash = fs.readFileSync(fe("app", "admin", "dashboard", "page.js"), "utf8");
  assert.match(dash, /5000/);

  const chats = fs.readFileSync(fe("app", "admin", "chats", "page.js"), "utf8");
  assert.match(chats, /debouncedSearch/);

  const thread = fs.readFileSync(fe("components", "chat", "ChatThread.js"), "utf8");
  assert.match(thread, /setQueryData\(\["chat-messages"/);

  const brands = fs.readFileSync(fe("app", "admin", "brands", "page.js"), "utf8");
  assert.doesNotMatch(brands, /from "country-state-city"/);
  assert.match(brands, /import\(["']country-state-city["']\)/);
  assert.doesNotMatch(brands, /(?<!geo\?\.|geo\.)Country\.getAllCountries\(\)/);

  const productForm = fs.readFileSync(fe("components", "admin", "ProductFormModal.js"), "utf8");
  assert.doesNotMatch(productForm, /from "country-state-city"/);
  assert.match(productForm, /import\(["']country-state-city["']\)/);
  assert.match(productForm, /const \[geo, setGeo\]/);

  assert.equal(fs.existsSync(fe("components", "user", "Showcase.js")), false);
});
