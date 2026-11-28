// Concurrency on money/stock flows through the real app (optimizeplan.md §4.1 / §4.2)
// on a throwaway MongoDB database. Skips if MongoDB is down.
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
const Invoice = require("../models/Invoice");
const PosSale = require("../models/PosSale");
const Variant = require("../models/Variant");
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchasePayment = require("../models/PurchasePayment");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_money_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `moneytest${Date.now().toString(36)}`;
  await Store.collection.insertOne({ _id: storeId, store_name: "Money Test", subdomain, store_status: "open" });
  const adminId = oid();
  await Employee.collection.insertOne({ _id: adminId, storeId, name: "Owner", username: `owner${Date.now()}`, email: `owner${Date.now()}@example.com`, password: "x".repeat(60), role: "admin", status: "active", is_deleted: false, permissions: {} });

  // Invoice: total 1000, nothing paid
  const invoiceId = oid();
  const productId = oid();
  await Invoice.collection.insertOne({
    _id: invoiceId, storeId, invoice_number: "INV-0001", customer_id: oid(), customer_name: "C", invoice_date: new Date(), due_date: new Date(),
    items: [{ _id: oid(), product_id: productId, name: "Item", quantity: 1, unit_price: 1000, total: 1000 }],
    subtotal: 1000, total: 1000, original_total: 1000, amount_paid: 0, remaining_balance: 1000, payments: [], returns: [], activity: [], status: "Unpaid", is_deleted: false,
  });

  // POS sale: 2 units sold, stock currently 0
  const variantId = oid();
  await Variant.collection.insertOne({ _id: variantId, storeId, product_id: productId, sku: "PS-1", title: "T", cost_price: 1, selling_price: 100, quantity: 0 });
  const saleId = oid();
  await PosSale.collection.insertOne({
    _id: saleId, storeId, sale_number: "POS-00001", status: "completed", additional_tax_rate: 0, discount_amount: 0,
    items: [{ product_id: productId, variant_id: variantId, product_name: "Thing", sku: "PS-1", variant_title: "T", unit_price: 100, quantity: 2, discount_amount: 0, tax_rate: 0, line_total: 200 }],
    subtotal: 200, total: 200, payment: { method: "cash", amount_received: 200 }, returns: [], edit_history: [],
  });

  // Delivered PO: total 1000, nothing paid
  const poId = oid();
  await PurchaseOrder.collection.insertOne({ _id: poId, storeId, po_number: "PO-00001", vendor_id: oid(), status: "delivered", total: 1000, paid_amount: 0, due_amount: 1000, payment_status: "unpaid", items: [], activity: [], is_deleted: false });

  await Promise.all([Invoice.init(), PosSale.init(), PurchaseOrder.init()]);
  const token = tokens.signAccess("admin", { subjectId: adminId, role: "admin", storeId, sid: "t" });
  ctx = { storeId, host: `${subdomain}.${ROOT}`, token, invoiceId, saleId, variantId, poId };
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

test("5 concurrent invoice payments of 600 on a 1000 invoice → only one succeeds, never overpaid", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const results = await Promise.all(Array.from({ length: 5 }, () =>
    admin("post", `/invoices/${ctx.invoiceId}/payments`).send({ amount: 600, payment_date: new Date().toISOString(), payment_method: "Cash" })));
  const ok = results.filter((r) => r.status === 200).length;
  const inv = await Invoice.collection.findOne({ _id: ctx.invoiceId });
  assert.equal(ok, 1, JSON.stringify(results.map((r) => [r.status, r.body.code || r.body.message])));
  assert.equal(inv.amount_paid, 600);
  assert.equal(inv.payments.length, 1);
});

test("5 concurrent POS returns of 1 unit when only 2 were sold → exactly 2 returned", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const results = await Promise.all(Array.from({ length: 5 }, () =>
    admin("post", `/pos/sales/${ctx.saleId}/returns`).send({ items: [{ variant_id: String(ctx.variantId), quantity: 1 }], note: "damaged" })));
  const ok = results.filter((r) => r.status === 201).length;
  const sale = await PosSale.collection.findOne({ _id: ctx.saleId });
  const returned = (sale.returns || []).reduce((s, r) => s + r.items.reduce((a, i) => a + i.quantity, 0), 0);
  assert.equal(ok, 2, JSON.stringify(results.map((r) => [r.status, r.body.message])));
  assert.equal(returned, 2);
  assert.equal((await Variant.collection.findOne({ _id: ctx.variantId })).quantity, 2, "stock restored exactly twice");
});

test("5 concurrent PO payments of 600 on a 1000 PO → one payment, never overpaid", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const results = await Promise.all(Array.from({ length: 5 }, () =>
    admin("patch", `/purchase-orders/admin/${ctx.poId}/payment`).send({ amount: 600, method: "cash" })));
  const ok = results.filter((r) => r.status === 200).length;
  const po = await PurchaseOrder.collection.findOne({ _id: ctx.poId });
  assert.equal(ok, 1, JSON.stringify(results.map((r) => [r.status, r.body.code || r.body.message])));
  assert.equal(po.paid_amount, 600);
  assert.equal(await PurchasePayment.collection.countDocuments({ po_id: ctx.poId }), 1);
});
