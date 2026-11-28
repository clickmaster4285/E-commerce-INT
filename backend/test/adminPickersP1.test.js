// Admin pickers / options + product admin split + POS Mongo filter (§9.3)
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
const Store = require("../models/Store");
const Employee = require("../models/Employee");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Vendor = require("../models/Vendor");
const User = require("../models/User");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_pickers_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();
const fe = (...parts) => path.join(__dirname, "..", "..", "frontend", "src", ...parts);

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `pick${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: storeId, store_name: "Picker Store", subdomain, store_status: "open", is_deleted: false,
  });
  const adminId = oid();
  await Employee.collection.insertOne({
    _id: adminId, storeId, name: "Owner", username: `pown${Date.now()}`,
    email: `pown${Date.now()}@example.com`, password: "x".repeat(60),
    role: "admin", status: "active", is_deleted: false, permissions: {},
  });
  await Employee.collection.insertOne({
    _id: oid(), storeId, name: "Clerk", username: `clerk${Date.now()}`,
    email: `clerk${Date.now()}@example.com`, password: "x".repeat(60),
    role: "staff", status: "active", is_deleted: false, permissions: { employees: true },
  });
  const userId = oid();
  await User.collection.insertOne({
    _id: userId, storeId, name: "Shopper", username: `shop${Date.now()}`,
    email: `shop${Date.now()}@example.com`, password: "x".repeat(60),
    status: "active", is_deleted: false,
  });
  const productId = oid();
  await Product.collection.insertOne({
    _id: productId, storeId, name: "Picker Widget", status: "active", is_deleted: false,
    cost_price: 99, createdby: adminId,
  });
  await Variant.collection.insertOne({
    _id: oid(), storeId, product_id: productId, sku: "PK-SKU-1", title: "Default",
    selling_price: 150, cost_price: 80, quantity: 12, status: "active", is_deleted: false,
    images: [{ img_url: "/a.webp" }],
  });
  await Vendor.collection.insertOne({
    _id: oid(), storeId, vendor_code: "V-PK", name: "Acme Vendor", company_name: "Acme",
    is_deleted: false, is_active: true,
    bank_details: { bank: "HBL", account_no: "SECRET123", account_title: "Acme" },
  });
  ctx = {
    storeId, productId, host: `${subdomain}.${ROOT}`,
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

test("GET /variants/picker returns slim rows without cost_price", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/variants/picker?limit=20`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  const rows = res.body.data || [];
  assert.ok(rows.length >= 1);
  const row = rows.find((r) => r.sku === "PK-SKU-1") || rows[0];
  assert.ok(row._id && row.sku);
  assert.equal(row.cost_price, undefined);
  assert.equal(row.translations, undefined);
  assert.equal(row.createdby, undefined);
  assert.ok(row.product === null || (row.product && row.product._id));
});

test("GET /vendors/options omits bank_details", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/vendors/options?limit=20`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  const rows = res.body.data || [];
  assert.ok(rows.length >= 1);
  assert.ok(rows[0]._id && rows[0].name);
  assert.equal(rows[0].bank_details, undefined);
  assert.equal(rows[0].email, undefined);
});

test("GET /employees/options returns name/role only", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/employees/options?limit=20`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  const rows = res.body.data || [];
  assert.ok(rows.length >= 1);
  for (const row of rows) {
    assert.ok(row._id && row.name);
    assert.equal(row.email, undefined);
    assert.equal(row.phone, undefined);
    assert.equal(row.password, undefined);
  }
});

test("GET /products/admin/:id requires admin auth", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const denied = await request(app)
    .get(`${API}/products/admin/${ctx.productId}`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "user")
    .set("Authorization", `Bearer ${ctx.userToken}`);
  assert.ok([401, 403].includes(denied.status));

  const ok = await request(app)
    .get(`${API}/products/admin/${ctx.productId}`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(ok.status, 200);
});

test("GET /pos/products filters in Mongo (source) and returns page", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const src = fs.readFileSync(path.join(__dirname, "../controllers/posController.js"), "utf8");
  // POS search: Product.search_text / name prefix + Variant sku/title, capped in Mongo
  assert.match(src, /search_text:\s*prefix/);
  assert.match(src, /SEARCH_CAP/);


  const res = await request(app)
    .get(`${API}/pos/products?page=1&limit=10&search=Picker`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.pagination);
});

test("FE wires pickers/options and drops heavy loads (source)", () => {
  assert.match(fs.readFileSync(fe("apis", "admin", "variantApi.js"), "utf8"), /\/variants\/picker/);
  assert.match(fs.readFileSync(fe("apis", "admin", "vendorApi.js"), "utf8"), /\/vendors\/options/);
  assert.match(fs.readFileSync(fe("apis", "admin", "employeeApi.js"), "utf8"), /\/employees\/options/);
  assert.match(fs.readFileSync(fe("apis", "admin", "productApi.js"), "utf8"), /\/products\/admin\/\$\{id\}/);

  const quotesNew = fs.readFileSync(fe("app", "admin", "quotes", "new", "page.js"), "utf8");
  assert.match(quotesNew, /variantApi\.getPicker/);
  assert.doesNotMatch(quotesNew, /variantApi\.getAll\(\)/);

  const invoicesNew = fs.readFileSync(fe("app", "admin", "invoices", "new", "page.js"), "utf8");
  assert.match(invoicesNew, /variantApi\.getPicker/);
  assert.doesNotMatch(invoicesNew, /variantApi\.getAll/);

  const quoteDetail = fs.readFileSync(fe("app", "admin", "quotes", "[id]", "page.js"), "utf8");
  assert.doesNotMatch(quoteDetail, /variantApi\.getAll/);

  const poNew = fs.readFileSync(fe("app", "admin", "purchase-orders", "new", "page.js"), "utf8");
  assert.match(poNew, /vendorApi\.getOptions/);

  const leads = fs.readFileSync(fe("app", "admin", "leads", "page.js"), "utf8");
  assert.match(leads, /employeeApi\.getOptions/);

  const socketSync = fs.readFileSync(fe("hooks", "admin", "useProductSocketSync.js"), "utf8");
  assert.match(socketSync, /Narrow keys only/);
  assert.doesNotMatch(socketSync, /queryKey: \["brands"\]/);

  const cart = fs.readFileSync(fe("app", "(user)", "cart", "page.js"), "utf8");
  assert.doesNotMatch(cart, /Math\.round\(totals\.subtotal\)/);

  const bundle = fs.readFileSync(fe("components", "user", "BundleCard.js"), "utf8");
  assert.match(bundle, /slim:\s*1/);

  const dealApi = fs.readFileSync(fe("apis", "user", "dealApi.js"), "utf8");
  assert.doesNotMatch(dealApi, /getActivePaginated/);

  const orderDetail = fs.readFileSync(fe("app", "(user)", "orders", "[id]", "page.js"), "utf8");
  assert.doesNotMatch(orderDetail, /from "country-state-city"/);
  assert.match(orderDetail, /import\("country-state-city"\)/);

  const storeInfo = fs.readFileSync(fe("app", "admin", "store-info", "page.js"), "utf8");
  assert.doesNotMatch(storeInfo, /from "country-state-city"/);
  assert.match(storeInfo, /import\("country-state-city"\)/);

  const vendorModal = fs.readFileSync(fe("components", "admin", "VendorFormModal.js"), "utf8");
  assert.doesNotMatch(vendorModal, /from "country-state-city"/);
  assert.match(vendorModal, /import\("country-state-city"\)/);

  const cats = fs.readFileSync(fe("app", "admin", "categories", "page.js"), "utf8");
  assert.doesNotMatch(cats, /staleTime:\s*0/);

  const attrs = fs.readFileSync(fe("app", "admin", "attributes", "page.js"), "utf8");
  assert.doesNotMatch(attrs, /staleTime:\s*0/);
});
