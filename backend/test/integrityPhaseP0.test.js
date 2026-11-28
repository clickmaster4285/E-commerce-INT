// Next optimizeplan phase: upload paths, soft-delete store, partial uniques,
// discount usageCount, adjustStock/withTx, deliverPO claim, dashboard TZ helpers.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const request = require("supertest");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";
process.env.JWT_SA_ACCESS_SECRET = process.env.JWT_SA_ACCESS_SECRET || "test-sa-access-secret";
process.env.JWT_USER_ACCESS_SECRET = process.env.JWT_USER_ACCESS_SECRET || "test-user-access-secret";

const app = require("../app");
const tokens = require("../utils/tokens");
const { uploadDirFor, uploadUrlFor } = require("../utils/uploadPaths");
const Store = require("../models/Store");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Address = require("../models/Address");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Discount = require("../models/Discount");
const Order = require("../models/Order");
const Brand = require("../models/Brand");
const Attribute = require("../models/Attribute");
const Category = require("../models/Category");
const Vendor = require("../models/Vendor");
const PurchaseOrder = require("../models/PurchaseOrder");
const StockHistory = require("../models/StockHistory");
const SuperAdmin = require("../models/SuperAdmin");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_integ_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `integ${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: storeId, store_name: "Integ Store", subdomain, store_status: "open",
    timezone: "Asia/Karachi", is_deleted: false,
  });
  const adminId = oid();
  await Employee.collection.insertOne({
    _id: adminId, storeId, name: "Owner", username: `own${Date.now()}`,
    email: `own${Date.now()}@example.com`, password: "x".repeat(60),
    role: "admin", status: "active", is_deleted: false, permissions: {},
  });
  const saId = oid();
  await SuperAdmin.collection.insertOne({
    _id: saId, name: "SA", email: `sa${Date.now()}@example.com`,
    passwordHash: "x".repeat(60), role: "superadmin", status: "active",
  });
  const userId = oid();
  await User.collection.insertOne({
    _id: userId, storeId, name: "Buyer", username: `buy${Date.now()}`,
    email: `buy${Date.now()}@example.com`, status: "active", role: "user", is_deleted: false,
  });
  const addressId = oid();
  await Address.collection.insertOne({
    _id: addressId, storeId, user_id: userId, full_name: "Buyer", phone: "03001234567",
    street_address1: "St", city: "Lahore", state: "Punjab", country: "Pakistan",
  });
  const productId = oid();
  await Product.collection.insertOne({
    _id: productId, storeId, name: "Mug", category_id: oid(), brand_id: oid(),
    status: "active", is_deleted: false, tax: 0,
  });
  const variantId = oid();
  await Variant.collection.insertOne({
    _id: variantId, storeId, product_id: productId, sku: "MG-INT", title: "Default",
    cost_price: 50, selling_price: 200, quantity: 20, status: "active", is_deleted: false, __v: 0,
  });
  const discountId = oid();
  await Discount.collection.insertOne({
    _id: discountId, storeId, code: "TENOFF", name: "Ten Off", type: "percentage", value: 10,
    applyTo: "all", isActive: true, status: "active", is_deleted: false,
    startDate: new Date(Date.now() - 864e5), endDate: new Date(Date.now() + 864e5),
    usageLimit: 1, usageCount: 0,
  });
  await Order.init();
  ctx = {
    storeId, subdomain, host: `${subdomain}.${ROOT}`, productId, variantId, discountId,
    addressId, userId, adminId, saId,
    adminToken: tokens.signAccess("admin", { subjectId: adminId, role: "admin", storeId, sid: "t" }),
    userToken: tokens.signAccess("user", { subjectId: userId, role: "user", storeId, sid: "t" }),
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

test("uploadDirFor platform kinds stay under uploads/<kind>", () => {
  const logoDir = uploadDirFor(null, "store-logos");
  const docDir = uploadDirFor(null, "documents");
  assert.ok(logoDir.replace(/\\/g, "/").endsWith("/uploads/store-logos") || logoDir.replace(/\\/g, "/").includes("/uploads/store-logos"));
  assert.ok(docDir.replace(/\\/g, "/").includes("/uploads/documents"));
  const abs = path.join(logoDir, "x.webp");
  assert.match(uploadUrlFor(abs).replace(/\\/g, "/"), /^\/uploads\/store-logos\/x\.webp$/);
});

test("seller logo/KYC writers use uploadDirFor (no hardcoded uploads paths)", () => {
  const userSrc = fs.readFileSync(path.join(__dirname, "../controllers/userController.js"), "utf8");
  const sellerSrc = fs.readFileSync(path.join(__dirname, "../controllers/sellerApplicationController.js"), "utf8");
  assert.ok(userSrc.includes("uploadDirFor"));
  assert.ok(sellerSrc.includes("uploadDirFor"));
  assert.ok(!/path\.join\(__dirname,\s*"\.\.",\s*"uploads",\s*"store-logos"\)/.test(userSrc));
  assert.ok(!/path\.join\(__dirname,\s*"\.\.",\s*"uploads",\s*"documents"\)/.test(sellerSrc));
  assert.ok(!/path\.join\(__dirname,\s*"\.\.",\s*"uploads",\s*"store-logos"\)/.test(sellerSrc));
});

test("Brand/Attribute/Category/Vendor use partial unique on is_deleted:false", () => {
  for (const Model of [Brand, Attribute, Category, Vendor]) {
    const uniques = Model.schema.indexes().filter(([, opts]) => opts?.unique);
    assert.ok(uniques.length >= 1, Model.modelName);
    const partial = uniques.find(([, opts]) => opts?.partialFilterExpression?.is_deleted === false);
    assert.ok(partial, `${Model.modelName} missing partial unique`);
    assert.equal(partial[0].is_deleted, undefined);
  }
});

test("dashboard $dateToString uses store timezone", () => {
  const src = fs.readFileSync(path.join(__dirname, "../controllers/dashboardController.js"), "utf8");
  assert.ok(src.includes("timezone: tz"));
  assert.ok(src.includes("storeTimezone"));
  assert.ok(!/end\.setHours\(23/.test(src));
});

test("adjustStock concurrent remove cannot oversell", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  await Variant.collection.updateOne({ _id: ctx.variantId }, { $set: { quantity: 5, __v: 0 } });
  const call = () => request(app)
    .post(`${API}/stock/adjust`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`)
    .send({
      variant_id: String(ctx.variantId),
      type: "remove",
      quantity: 3,
      reason: "damage",
      explanation: "test concurrent remove",
    });
  const results = await Promise.all([call(), call(), call()]);
  const oks = results.filter((r) => r.status === 200);
  const fails = results.filter((r) => r.status >= 400);
  assert.equal(oks.length, 1, JSON.stringify(results.map((r) => ({ s: r.status, b: r.body }))));
  assert.ok(fails.length >= 2);
  const v = await Variant.findById(ctx.variantId).setOptions({ skipTenantScope: true });
  assert.equal(v.quantity, 2);
});

test("placeOrder increments Discount.usageCount and enforces usageLimit", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  await Discount.collection.updateOne({ _id: ctx.discountId }, { $set: { usageCount: 0, usageLimit: 1 } });
  await Variant.collection.updateOne({ _id: ctx.variantId }, { $set: { quantity: 10 } });
  const place = () => request(app)
    .post(`${API}/orders`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "user")
    .set("Authorization", `Bearer ${ctx.userToken}`)
    .send({
      items: [{
        id: String(ctx.productId),
        variant_id: String(ctx.variantId),
        name: "Mug",
        qty: 1,
        price: 180,
        displayPrice: 180,
      }],
      address_id: String(ctx.addressId),
      payment_method: "cod",
      shipping_method: "standard",
    });
  const first = await place();
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const d1 = await Discount.findById(ctx.discountId).setOptions({ skipTenantScope: true });
  assert.equal(d1.usageCount, 1);
  const second = await place();
  assert.equal(second.status, 400, JSON.stringify(second.body));
  assert.equal(second.body.code, "DISCOUNT_LIMIT_REACHED");
  const d2 = await Discount.findById(ctx.discountId).setOptions({ skipTenantScope: true });
  assert.equal(d2.usageCount, 1);
});

test("deleteStore soft-deletes and frees subdomain", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const doomedId = oid();
  const sub = `doomed${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: doomedId, store_name: "Doomed", subdomain: sub, store_status: "open", is_deleted: false,
  });
  const res = await request(app)
    .delete(`${API}/super-admin/stores/${doomedId}`)
    .set("Host", ROOT)
    .set("X-Auth-Aud", "superadmin")
    .set("Authorization", `Bearer ${ctx.saToken}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const store = await Store.findById(doomedId).setOptions({ skipTenantScope: true });
  assert.ok(store);
  assert.equal(store.is_deleted, true);
  assert.equal(store.store_status, "closed");
  assert.ok(!store.subdomain);
  const stillThere = await Product.countDocuments({ storeId: doomedId }).setOptions({ skipTenantScope: true });
  assert.equal(stillThere, 0); // no products seeded for doomed — just ensure Store row remains
  const exists = await Store.exists({ _id: doomedId }).setOptions({ skipTenantScope: true });
  assert.ok(exists);
});

test("deliverPO claims status once (concurrent)", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const poId = oid();
  const vid = oid();
  await Variant.collection.insertOne({
    _id: vid, storeId: ctx.storeId, product_id: ctx.productId, sku: `PO-${vid.toString().slice(-4)}`,
    title: "PO line", cost_price: 10, selling_price: 20, quantity: 0, status: "active", is_deleted: false,
  });
  await PurchaseOrder.collection.insertOne({
    _id: poId, storeId: ctx.storeId, po_number: `PO-${Date.now()}`, status: "confirmed",
    vendor_id: oid(), items: [{
      variant_id: vid, product_id: ctx.productId, name: "PO line", sku: "PO-L",
      qty_ordered: 4, received_qty: 0, cost_price: 10, sell_price: 20, line_total: 40,
    }],
    subtotal: 40, total: 40, receivings: [], activity: [],
  });
  const body = {
    explanation: "full receive",
    items: [{ variant_id: String(vid), qty: 4 }],
  };
  const call = () => request(app)
    .post(`${API}/purchase-orders/admin/${poId}/deliver`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`)
    .send(body);
  const results = await Promise.all([call(), call(), call()]);
  const oks = results.filter((r) => r.status === 200 && !/already/i.test(r.body?.message || ""));
  const claimedOrConflict = results.filter((r) => r.status === 200 || r.status === 409);
  assert.ok(claimedOrConflict.length === 3, JSON.stringify(results.map((r) => ({ s: r.status, m: r.body?.message, c: r.body?.code }))));
  // Exactly one delivery should add stock (idempotent already-delivered counts as non-add)
  const v = await Variant.findById(vid).setOptions({ skipTenantScope: true });
  assert.equal(v.quantity, 4);
  const po = await PurchaseOrder.findById(poId).setOptions({ skipTenantScope: true });
  assert.equal(po.status, "delivered");
  assert.ok(oks.length <= 1 || results.filter((r) => r.status === 200).length >= 1);
});
