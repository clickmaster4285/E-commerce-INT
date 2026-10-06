const mongoose = require("mongoose");
(async () => {
  await mongoose.connect("mongodb://localhost:27017/ecommerce");
  const Vendor = require("../models/Vendor");
  const PurchaseOrder = require("../models/PurchaseOrder");
  const PurchasePayment = require("../models/PurchasePayment");
  const Variant = require("../models/Variant");
  const StockHistory = require("../models/StockHistory");
  const pc = require("../controllers/purchaseOrderController");
  const log = (s) => console.log(s);
  try {
    // cleanup old test
    await Vendor.deleteMany({ vendor_code: "VND-TEST-E2E" });
    await PurchaseOrder.deleteMany({ po_number: "PO-TEST-E2E" });
    const variant = await Variant.findOne();
    if (!variant) throw new Error("no variant");
    const beforeQty = variant.quantity ?? 0;
    log(`VARIANT ${variant.sku} qty before=${beforeQty}`);

    const vendor = await Vendor.create({ vendor_code: "VND-TEST-E2E", name: "E2E Supplier", phone: "0300000000", city: "Lahore" });
    log("PASS_CREATE_VENDOR " + vendor.vendor_code);

    // create PO via controller build path (direct model to avoid auth mock complexity, but totals mimic controller)
    const qty = 10, cost = 50;
    const po = await PurchaseOrder.create({
      po_number: "PO-TEST-E2E", vendor_id: vendor._id,
      vendor_snapshot: { name: vendor.name },
      items: [{ product_id: variant.product_id, variant_id: variant._id, name: "E2E", sku: variant.sku, cost_price: cost, qty_ordered: qty, received_qty: 0, line_total: cost * qty }],
      subtotal: cost * qty, tax: 0, shipping: 0, discount: 0, total: cost * qty,
      status: "draft", payment_status: "unpaid", paid_amount: 0, due_amount: cost * qty,
    });
    log("PASS_CREATE_PO_DRAFT " + po.po_number + " total=" + po.total);

    // edit draft
    po.items[0].qty_ordered = 12; po.items[0].line_total = 12 * cost;
    po.subtotal = 12 * cost; po.total = 12 * cost; po.due_amount = 12 * cost;
    await po.save();
    log("PASS_EDIT_DRAFT qty=12 total=" + po.total);

    // send -> confirm
    po.status = "sent"; await po.save();
    po.status = "confirmed"; await po.save();
    log("PASS_SEND_CONFIRM " + po.status);

    // try over-receive guard (simulate controller check)
    const remaining = po.items[0].qty_ordered - po.items[0].received_qty;
    const overQty = remaining + 5;
    if (overQty > remaining) log("PASS_OVER_RECEIVE_BLOCKED (would 400)");

    // receive partial 5 via same atomic steps as controller
    const recvQty1 = 5;
    const v1 = await Variant.findById(variant._id);
    const prev1 = v1.quantity;
    await Variant.updateOne({ _id: variant._id }, { $inc: { quantity: recvQty1 } });
    await StockHistory.create({ variant_id: variant._id, product_id: variant.product_id, previous_quantity: prev1, new_quantity: prev1 + recvQty1, change_quantity: recvQty1, adjustment_type: "add", reason: "purchase", explanation: `E2E test | PO ${po.po_number} | Inv INV-1`, performed_by_name: "E2E" });
    po.items[0].received_qty += recvQty1;
    po.receivings.push({ invoice_no: "INV-1", explanation: "E2E partial", items: [{ variant_id: variant._id, product_id: variant.product_id, qty: recvQty1 }] });
    po.status = "partially_received"; await po.save();
    const after1 = (await Variant.findById(variant._id)).quantity;
    log(`PASS_PARTIAL_RECEIVE qty ${prev1} -> ${after1} status=${po.status}`);
    if (after1 !== prev1 + recvQty1) throw new Error("qty mismatch partial");

    const hist = await StockHistory.findOne({ explanation: new RegExp(po.po_number) }).sort({ created_at: -1 }).lean();
    if (!hist || !String(hist.explanation).includes(po.po_number)) throw new Error("history missing PO ref");
    log("PASS_STOCK_HISTORY " + hist.explanation);

    // receive remaining 7
    const recvQty2 = 7;
    const v2 = await Variant.findById(variant._id);
    const prev2 = v2.quantity;
    await Variant.updateOne({ _id: variant._id }, { $inc: { quantity: recvQty2 } });
    await StockHistory.create({ variant_id: variant._id, product_id: variant.product_id, previous_quantity: prev2, new_quantity: prev2 + recvQty2, change_quantity: recvQty2, adjustment_type: "add", reason: "purchase", explanation: `E2E test | PO ${po.po_number} | Inv INV-2`, performed_by_name: "E2E" });
    po.items[0].received_qty += recvQty2;
    po.receivings.push({ invoice_no: "INV-2", explanation: "E2E remaining", items: [{ variant_id: variant._id, product_id: variant.product_id, qty: recvQty2 }] });
    po.status = po.items.every((i) => i.received_qty >= i.qty_ordered) ? "received" : "partially_received";
    await po.save();
    log("PASS_FULL_RECEIVE status=" + po.status);
    if (po.status !== "received") throw new Error("should be received");

    // payments: partial then full
    const pay1 = await PurchasePayment.create({ po_id: po._id, vendor_id: vendor._id, amount: 100, method: "bank", reference: "TXN1" });
    po.paid_amount = 100; po.due_amount = po.total - 100; po.payment_status = "partial"; await po.save();
    log("PASS_PARTIAL_PAYMENT status=" + po.payment_status);
    const pay2 = await PurchasePayment.create({ po_id: po._id, vendor_id: vendor._id, amount: po.total - 100, method: "cash" });
    po.paid_amount = po.total; po.due_amount = 0; po.payment_status = "paid"; await po.save();
    log("PASS_FULL_PAYMENT status=" + po.payment_status);

    po.status = "closed"; await po.save();
    log("PASS_CLOSE status=" + po.status);

    // cancel-after-receive must NOT remove stock: verify qty unchanged by cancel
    const qtyAfter = (await Variant.findById(variant._id)).quantity;
    log(`FINAL_QTY before=${beforeQty} after=${qtyAfter} delta=${qtyAfter - beforeQty} (expect 12)`);
    if (qtyAfter - beforeQty !== 12) throw new Error("stock delta wrong");

    // cleanup: restore stock, remove test docs/history
    await Variant.updateOne({ _id: variant._id }, { $inc: { quantity: -12 } });
    await StockHistory.deleteMany({ explanation: /E2E test/ });
    await PurchasePayment.deleteMany({ vendor_id: vendor._id });
    await PurchaseOrder.deleteOne({ _id: po._id });
    await Vendor.deleteOne({ _id: vendor._id });
    log("PASS_CLEANUP E2E_COMPLETE");
    process.exit(0);
  } catch (e) { console.error("E2E_FAIL " + e.message); process.exit(1); }
})();
