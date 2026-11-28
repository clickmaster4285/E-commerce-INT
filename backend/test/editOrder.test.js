// PUT /orders/:id/edit — tax stays correct and stock moves with qty (optimizeplan.md §2.5 / §3.1).
// Throwaway database. Skips if MongoDB is down.
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_USER_ACCESS_SECRET = process.env.JWT_USER_ACCESS_SECRET || "test-user-access-secret";

const app = require("../app");
const tokens = require("../utils/tokens");
const Store = require("../models/Store");
const User = require("../models/User");
const Address = require("../models/Address");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Order = require("../models/Order");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_edit_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `edittest${Date.now().toString(36)}`;
  await Store.collection.insertOne({ _id: storeId, store_name: "Edit Test", subdomain, store_status: "open" });
  const userId = oid();
  await User.collection.insertOne({ _id: userId, storeId, name: "Buyer", username: `buyer${Date.now()}`, email: `buyer${Date.now()}@example.com`, status: "active", role: "user", is_deleted: false });
  const addressId = oid();
  await Address.collection.insertOne({
    _id: addressId, storeId, user_id: userId, full_name: "Buyer", phone: "03001234567",
    street_address1: "Street 1", city: "Lahore", state: "Punjab", country: "Pakistan",
  });
  const token = tokens.signAccess("user", { subjectId: userId, role: "user", storeId, sid: "test" });
  ctx = { storeId, userId, addressId, host: `${subdomain}.${ROOT}`, token };
});

test.after(async () => {
  if (mongoose.connection.readyState === 1) {
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init().catch(() => {})));
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
  setImmediate(() => process.exit(0));
});

// Har test apna product / variant / order, taake parallel runs stock share na karein.
async function seed({ qty = 2, price = 100, tax = 20, taxRate = 10, stock = 10, productTax = 10, status = "pending", deal = null, product = true } = {}) {
  const productId = oid();
  const variantId = oid();
  const orderId = oid();
  const itemId = oid();
  if (product) {
    await Product.collection.insertOne({ _id: productId, storeId: ctx.storeId, name: "Kettle", status: "active", is_deleted: false, tax: productTax });
  }
  await Variant.collection.insertOne({
    _id: variantId, storeId: ctx.storeId, product_id: productId, sku: `KT-${variantId.toString().slice(-6)}`,
    title: "Default", selling_price: price, quantity: stock, status: "active",
  });
  const freeItems = deal ? Math.floor(qty / deal.buy) * deal.get : 0;
  const subtotal = price * qty;
  await Order.collection.insertOne({
    _id: orderId, storeId: ctx.storeId, order_number: `ORD-${orderId.toString().slice(-8)}`, user_id: ctx.userId,
    items: [{
      _id: itemId, product_id: productId, variant_id: variantId, name: "Kettle", price, qty,
      payable_items: qty, free_items: freeItems,
      ...(taxRate == null ? {} : { tax_rate: taxRate }),
      ...(deal ? { deal_type: "buy_x_get_y", deal_buy_quantity: deal.buy, deal_get_quantity: deal.get, deal_savings: freeItems * price } : {}),
    }],
    address_snapshot: { full_name: "Buyer", phone: "03001234567", street_address1: "Street 1", city: "Lahore", state: "Punjab", country: "Pakistan" },
    payment: { method: "cod", status: "pending" },
    subtotal, shipping: 200, tax, total: subtotal + 200 + tax, status,
    total_deal_savings: freeItems * price,
    created_at: new Date(), updated_at: new Date(),
  });
  return { orderId, itemId, variantId, productId };
}

const edit = (orderId, body) => request(app)
  .put(`${API}/orders/${orderId}/edit`)
  .set("Host", ctx.host)
  .set("X-Auth-Aud", "user")
  .set("Authorization", `Bearer ${ctx.token}`)
  .send(body);

test("qty increase keeps the snapshotted tax rate and decrements stock", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const { orderId, itemId, variantId } = await seed({ qty: 2, tax: 20, taxRate: 10, stock: 10 });
  const res = await edit(orderId, { items: [{ _id: itemId, qty: 4 }] });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.tax, 40);
  assert.equal(res.body.data.subtotal, 400);
  assert.equal(res.body.data.total, 640);
  assert.equal(res.body.data.items[0].qty, 4);
  assert.equal(res.body.data.items[0].tax_rate, 10);
  const variant = await Variant.collection.findOne({ _id: variantId });
  assert.equal(variant.quantity, 8);
});

test("legacy order without tax_rate uses Product.tax and stores the snapshot", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const { orderId, itemId, variantId } = await seed({ qty: 2, tax: 20, taxRate: null, productTax: 10, stock: 6 });
  const res = await edit(orderId, { items: [{ _id: itemId, qty: 1 }] });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.tax, 10);
  assert.equal(res.body.data.items[0].tax_rate, 10);
  const variant = await Variant.collection.findOne({ _id: variantId });
  assert.equal(variant.quantity, 7);
});

test("missing product scales the existing tax instead of zeroing it", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const { orderId, itemId, variantId } = await seed({ qty: 2, tax: 20, taxRate: null, product: false, stock: 9 });
  const res = await edit(orderId, { items: [{ _id: itemId, qty: 4 }] });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.tax, 40);
  assert.equal(res.body.data.items[0].tax_rate, undefined);
  const variant = await Variant.collection.findOne({ _id: variantId });
  assert.equal(variant.quantity, 7);
});

test("buy x get y qty change moves paid and free units", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const { orderId, itemId, variantId } = await seed({ qty: 2, tax: 0, taxRate: 0, stock: 20, deal: { buy: 2, get: 1 } });
  const before = await Variant.collection.findOne({ _id: variantId });
  assert.equal(before.quantity, 20);
  const res = await edit(orderId, { items: [{ _id: itemId, qty: 4 }] });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.items[0].free_items, 2);
  assert.equal(res.body.data.items[0].deal_savings, 200);
  assert.equal(res.body.data.total_deal_savings, 200);
  assert.equal(res.body.data.tax, 0);
  const variant = await Variant.collection.findOne({ _id: variantId });
  // units 3 → 6, shelf loses 3
  assert.equal(variant.quantity, 17);
});

test("insufficient stock leaves the order and the shelf unchanged", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const { orderId, itemId, variantId } = await seed({ qty: 1, tax: 10, taxRate: 10, stock: 0 });
  const res = await edit(orderId, { items: [{ _id: itemId, qty: 3 }] });
  assert.equal(res.status, 400);
  const order = await Order.collection.findOne({ _id: orderId });
  assert.equal(order.items[0].qty, 1);
  assert.equal(order.tax, 10);
  const variant = await Variant.collection.findOne({ _id: variantId });
  assert.equal(variant.quantity, 0);
});

test("address-only edit does not change tax or stock", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const { orderId, variantId } = await seed({ qty: 2, tax: 20, taxRate: 10, stock: 4 });
  const res = await edit(orderId, { address_id: String(ctx.addressId) });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.tax, 20);
  assert.equal(res.body.data.subtotal, 200);
  assert.equal(res.body.data.address_snapshot.street_address1, "Street 1");
  const variant = await Variant.collection.findOne({ _id: variantId });
  assert.equal(variant.quantity, 4);
});

test("a confirmed order cannot be edited", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const { orderId, itemId, variantId } = await seed({ status: "confirmed", stock: 5 });
  const res = await edit(orderId, { items: [{ _id: itemId, qty: 4 }] });
  assert.equal(res.status, 400);
  const variant = await Variant.collection.findOne({ _id: variantId });
  assert.equal(variant.quantity, 5);
});

test("concurrent qty increases take the last unit only once", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const { orderId, itemId, variantId } = await seed({ qty: 1, tax: 10, taxRate: 10, stock: 1 });
  const results = await Promise.all(Array.from({ length: 5 }, () => edit(orderId, { items: [{ _id: itemId, qty: 2 }] })));
  const ok = results.filter((r) => r.status === 200);
  assert.equal(ok.length, 1);
  assert.equal(ok[0].body.data.items[0].qty, 2);
  assert.equal(ok[0].body.data.tax, 20);
  const variant = await Variant.collection.findOne({ _id: variantId });
  assert.equal(variant.quantity, 0);
  const order = await Order.collection.findOne({ _id: orderId });
  assert.equal(order.items[0].qty, 2);
  assert.equal(order.tax, 20);
});
