// Admin list/detail payload trims (§9.3) — leads, PO, POS, quotes, invoices,
// SA stores/team, brands options, theme saveDraft, no customer list write-on-read.
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
const Brand = require("../models/Brand");
const Lead = require("../models/Lead");
const Quote = require("../models/Quote");
const Invoice = require("../models/Invoice");
const PosSale = require("../models/PosSale");
const PurchaseOrder = require("../models/PurchaseOrder");
const Vendor = require("../models/Vendor");
const Customer = require("../models/Customer");
const StoreTheme = require("../models/StoreTheme");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_adminp1_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `adp1${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: storeId, store_name: "Admin P1", subdomain, store_status: "open", is_deleted: false,
    email: "store@example.com", phone: "0300", city: "Lahore", country: "PK",
    activity: [{ action: "noise" }], domainVerifyToken: "secret",
    logo: { img_url: "/logo.webp", public_id: "cloud" },
  });
  const adminId = oid();
  await Employee.collection.insertOne({
    _id: adminId, storeId, name: "Owner", username: `adp1${Date.now()}`,
    email: `adp1${Date.now()}@example.com`, password: "x".repeat(60),
    role: "admin", status: "active", is_deleted: false, permissions: {},
  });
  const saId = oid();
  await SuperAdmin.collection.insertOne({
    _id: saId, name: "SA", email: `sa${Date.now()}@example.com`,
    passwordHash: "x".repeat(60), role: "superadmin", status: "active",
  });
  const staffId = oid();
  await SuperAdmin.collection.insertOne({
    _id: staffId, name: "Staff", email: `staff${Date.now()}@example.com`,
    passwordHash: "x".repeat(60), role: "staff", status: "active",
    activities: Array.from({ length: 5 }, (_, i) => ({ action: `a${i}`, category: "System", timestamp: new Date() })),
  });
  await Brand.collection.insertOne({
    _id: oid(), storeId, brand_code: "BR-OPT", name: "OptBrand", is_active: true, is_deleted: false,
  });
  await Lead.collection.insertOne({
    _id: oid(), storeId, name: "Lead One", phone: "03001234567", lead_type: "Individual",
    status: "New", lead_number: "L-1", is_deleted: false,
    activities: [{ type: "Call", notes: "secret" }],
    history: [{ action: "created", summary: "created" }],
  });
  await Quote.collection.insertOne({
    _id: oid(), storeId, quote_number: "Q-1", customer_name: "Ali", customer_type: "individual",
    total: 100, status: "Draft", is_deleted: false, quote_date: new Date(),
    translations: { customer_name: { ur: "علی", ar: "علي" } },
  });
  await Invoice.collection.insertOne({
    _id: oid(), storeId, invoice_number: "INV-1", customer_name: "Ali", customer_phone: "1",
    total: 100, status: "Unpaid", is_deleted: false, invoice_date: new Date(), due_date: new Date(),
    amount_paid: 0, remaining_balance: 100,
    translations: { customer_name: { ur: "علی" } },
    translation_source: { customer_name: "hash" },
    translation_status: { customer_name: "done" },
  });
  const pid = oid();
  const vid = oid();
  await PosSale.collection.insertOne({
    _id: oid(), storeId, sale_number: "POS-1", total: 50, subtotal: 50, status: "completed",
    payment: { method: "cash", status: "paid" }, cashier_name: "Owner",
    items: Array.from({ length: 6 }, (_, i) => ({
      product_id: pid, variant_id: vid, product_name: `Item ${i}`, quantity: 1,
      unit_price: 10, line_total: 10, product_image: "", variant_title: "", sku: `SKU-${i}`,
    })),
    edit_history: [
      { edited_at: new Date(Date.now() - 1000), edited_by_name: "A", changes: [] },
      { edited_at: new Date(), edited_by_name: "B", changes: [] },
    ],
    created_at: new Date(),
  });
  const vendorId = oid();
  await Vendor.collection.insertOne({
    _id: vendorId, storeId, vendor_code: "V-1", name: "Vendor", is_deleted: false, is_active: true,
  });
  await PurchaseOrder.collection.insertOne({
    _id: oid(), storeId, vendor_id: vendorId, po_number: "PO-1", status: "pending",
    payment_status: "unpaid", total: 200, is_deleted: false, items: [{ qty_ordered: 2, received_qty: 0 }],
    created_at: new Date(),
  });
  await Customer.collection.insertOne({
    _id: oid(), storeId, name: "Cust", phone: "03001112233", is_deleted: false,
  });
  await StoreTheme.collection.insertOne({
    storeId, draft: { version: 1 }, published: { version: 1 }, draftRevision: 1, publishedVersion: 1,
  });

  ctx = {
    storeId, vendorId, staffId, host: `${subdomain}.${ROOT}`,
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

test("customer list controller no longer write-syncs leads on GET", () => {
  const src = fs.readFileSync(path.join(__dirname, "../controllers/customerController.js"), "utf8");
  assert.match(src, /No write-on-read syncLeadCustomer/);
  assert.doesNotMatch(src, /for \(const lead of convertedLeads\)/);
});

test("theme saveDraft response omits full draft echo", () => {
  const src = fs.readFileSync(path.join(__dirname, "../controllers/themeController.js"), "utf8");
  assert.match(src, /draftRevision: doc\.draftRevision/);
  assert.match(src, /draft_hash/);
  assert.doesNotMatch(src, /data: \{ draftRevision: doc\.draftRevision, draft: doc\.draft \}/);
});

test("GET /brands/admin/options returns slim brand rows", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/brands/admin/options`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  const rows = res.body.data || [];
  assert.ok(rows.length >= 1);
  assert.ok(rows[0]._id && rows[0].name);
  assert.equal(rows[0].products, undefined);
  assert.equal(rows[0].createdby, undefined);
});

test("GET /leads list omits activities/history", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/leads?page=1&limit=10`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  const rows = res.body.data || [];
  assert.ok(rows.length >= 1);
  assert.equal(rows[0].activities, undefined);
  assert.equal(rows[0].history, undefined);
});

test("GET /quotes list slices translations to locale", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/quotes?page=1&limit=10&locale=ur`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  const row = (res.body.data || [])[0];
  assert.ok(row);
  assert.deepEqual(Object.keys(row.translations?.customer_name || {}), ["ur"]);
  assert.equal(row.translations.customer_name.ar, undefined);
});

test("GET /invoices list omits translation_source/status", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/invoices?page=1&limit=10`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  const row = (res.body.data || [])[0];
  assert.ok(row);
  assert.equal(row.translation_source, undefined);
  assert.equal(row.translation_status, undefined);
});

test("GET /pos/sales list caps preview items and last edit_history", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/pos/sales?page=1&limit=10`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`);
  assert.equal(res.status, 200);
  const row = (res.body.data || [])[0];
  assert.ok(row);
  assert.ok((row.items || []).length <= 4);
  assert.ok((row.edit_history || []).length <= 1);
});

test("SA listStores select omits activity/domainVerifyToken", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/super-admin/stores?page=1&limit=10`)
    .set("Host", ROOT)
    .set("X-Auth-Aud", "superadmin")
    .set("Authorization", `Bearer ${ctx.saToken}`);
  assert.equal(res.status, 200);
  const items = res.body.data?.items || [];
  assert.ok(items.length >= 1);
  const item = items.find((s) => String(s.id) === String(ctx.storeId)) || items[0];
  assert.equal(item.activity, undefined);
  assert.equal(item.domainVerifyToken, undefined);
  assert.ok(item.store_name);
});

test("SA listTeam omits activities on rows", async (t) => {
  if (!ctx) return t.skip("no mongo");
  const res = await request(app)
    .get(`${API}/super-admin/team`)
    .set("Host", ROOT)
    .set("X-Auth-Aud", "superadmin")
    .set("Authorization", `Bearer ${ctx.saToken}`);
  assert.equal(res.status, 200);
  const items = res.body.data?.items || [];
  assert.ok(items.length >= 1);
  for (const m of items) assert.equal(m.activities, undefined);
});

test("PO list vendor populate is slim (source check)", () => {
  const src = fs.readFileSync(path.join(__dirname, "../controllers/purchaseOrderController.js"), "utf8");
  assert.match(src, /populate\("vendor_id", "name vendor_code translations\.name"\)/);
});
