// Invoice create / update / return stock + document in one withTx (optimizeplan.md §3.1 / §4.1).
// Throwaway database. Skips if MongoDB is down.
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";

const app = require("../app");
const tokens = require("../utils/tokens");
const Store = require("../models/Store");
const Employee = require("../models/Employee");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Invoice = require("../models/Invoice");
const StockHistory = require("../models/StockHistory");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_invtx_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `invtx${Date.now().toString(36)}`;
  await Store.collection.insertOne({ _id: storeId, store_name: "Invoice Tx", subdomain, store_status: "open" });
  const adminId = oid();
  await Employee.collection.insertOne({
    _id: adminId, storeId, name: "Owner", username: `owner${Date.now()}`, email: `owner${Date.now()}@example.com`,
    password: "x".repeat(60), role: "admin", status: "active", is_deleted: false, permissions: {},
  });
  const customerId = oid();
  await Customer.collection.insertOne({
    _id: customerId, storeId, name: "Buyer", email: `buyer${Date.now()}@example.com`, phone: "03001234567",
    address: "Street 1", is_deleted: false,
  });
  await Promise.all([Invoice.init(), Variant.init(), StockHistory.init()]);
  const token = tokens.signAccess("admin", { subjectId: adminId, role: "admin", storeId, sid: "t" });
  ctx = { storeId, customerId, host: `${subdomain}.${ROOT}`, token };
});

test.after(async () => {
  if (mongoose.connection.readyState === 1) {
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init().catch(() => {})));
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
  setImmediate(() => process.exit(0));
});

const admin = (method, path) => request(app)[method](`${API}${path}`)
  .set("Host", ctx.host).set("X-Auth-Aud", "admin").set("Authorization", `Bearer ${ctx.token}`);

async function seedVariant({ stock = 5, price = 100 } = {}) {
  const productId = oid();
  const variantId = oid();
  await Product.collection.insertOne({
    _id: productId, storeId: ctx.storeId, name: "Widget", status: "active", is_deleted: false, tax: 0,
  });
  await Variant.collection.insertOne({
    _id: variantId, storeId: ctx.storeId, product_id: productId, sku: `W-${variantId.toString().slice(-6)}`,
    title: "Default", selling_price: price, quantity: stock, status: "active",
  });
  return { productId, variantId, price };
}

const invoiceBody = ({ productId, variantId, quantity = 1, price = 100, customerId = ctx.customerId } = {}) => ({
  customer_id: String(customerId),
  customer_name: "Buyer",
  invoice_date: new Date().toISOString(),
  due_date: new Date(Date.now() + 864e5).toISOString(),
  items: [{
    product_id: String(productId),
    variant_id: String(variantId),
    name: "Widget",
    quantity,
    unit_price: price,
    discount_rate: 0,
    tax_rate: 0,
  }],
  overall_discount_rate: 0,
  overall_discount_type: "percent",
  tax_rate: 0,
});

test("create invoice deducts stock; insufficient stock creates nothing", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const { productId, variantId, price } = await seedVariant({ stock: 2 });
  const ok = await admin("post", "/invoices").send(invoiceBody({ productId, variantId, quantity: 2, price }));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal((await Variant.collection.findOne({ _id: variantId })).quantity, 0);
  assert.equal(await Invoice.collection.countDocuments({ storeId: ctx.storeId, "items.variant_id": variantId }), 1);

  const fail = await admin("post", "/invoices").send(invoiceBody({ productId, variantId, quantity: 1, price }));
  assert.equal(fail.status, 400);
  assert.match(String(fail.body.message || ""), /stock/i);
  assert.equal((await Variant.collection.findOne({ _id: variantId })).quantity, 0);
  assert.equal(await Invoice.collection.countDocuments({ storeId: ctx.storeId, "items.variant_id": variantId }), 1);
});

test("5 concurrent creates for stock 3 → exactly 3 invoices and zero stock", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const { productId, variantId, price } = await seedVariant({ stock: 3 });
  const results = await Promise.all(Array.from({ length: 5 }, () =>
    admin("post", "/invoices").send(invoiceBody({ productId, variantId, quantity: 1, price }))));
  const ok = results.filter((r) => r.status === 201).length;
  assert.equal(ok, 3, JSON.stringify(results.map((r) => [r.status, r.body.message])));
  assert.equal((await Variant.collection.findOne({ _id: variantId })).quantity, 0);
  assert.equal(await Invoice.collection.countDocuments({ storeId: ctx.storeId, "items.variant_id": variantId }), 3);
});

test("update that raises qty claims the last unit once; concurrent edit gets 409", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  // Create takes 1 of 2; five concurrent edits each try to take the last unit.
  const { productId, variantId, price } = await seedVariant({ stock: 2 });
  const created = await admin("post", "/invoices").send(invoiceBody({ productId, variantId, quantity: 1, price }));
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal((await Variant.collection.findOne({ _id: variantId })).quantity, 1);
  const invoiceId = created.body.data._id;
  const body = invoiceBody({ productId, variantId, quantity: 2, price });
  const results = await Promise.all(Array.from({ length: 5 }, () => admin("put", `/invoices/${invoiceId}`).send(body)));
  const ok = results.filter((r) => r.status === 200);
  assert.equal(ok.length, 1, JSON.stringify(results.map((r) => [r.status, r.body.code || r.body.message])));
  assert.ok(results.some((r) => r.status === 409 || r.status === 400));
  assert.equal(ok[0].body.data.items[0].quantity, 2);
  assert.equal((await Variant.collection.findOne({ _id: variantId })).quantity, 0);
  const inv = await Invoice.collection.findOne({ _id: new mongoose.Types.ObjectId(invoiceId) });
  assert.equal(inv.items[0].quantity, 2);
});

test("return restores stock once under concurrent requests", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const { productId, variantId, price } = await seedVariant({ stock: 5 });
  const created = await admin("post", "/invoices").send(invoiceBody({ productId, variantId, quantity: 2, price }));
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const invoiceId = created.body.data._id;
  const itemId = created.body.data.items[0]._id;
  const sent = await admin("post", `/invoices/${invoiceId}/send`).send({});
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  assert.equal((await Variant.collection.findOne({ _id: variantId })).quantity, 3);

  const results = await Promise.all(Array.from({ length: 5 }, () =>
    admin("post", `/invoices/${invoiceId}/returns`).send({
      items_returned: [{ item_id: itemId, qty: 2 }],
      refund_method: "Balance Adjustment",
      reason: "customer changed mind",
    })));
  const ok = results.filter((r) => r.status === 200);
  assert.equal(ok.length, 1, JSON.stringify(results.map((r) => [r.status, r.body.code || r.body.message])));
  assert.equal((await Variant.collection.findOne({ _id: variantId })).quantity, 5);
  const inv = await Invoice.collection.findOne({ _id: new mongoose.Types.ObjectId(invoiceId) });
  assert.equal((inv.returns || []).length, 1);
  assert.equal(await StockHistory.collection.countDocuments({ explanation: { $regex: inv.returns[0].return_id } }), 1);
});
