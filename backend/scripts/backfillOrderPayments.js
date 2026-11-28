#!/usr/bin/env node
/**
 * Backfill Payment rows for historical paid orders / invoices / POS sales
 * that predate the §3.9 dual-write cutover.
 *
 * Dry-run by default. Apply with: node scripts/backfillOrderPayments.js --apply
 *
 * Finance overview still falls back to legacy collection scans when no Payment
 * rows exist in a date range — after this backfill, the payments_ledger path
 * covers historical paid docs too.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Order = require("../models/Order");
const Invoice = require("../models/Invoice");
const PosSale = require("../models/PosSale");
const Payment = require("../models/Payment");
const { toMinor } = require("../utils/money");
const { normalizeMethod } = require("../config/paymentMethods");
const { runUnscoped, runWithStore } = require("../utils/tenantContext");

const APPLY = process.argv.includes("--apply");

async function ensurePayment(doc) {
  const existing = await Payment.findOne({ idempotency_key: doc.idempotency_key }).lean();
  if (existing) return { skipped: true };
  if (!APPLY) return { wouldCreate: true };
  await Payment.create([doc]);
  return { created: true };
}

async function backfillOrders() {
  const stats = { scanned: 0, created: 0, skipped: 0, wouldCreate: 0 };
  const orders = await Order.find({ "payment.status": "paid" })
    .select("_id storeId total total_minor currency payment user_id order_number created_at")
    .lean()
    .limit(10000);
  for (const order of orders) {
    stats.scanned += 1;
    const currency = String(order.currency || "PKR").toUpperCase();
    const amount = Number(order.total_minor) > 0 ? Number(order.total_minor) : toMinor(order.total, currency);
    if (!(amount > 0)) continue;
    await runWithStore(order.storeId, async () => {
      const result = await ensurePayment({
        direction: "in",
        method_code: normalizeMethod(order.payment?.method || "cod"),
        amount_minor: amount,
        currency,
        status: "captured",
        ref_type: "order",
        ref_id: order._id,
        party_type: "customer",
        party_id: order.user_id || null,
        reference: order.order_number || "",
        idempotency_key: `order:${order._id}:capture`,
        at: order.created_at || new Date(),
      });
      if (result.created) stats.created += 1;
      else if (result.wouldCreate) stats.wouldCreate += 1;
      else stats.skipped += 1;
    });
  }
  return stats;
}

async function backfillInvoices() {
  const stats = { scanned: 0, created: 0, skipped: 0, wouldCreate: 0 };
  const invoices = await Invoice.find({ is_deleted: { $ne: true }, amount_paid: { $gt: 0 } })
    .select("_id storeId amount_paid customer_id invoice_number payments created_at")
    .lean()
    .limit(10000);
  for (const inv of invoices) {
    stats.scanned += 1;
    const payments = Array.isArray(inv.payments) ? inv.payments : [];
    if (!payments.length) {
      const amount = toMinor(inv.amount_paid);
      if (!(amount > 0)) continue;
      await runWithStore(inv.storeId, async () => {
        const result = await ensurePayment({
          direction: "in",
          method_code: "cash",
          amount_minor: amount,
          currency: "PKR",
          status: "captured",
          ref_type: "invoice",
          ref_id: inv._id,
          party_type: "customer",
          party_id: inv.customer_id || null,
          reference: inv.invoice_number || "",
          idempotency_key: `invoice:${inv._id}:backfill:total`,
          at: inv.created_at || new Date(),
        });
        if (result.created) stats.created += 1;
        else if (result.wouldCreate) stats.wouldCreate += 1;
        else stats.skipped += 1;
      });
      continue;
    }
    let i = 0;
    for (const pay of payments) {
      const amount = toMinor(pay.amount);
      if (!(amount > 0)) continue;
      stats.scanned += 1;
      await runWithStore(inv.storeId, async () => {
        const result = await ensurePayment({
          direction: "in",
          method_code: normalizeMethod(pay.payment_method || "cash"),
          amount_minor: amount,
          currency: "PKR",
          status: "captured",
          ref_type: "invoice",
          ref_id: inv._id,
          party_type: "customer",
          party_id: inv.customer_id || null,
          reference: pay.note || inv.invoice_number || "",
          idempotency_key: `invoice:${inv._id}:backfill:${i}`,
          at: pay.payment_date || inv.created_at || new Date(),
        });
        if (result.created) stats.created += 1;
        else if (result.wouldCreate) stats.wouldCreate += 1;
        else stats.skipped += 1;
      });
      i += 1;
    }
  }
  return stats;
}

async function backfillPos() {
  const stats = { scanned: 0, created: 0, skipped: 0, wouldCreate: 0 };
  const sales = await PosSale.find({ status: "completed" })
    .select("_id storeId total payment customer_id sale_number created_at")
    .lean()
    .limit(10000);
  for (const sale of sales) {
    stats.scanned += 1;
    const collected = Math.max(
      0,
      (Number(sale.payment?.amount_received) || Number(sale.total) || 0)
        - (Number(sale.payment?.change_due) || 0),
    );
    const amount = toMinor(collected);
    if (!(amount > 0)) continue;
    await runWithStore(sale.storeId, async () => {
      const result = await ensurePayment({
        direction: "in",
        method_code: normalizeMethod(sale.payment?.method || "cash"),
        amount_minor: amount,
        currency: "PKR",
        status: "captured",
        ref_type: "pos_sale",
        ref_id: sale._id,
        party_type: sale.customer_id ? "customer" : null,
        party_id: sale.customer_id || null,
        reference: sale.sale_number || "",
        idempotency_key: `pos_sale:${sale._id}:capture`,
        at: sale.created_at || new Date(),
      });
      if (result.created) stats.created += 1;
      else if (result.wouldCreate) stats.wouldCreate += 1;
      else stats.skipped += 1;
    });
  }
  return stats;
}

async function main() {
  await connectDB();
  console.log(APPLY ? "APPLY mode — writing Payment rows" : "Dry-run — pass --apply to write");
  const report = await runUnscoped(async () => ({
    orders: await backfillOrders(),
    invoices: await backfillInvoices(),
    pos: await backfillPos(),
  }));
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
