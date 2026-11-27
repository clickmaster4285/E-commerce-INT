// End-to-end: POST /orders through the real app (auth → tenant → pricing → stock → order)
// on a throwaway MongoDB database (optimizeplan.md §2.2 / §7.2). Skips if MongoDB is down.
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
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_order_${process.pid}_${Date.now()}$2`);

let ctx = null;
test.before(async () => {
  try {
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 });
  } catch {
    return;
  }
  // Raw inserts (no store context needed; tenant plugin bypass for fixtures)
  const storeId = new mongoose.Types.ObjectId();
  const subdomain = `ordertest${Date.now().toString(36)}`;
  await Store.collection.insertOne({ _id: storeId, store_name: "Order Test", subdomain, store_status: "open" });
  const userId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({ _id: userId, storeId, name: "Buyer", username: `buyer${Date.now()}`, email: `buyer${Date.now()}@example.com`, status: "active", role: "user", is_deleted: false });
  const addressId = new mongoose.Types.ObjectId();
  await Address.collection.insertOne({ _id: addressId, storeId, user_id: userId, full_name: "Buyer", phone: "03001234567", street_address1: "Street 1", city: "Lahore", state: "Punjab", country: "Pakistan" });
  const productId = new mongoose.Types.ObjectId();
  await Product.collection.insertOne({ _id: productId, storeId, name: "Kettle", category_id: new mongoose.Types.ObjectId(), brand_id: new mongoose.Types.ObjectId(), status: "active", is_deleted: false, tax: 0 });
  const variantId = new mongoose.Types.ObjectId();
  await Variant.collection.insertOne({ _id: variantId, storeId, product_id: productId, sku: "KT-1", title: "Default", cost_price: 400, selling_price: 1000, quantity: 5 });
  const token = tokens.signAccess("user", { subjectId: userId, role: "user", storeId, sid: "test" });
  ctx = { storeId, host: `${subdomain}.${ROOT}`, token, addressId, productId, variantId };
});

test.after(async () => {
  if (mongoose.connection.readyState === 1) {
    // Background index builds (autoIndex) khatam hone do — warna drop ke baad collections dobara ban jati hain
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init().catch(() => {})));
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
  setImmediate(() => process.exit(0)); // Redis rate-limit client wagaira
});

const place = (items) => request(app)
  .post(`${API}/orders`)
  .set("Host", ctx.host)
  .set("X-Auth-Aud", "user")
  .set("Authorization", `Bearer ${ctx.token}`)
  .send({ items, address_id: String(ctx.addressId), payment_method: "cod", shipping_method: "standard" });

const line = (overrides = {}) => ({ id: String(ctx.productId), variant_id: String(ctx.variantId), name: "Kettle", qty: 1, price: 1000, displayPrice: 1000, ...overrides });

test("tampered price → 409 PRICE_CHANGED, no order, stock untouched", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const res = await place([line({ price: 1, displayPrice: 1 })]);
  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.code, "PRICE_CHANGED");
  assert.equal(res.body.items[0].price, 1000);
  assert.equal(await Order.collection.countDocuments({ storeId: ctx.storeId }), 0);
  assert.equal((await Variant.collection.findOne({ _id: ctx.variantId })).quantity, 5);
});

test("honest order → created with SERVER prices, stock decremented", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const res = await place([line({ qty: 2 })]);
  assert.ok([200, 201].includes(res.status), JSON.stringify(res.body));
  const order = await Order.collection.findOne({ storeId: ctx.storeId });
  assert.equal(order.items[0].price, 1000);
  assert.equal(order.subtotal, 2000);
  assert.equal(order.total, order.subtotal + order.shipping + order.tax);
  assert.match(order.order_number, /^ORD-\d{5,}$/);
  assert.equal((await Variant.collection.findOne({ _id: ctx.variantId })).quantity, 3);
});

test("more than the remaining stock → 400, stock unchanged", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const res = await place([line({ qty: 4 })]);
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal((await Variant.collection.findOne({ _id: ctx.variantId })).quantity, 3);
});
