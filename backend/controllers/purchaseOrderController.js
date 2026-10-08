const mongoose = require("mongoose");
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchasePayment = require("../models/PurchasePayment");
const Vendor = require("../models/Vendor");
const Variant = require("../models/Variant");
const Product = require("../models/Product");
const StockHistory = require("../models/StockHistory");
const log = require("../utils/logger");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity } = require("../utils/activityHelper");

const emitPO = (event, data) => { try { const io = getIO(); if (io) io.emit(event, data); } catch {} };
const emitStock = (data) => emitPO("stockUpdated", data);
const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const generateNextPONumber = async () => {
  const pos = await PurchaseOrder.find({ po_number: { $regex: /^PO-\d+$/ } }).select("po_number").lean();
  let max = 0;
  for (const p of pos) { const n = parseInt(String(p.po_number).split("-")[1], 10); if (Number.isFinite(n) && n > max) max = n; }
  return `PO-${String(max + 1).padStart(5, "0")}`;
};
const getNextPONumber = async (req, res) => {
  try { res.status(200).json({ success: true, data: { nextCode: await generateNextPONumber() } }); }
  catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

const buildItems = async (rawItems) => {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new Error("At least one item is required");
  const items = [];
  let subtotal = 0, tax = 0;
  for (const r of rawItems) {
    const variant_id = r.variant_id;
    const qty = Number(r.qty_ordered ?? r.qty);
    const cost = Number(r.cost_price);
    if (!mongoose.isValidObjectId(String(variant_id))) throw new Error("Invalid variant_id");
    if (!Number.isInteger(qty) || qty < 1) throw new Error("qty_ordered must be integer >= 1");
    if (!Number.isFinite(cost) || cost < 0) throw new Error("cost_price must be >= 0");
    const variant = await Variant.findById(variant_id).lean();
    if (!variant) throw new Error("Variant not found");
    const product = await Product.findById(variant.product_id).lean();
    if (!product || product.is_deleted) throw new Error("Product not found or deleted");
    const taxRate = Math.min(100, Math.max(0, Number(r.tax_rate ?? 0)));
    const line_total = Math.round(cost * qty);
    subtotal += line_total;
    tax += Math.round(line_total * (taxRate / 100));
    items.push({
      product_id: product._id, variant_id: variant._id, name: product.name,
      sku: variant.sku || "", variantTitle: variant.title || "", image: variant.images?.[0]?.img_url || "",
      cost_price: cost, sell_price: Math.max(0, Number(r.sell_price ?? variant.selling_price) || 0),
      qty_ordered: qty, received_qty: 0, line_total, tax_rate: taxRate,
      batch_no: String(r.batch_no || ""), mfg_date: r.mfg_date || null, expiry_date: r.expiry_date || null,
      topup: Number(r.topup) || 0,
    });
  }
  return { items, subtotal: Math.round(subtotal), tax: Math.round(tax) };
};

const createPO = async (req, res) => {
  try {
    const { vendor_id, items: rawItems, shipping = 0, discount = 0, expected_date, due_date, notes } = req.body;
    const vendor = await Vendor.findOne({ _id: vendor_id, is_deleted: false });
    if (!vendor) return res.status(400).json({ success: false, message: "Vendor not found" });
    if (!vendor.is_active) return res.status(400).json({ success: false, message: "Vendor is inactive" });
    const { items, subtotal, tax } = await buildItems(rawItems);
    const ship = Math.max(0, Number(shipping) || 0), disc = Math.max(0, Number(discount) || 0);
    const total = Math.max(0, Math.round(subtotal + tax + ship - disc));
    let po = null;
    for (let i = 0; i < 5; i++) {
      try {
        po = await PurchaseOrder.create({
          po_number: await generateNextPONumber(), vendor_id: vendor._id,
          vendor_snapshot: { name: vendor.name, company_name: vendor.company_name, phone: vendor.phone, email: vendor.email, address: vendor.address, city: vendor.city },
          items, subtotal, tax, shipping: ship, discount: disc, total,
          status: "pending", payment_status: "unpaid", paid_amount: 0, due_amount: total,
          expected_date: expected_date || null, due_date: due_date || null, notes: notes || "",
          createdby: req.user?._id || null,
        });
        break;
      } catch (e) { if (e.code === 11000 && i < 4) continue; throw e; }
    }
    emitPO("po:created", { success: true, data: po });
    res.status(201).json({ success: true, data: po });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

const getAllPOs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const { status = "all", vendor = "all", payment_status = "all", search = "" } = req.query;
    const q = { is_deleted: { $ne: true } };
    if (status !== "all") q.status = status;
    if (payment_status !== "all") q.payment_status = payment_status;
    if (vendor !== "all" && mongoose.isValidObjectId(String(vendor))) q.vendor_id = vendor;
    if (String(search).trim()) { const rx = new RegExp(escapeRegex(String(search).trim()), "i"); q.$or = [{ po_number: rx }, { "vendor_snapshot.name": rx }]; }
    const [pos, total] = await Promise.all([
      PurchaseOrder.find(q).populate("vendor_id", "name vendor_code").sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      PurchaseOrder.countDocuments(q),
    ]);
    res.status(200).json({ success: true, data: pos, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

const getPOByIdAdmin = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate("vendor_id", "name vendor_code phone email").lean();
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found" });
    const legacyVariantIds = (po.items || [])
      .filter((item) => item.sell_price == null)
      .map((item) => item.variant_id);
    const [payments, legacyVariants] = await Promise.all([
      PurchasePayment.find({ po_id: po._id }).sort({ created_at: -1 }).lean(),
      legacyVariantIds.length ? Variant.find({ _id: { $in: legacyVariantIds } }).select("selling_price").lean() : [],
    ]);
    const currentSellPriceByVariant = new Map(legacyVariants.map((variant) => [String(variant._id), Number(variant.selling_price) || 0]));
    const items = (po.items || []).map((item) => ({
      ...item,
      sell_price: item.sell_price ?? currentSellPriceByVariant.get(String(item.variant_id)) ?? 0,
    }));
    const safePayments = payments
      .map((payment) => Object.fromEntries(Object.entries(payment).filter(([key]) => !["reference", "notes"].includes(key))));
    res.status(200).json({ success: true, data: { ...po, items, payments: safePayments } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

const updatePO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found" });
    if (po.status !== "pending") return res.status(400).json({ success: false, message: "Only pending POs can be edited" });
    const { items: rawItems, shipping, discount, expected_date, due_date, notes } = req.body;
    if (rawItems) {
      const { items, subtotal, tax } = await buildItems(rawItems);
      po.items = items; po.subtotal = subtotal; po.tax = tax;
    }
    if (shipping !== undefined) po.shipping = Math.max(0, Number(shipping) || 0);
    if (discount !== undefined) po.discount = Math.max(0, Number(discount) || 0);
    po.total = Math.max(0, Math.round(po.subtotal + po.tax + po.shipping - po.discount));
    po.due_amount = Math.max(0, po.total - po.paid_amount);
    if (expected_date !== undefined) po.expected_date = expected_date || null;
    if (due_date !== undefined) po.due_date = due_date || null;
    if (notes !== undefined) po.notes = notes || "";
    po.updatedby = req.user?._id || null;
    await po.save();
    emitPO("po:updated", { success: true, data: po });
    res.status(200).json({ success: true, data: po });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

const transition = (from, to) => async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found" });
    if (!from.includes(po.status)) return res.status(400).json({ success: false, message: `Cannot ${to} from status ${po.status}` });
    if (to === "cancelled") {
      if (!String(req.body?.cancel_reason || "").trim()) return res.status(400).json({ success: false, message: "cancel_reason is required" });
      po.cancel_reason = String(req.body.cancel_reason).trim();
    }
    po.status = to;
    po.updatedby = req.user?._id || null;
    await po.save();
    emitPO("po:updated", { success: true, data: po });
    res.status(200).json({ success: true, message: `PO ${to}`, data: po });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};
const confirmPO = transition(["pending"], "confirmed");
const cancelPO = transition(["pending", "confirmed"], "cancelled");
const closePO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found" });
    if (po.status !== "delivered") return res.status(400).json({ success: false, message: "Only delivered POs can be closed" });
    po.status = "closed"; po.updatedby = req.user?._id || null;
    await po.save();
    emitPO("po:updated", { success: true, data: po });
    res.status(200).json({ success: true, message: "PO closed", data: po });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

const supportsTx = async () => {
  try { const admin = mongoose.connection.db.admin(); const hello = await admin.hello(); return !!hello.setName; }
  catch { return false; }
};

const deliverPO = async (req, res) => {
  const useTx = await supportsTx();
  let session = null;
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found" });
    // Idempotency: delivering twice must NOT add stock twice.
    if (["delivered", "closed"].includes(po.status)) {
      return res.status(200).json({ success: true, message: `PO already ${po.status} — no stock change`, data: po });
    }
    if (po.status !== "confirmed") return res.status(400).json({ success: false, message: `Cannot deliver in status ${po.status}. Confirm PO first.` });
    const invoice_no = String(req.body?.invoice_no || "").trim();
    const explanation = String(req.body?.explanation || "All remaining items received").trim();
    const lines = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!lines.length) return res.status(400).json({ success: false, message: "items required" });
    if (invoice_no && po.receivings?.some((r) => r.invoice_no === invoice_no)) return res.status(400).json({ success: false, message: "Duplicate invoice_no for this PO" });

    const norm = [];
    for (const l of lines) {
      const qty = Number(l.qty);
      if (!mongoose.isValidObjectId(String(l.variant_id))) return res.status(400).json({ success: false, message: "Invalid variant_id" });
      if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ success: false, message: "qty must be integer >= 1" });
      const item = po.items.find((i) => String(i.variant_id) === String(l.variant_id));
      if (!item) return res.status(400).json({ success: false, message: "Variant not in PO" });
      const remaining = item.qty_ordered - item.received_qty;
      if (qty > remaining) return res.status(400).json({ success: false, message: `Over-receive: only ${remaining} remaining for ${item.sku || item.name}` });
      norm.push({ variant_id: item.variant_id, product_id: item.product_id, qty, item });
    }
    // Delivered means the complete ordered quantity arrived — no partial state.
    const notFull = po.items.some((i) => {
      const add = norm.find((n) => String(n.variant_id) === String(i.variant_id))?.qty || 0;
      return i.received_qty + add < i.qty_ordered;
    });
    if (notFull) return res.status(400).json({ success: false, message: "Deliver the full ordered quantity for all lines" });

    if (useTx) { session = await mongoose.startSession(); session.startTransaction(); }
    const touched = [];
    for (const n of norm) {
      const variant = await Variant.findById(n.variant_id).session(session || null);
      if (!variant) throw new Error("Variant not found");
      const prev = variant.quantity ?? 0;
      await Variant.updateOne(
        { _id: variant._id },
        {
          $inc: { quantity: n.qty },
          $set: {
            cost_price: Math.max(0, Number(n.item.cost_price) || 0),
            selling_price: Math.max(0, Number(n.item.sell_price) || 0),
          },
        },
        { session },
      );
      await StockHistory.create([{
        variant_id: variant._id, product_id: n.product_id, product_name: n.item.name,
        sku: n.item.sku || variant.sku || "", variant_title: n.item.variantTitle || variant.title || "",
        previous_quantity: prev, new_quantity: prev + n.qty, change_quantity: n.qty,
        adjustment_type: "add", reason: "purchase",
        explanation: `${explanation} | PO ${po.po_number}${invoice_no ? ` | Inv ${invoice_no}` : " | No invoice provided"}`,
        performed_by: req.user?._id || null, performed_by_name: req.user?.name || "Admin",
      }], { session });
      n.item.received_qty += n.qty;
      touched.push({ variant_id: variant._id, change: n.qty });
    }
    po.receivings.push({ invoice_no, explanation, items: norm.map((n) => ({ variant_id: n.variant_id, product_id: n.product_id, qty: n.qty })), received_by: req.user?._id || null, received_by_name: req.user?.name || "Admin" });
    po.status = "delivered";
    po.updatedby = req.user?._id || null;
    await po.save({ session });
    if (session) await session.commitTransaction();
    emitStock({ variants: touched, source: "po_delivered" });
    emitPO("po:delivered", { success: true, data: po });
    emitPO("po:updated", { success: true, data: po });
    res.status(200).json({ success: true, message: "PO delivered — inventory updated", data: po });
  } catch (e) {
    if (session) { try { await session.abortTransaction(); } catch {} }
    log.error("deliverPO error:", e.message);
    res.status(400).json({ success: false, message: e.message });
  } finally { if (session) { try { await session.endSession(); } catch {} } }
};
// Legacy alias — the old POST .../receive endpoint maps to the same deliver logic.
const receivePO = deliverPO;

const recordPOPayment = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found" });
    // Payment is separate from delivery — allowed only after goods arrived.
    if (!["delivered", "closed"].includes(po.status)) return res.status(400).json({ success: false, message: "Payment allowed only after delivery" });
    const amount = Number(req.body?.amount);
    const method = String(req.body?.method || "");
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: "amount must be > 0" });
    if (!["bank", "cash", "cod", "credit", "advance_adjust"].includes(method)) return res.status(400).json({ success: false, message: "Invalid method" });
    if (po.paid_amount + amount > po.total + 0.001) return res.status(400).json({ success: false, message: `Over-pay: due is ${po.total - po.paid_amount}` });
    const pay = await PurchasePayment.create({
      po_id: po._id, vendor_id: po.vendor_id, amount, method,
      paid_at: req.body?.paid_at || new Date(), createdby: req.user?._id || null,
    });
    po.paid_amount = Math.round((po.paid_amount + amount) * 100) / 100;
    po.due_amount = Math.max(0, Math.round((po.total - po.paid_amount) * 100) / 100);
    po.payment_status = po.paid_amount <= 0 ? "unpaid" : po.paid_amount >= po.total ? "paid" : "partial";
    if (po.payment_status === "paid") po.status = "closed";
    await po.save();
    await Vendor.updateOne({ _id: po.vendor_id }, { $inc: { total_paid: amount }, $set: { balance_payable: Math.max(0, po.total - po.paid_amount) } }).catch(() => {});
    const sums = await PurchasePayment.aggregate([{ $match: { vendor_id: po.vendor_id } }, { $group: { _id: null, paid: { $sum: "$amount" } } }]);
    const poSums = await PurchaseOrder.aggregate([{ $match: { vendor_id: po.vendor_id, is_deleted: { $ne: true } } }, { $group: { _id: null, purchased: { $sum: "$total" } } }]);
    await Vendor.updateOne({ _id: po.vendor_id }, { $set: { total_paid: sums[0]?.paid || 0, total_purchased: poSums[0]?.purchased || 0, balance_payable: Math.max(0, (poSums[0]?.purchased || 0) - (sums[0]?.paid || 0)) } }).catch(() => {});
    emitPO("po:paymentUpdated", { success: true, data: po });
    res.status(200).json({ success: true, data: { po, payment: pay } });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

module.exports = { getNextPONumber, createPO, getAllPOs, getPOByIdAdmin, updatePO, confirmPO, cancelPO, closePO, deliverPO, receivePO, recordPOPayment };
