// §3.4 / §3.9 cutover: Order *_minor, Payment pending/capture, stock movements, stats
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_USER_ACCESS_SECRET = process.env.JWT_USER_ACCESS_SECRET || "test-user-access-secret";
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";

const app = require("../app");
const tokens = require("../utils/tokens");
const Store = require("../models/Store");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Address = require("../models/Address");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const StockMovement = require("../models/StockMovement");
const StoreDailyStats = require("../models/StoreDailyStats");
const { runWithStore } = require("../utils/tenantContext");
const { dayKey } = require("../services/storeStats");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_money_order_${process.pid}_${Date.now()}$2`);

let ctx = null;

test.before(async () => {
  try {
    await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 });
  } catch {
    return;
  }
  const storeId = new mongoose.Types.ObjectId();
  const subdomain = `moneyord${Date.now().toString(36)}`;
  await Store.collection.insertOne({
    _id: storeId,
    store_name: "Money Order Test",
    subdomain,
    store_status: "open",
    currency: "PKR",
  });
  const userId = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id: userId,
    storeId,
    name: "Buyer",
    username: `buyer${Date.now()}`,
    email: `buyer${Date.now()}@example.com`,
    status: "active",
    role: "user",
    is_deleted: false,
  });
  const adminId = new mongoose.Types.ObjectId();
  await Employee.collection.insertOne({
    _id: adminId,
    storeId,
    name: "Admin",
    email: `admin${Date.now()}@example.com`,
    username: `admin${Date.now()}`,
    password: "hashed",
    role: "admin",
    status: "active",
    is_deleted: false,
  });
  const addressId = new mongoose.Types.ObjectId();
  await Address.collection.insertOne({
    _id: addressId,
    storeId,
    user_id: userId,
    full_name: "Buyer",
    phone: "03001234567",
    street_address1: "Street 1",
    city: "Lahore",
    state: "Punjab",
    country: "Pakistan",
  });
  const productId = new mongoose.Types.ObjectId();
  await Product.collection.insertOne({
    _id: productId,
    storeId,
    name: "Book",
    category_id: new mongoose.Types.ObjectId(),
    brand_id: new mongoose.Types.ObjectId(),
    status: "active",
    is_deleted: false,
    tax: 0,
  });
  const variantId = new mongoose.Types.ObjectId();
  await Variant.collection.insertOne({
    _id: variantId,
    storeId,
    product_id: productId,
    sku: "BK-1",
    title: "Default",
    cost_price: 100,
    selling_price: 500,
    quantity: 20,
  });
  await Order.init();
  await Payment.init();
  await StockMovement.init();
  const userToken = tokens.signAccess("user", { subjectId: userId, role: "user", storeId, sid: "u" });
  const adminToken = tokens.signAccess("admin", {
    subjectId: adminId,
    role: "admin",
    storeId,
    sid: "a",
  });
  ctx = {
    storeId,
    host: `${subdomain}.${ROOT}`,
    userToken,
    adminToken,
    addressId,
    productId,
    variantId,
    userId,
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

const place = (qty = 1, extra = {}) =>
  request(app)
    .post(`${API}/orders`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "user")
    .set("Authorization", `Bearer ${ctx.userToken}`)
    .send({
      items: [
        {
          id: String(ctx.productId),
          variant_id: String(ctx.variantId),
          name: "Book",
          qty,
          price: 500,
          displayPrice: 500,
        },
      ],
      address_id: String(ctx.addressId),
      payment_method: "cod",
      shipping_method: "standard",
      ...extra,
    });

test("placeOrder writes total_minor, pending Payment, sale movement, daily stats", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const res = await place(2);
  assert.ok([200, 201].includes(res.status), JSON.stringify(res.body));
  const order = await Order.collection.findOne({ storeId: ctx.storeId });
  assert.ok(order);
  assert.equal(order.currency, "PKR");
  assert.ok(Number(order.total_minor) > 0);
  assert.equal(order.total_minor, Math.round(Number(order.total) * 100));
  assert.equal(order.items[0].price_minor, 50000);

  const pending = await Payment.collection.findOne({
    storeId: ctx.storeId,
    ref_type: "order",
    ref_id: order._id,
    status: "pending",
    idempotency_key: `order:${order._id}:place`,
  });
  assert.ok(pending, "pending Payment missing");
  assert.equal(pending.amount_minor, order.total_minor);

  const mov = await StockMovement.collection.findOne({
    storeId: ctx.storeId,
    idempotency_key: `order:${order._id}:${ctx.variantId}:sale`,
  });
  assert.ok(mov, "sale StockMovement missing");
  assert.equal(mov.kind, "sale");
  assert.equal(mov.qty_delta, -2);

  await new Promise((r) => setTimeout(r, 150));
  const day = dayKey();
  const stats = await StoreDailyStats.collection.findOne({ storeId: ctx.storeId, day });
  assert.ok(stats, "StoreDailyStats missing");
  assert.ok(Number(stats.orders) >= 1);
  assert.ok(Number(stats.revenue) > 0);

  ctx.orderId = order._id;
  ctx.orderTotalMinor = order.total_minor;
});

test("double mark-paid → one captured Payment", async (t) => {
  if (!ctx?.orderId) return t.skip("placeOrder fixture missing");
  const patch = () =>
    request(app)
      .patch(`${API}/orders/admin/${ctx.orderId}/payment`)
      .set("Host", ctx.host)
      .set("X-Auth-Aud", "admin")
      .set("Authorization", `Bearer ${ctx.adminToken}`)
      .send({ status: "paid" });

  const first = await patch();
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const second = await patch();
  assert.ok([200, 409].includes(second.status), JSON.stringify(second.body));

  const captured = await Payment.collection.find({
    storeId: ctx.storeId,
    ref_id: ctx.orderId,
    status: "captured",
    direction: "in",
    idempotency_key: `order:${ctx.orderId}:capture`,
  }).toArray();
  assert.equal(captured.length, 1);
  assert.equal(captured[0].amount_minor, ctx.orderTotalMinor);
});

test("cancel paid order restores stock and writes refund Payment", async (t) => {
  if (!ctx?.orderId) return t.skip("placeOrder fixture missing");
  const stockBefore = (await Variant.collection.findOne({ _id: ctx.variantId })).quantity;

  const res = await request(app)
    .patch(`${API}/orders/admin/${ctx.orderId}/status`)
    .set("Host", ctx.host)
    .set("X-Auth-Aud", "admin")
    .set("Authorization", `Bearer ${ctx.adminToken}`)
    .send({ status: "cancelled", cancel_reason: "test" });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const stockAfter = (await Variant.collection.findOne({ _id: ctx.variantId })).quantity;
  assert.equal(stockAfter, stockBefore + 2);

  const refund = await Payment.collection.findOne({
    storeId: ctx.storeId,
    ref_id: ctx.orderId,
    direction: "out",
    idempotency_key: `order:${ctx.orderId}:refund`,
  });
  assert.ok(refund, "refund Payment missing");

  const cancelMov = await StockMovement.collection.findOne({
    storeId: ctx.storeId,
    idempotency_key: `order:${ctx.orderId}:${ctx.variantId}:sale_cancel`,
  });
  assert.ok(cancelMov);
  assert.equal(cancelMov.qty_delta, 2);
});

test("stock.reserve idempotency key reuses reservation", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const stock = require("../services/stock");
  const key = `test-reserve-${Date.now()}`;
  await runWithStore(ctx.storeId, async () => {
    const a = await stock.reserve({
      variant_id: ctx.variantId,
      qty: 1,
      checkout_draft_id: new mongoose.Types.ObjectId(),
      idempotency_key: key,
    });
    assert.equal(a.ok, true);
    const b = await stock.reserve({
      variant_id: ctx.variantId,
      qty: 1,
      checkout_draft_id: new mongoose.Types.ObjectId(),
      idempotency_key: key,
    });
    assert.equal(b.ok, true);
    assert.equal(String(a.reservation._id), String(b.reservation._id));
    await stock.release({ reservation_id: a.reservation._id });
  });
});
