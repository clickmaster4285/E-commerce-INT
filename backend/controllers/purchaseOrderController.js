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
const { auditEvent, diffFields, diffItems } = require("../utils/auditHistory");

const emitPO = (event, data) => { try { const io = getIO(); if (io) io.emit(event, data); } catch {} };
const emitStock = (data) => emitPO("stockUpdated", data);
const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ==========================================
// 🌐 LOCALE + SLIM HELPERS — admin purchase orders (brands/banner/vendors ka exact pattern)
//    Paginated rows + detail response me sirf FRONT fields jate hain —
//    internals (translation_source/status, deleted flags, __v) bahar.
//    Translations sirf selected locale ki trim hoti hain.
// ==========================================
const parsePOLocale = (value) => {
  const requestedLocale = String(value || "en").trim().toLowerCase();
  return /^[a-z]{2}$/.test(requestedLocale) ? requestedLocale : "en";
};

// ✅ PO ki slim translation (notes/cancel_reason) — sirf requested locale
const slimPOTranslations = (po, locale) => {
  if (locale === "en" || !po.translations) return null;
  const out = {};
  ["notes", "cancel_reason"].forEach((field) => {
    const value = po.translations?.[field]?.[locale];
    if (typeof value === "string" && value.trim()) out[field] = { [locale]: value };
  });
  return Object.keys(out).length ? out : {};
};

// ✅ Populated docs (Vendor/Product/Variant) sirf unke front fields + selected
//    locale ki slim translation (poora translations map payload me nahi jata)
const slimPORef = (doc, locale) => {
  if (!doc || typeof doc !== "object" || !doc._id) return doc; // ObjectId fallback
  const out = { _id: doc._id };
  ["name", "title"].forEach((field) => {
    if (doc[field] !== undefined) out[field] = doc[field];
  });
  if (locale !== "en" && doc.translations && typeof doc.translations === "object") {
    const t = {};
    ["name", "title"].forEach((field) => {
      const value = doc.translations?.[field]?.[locale];
      if (typeof value === "string" && value.trim()) t[field] = { [locale]: value };
    });
    if (Object.keys(t).length) out.translations = t;
  }
  return out;
};

// ✅ PO row ka vendor ref — list sirf name/code, detail card snapshot fields ke saath
const slimPOVendor = (vendor, locale) => {
  if (!vendor || typeof vendor !== "object" || !vendor._id) return vendor; // ObjectId fallback
  const out = { _id: vendor._id, name: vendor.name, vendor_code: vendor.vendor_code };
  if (vendor.is_active !== undefined) out.is_active = vendor.is_active;
  ["company_name", "phone", "email", "address", "city"].forEach((field) => {
    if (vendor[field]) out[field] = vendor[field];
  });
  if (locale !== "en" && vendor.translations && typeof vendor.translations === "object") {
    const t = {};
    ["name", "company_name", "address", "city"].forEach((field) => {
      const value = vendor.translations?.[field]?.[locale];
      if (typeof value === "string" && value.trim()) t[field] = { [locale]: value };
    });
    if (Object.keys(t).length) out.translations = t;
  }
  return out;
};

// ✅ Server-side sorting whitelist — sort key -> DB field
const PO_SORT_FIELDS = {
  po_number: "po_number",
  vendor: "vendor_snapshot.name",
  status: "status",
  payment: "payment_status",
  total: "total",
  expected: "expected_date",
  created: "created_at",
};

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
    const sellPrice = Math.max(0, Number(r.sell_price ?? variant.selling_price) || 0);
    if (cost > sellPrice) {
      throw new Error(`Cost price cannot exceed sell price for ${product.name} (${variant.title || variant.sku || "variant"}). Please correct the price.`);
    }
    const expiryAfterDelivery = r.expiry_after_delivery === undefined
      ? Math.max(0, Number(variant.expiry_after_delivery) || 0)
      : Number(r.expiry_after_delivery);
    if (!Number.isInteger(expiryAfterDelivery) || expiryAfterDelivery < 0) {
      throw new Error("expiry_after_delivery must be a nonnegative whole number");
    }
    const expiryUnit = r.expiry_after_delivery_unit || variant.expiry_after_delivery_unit || "days";
    if (!["days", "months", "years"].includes(expiryUnit)) {
      throw new Error("expiry_after_delivery_unit must be days, months, or years");
    }
    const taxRate = Math.min(100, Math.max(0, Number(r.tax_rate ?? 0)));
    const line_total = Math.round(cost * qty);
    subtotal += line_total;
    tax += Math.round(line_total * (taxRate / 100));
    items.push({
      product_id: product._id, variant_id: variant._id, name: product.name,
      sku: variant.sku || "", variantTitle: variant.title || "", image: variant.images?.[0]?.img_url || "",
      cost_price: cost, sell_price: sellPrice,
      qty_ordered: qty, received_qty: 0, line_total, tax_rate: taxRate,
      batch_no: String(r.batch_no || ""), mfg_date: r.mfg_date || null, expiry_date: r.expiry_date || null,
      expiry_after_delivery: expiryAfterDelivery, expiry_after_delivery_unit: expiryUnit,
      topup: Number(r.topup) || 0,
    });
  }
  return { items, subtotal: Math.round(subtotal), tax: Math.round(tax) };
};

const createPO = async (req, res) => {
  try {
    const { vendor_id, items: rawItems, shipping = 0, discount = 0, overall_tax = 0, overall_tax_rate = 0, expected_date, due_date, notes } = req.body;
    const vendor = await Vendor.findOne({ _id: vendor_id, is_deleted: false });
    if (!vendor) return res.status(400).json({ success: false, message: "Vendor not found" });
    if (!vendor.is_active) return res.status(400).json({ success: false, message: "Vendor is inactive" });
    const { items, subtotal, tax } = await buildItems(rawItems);
    const ship = Math.max(0, Number(shipping) || 0), disc = Math.max(0, Number(discount) || 0), extraTax = Math.max(0, Number(overall_tax) || 0);
    const total = Math.max(0, Math.round(subtotal + tax + extraTax + ship - disc));
    let po = null;
    for (let i = 0; i < 5; i++) {
      try {
        po = await PurchaseOrder.create({
          po_number: await generateNextPONumber(), vendor_id: vendor._id,
          vendor_snapshot: { name: vendor.name, company_name: vendor.company_name, phone: vendor.phone, email: vendor.email, address: vendor.address, city: vendor.city },
          items, subtotal, tax, overall_tax: extraTax, overall_tax_rate: Math.min(100, Math.max(0, Number(overall_tax_rate) || 0)), shipping: ship, discount: disc, total,
          status: "pending", payment_status: "unpaid", paid_amount: 0, due_amount: total,
          expected_date: expected_date || null, due_date: due_date || null, notes: notes || "",
          createdby: req.user?._id || null,
          activity: [auditEvent(req, "created", [
            { field: "Purchase order", before: "—", after: String(vendor.name || "Vendor") },
            ...diffItems([], items, { itemFields: { cost_price: "Cost price" } }),
            { field: "Total", before: "—", after: String(total) },
          ])],
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
    const locale = parsePOLocale(req.query.locale);
    const status = String(req.query.status || "all");
    const vendor = String(req.query.vendor || "all");
    const payment_status = String(req.query.payment_status || "all");
    const range = String(req.query.range || "all");
    const search = String(req.query.search || "").trim();
    const q = { is_deleted: { $ne: true } };
    if (status !== "all") q.status = status;
    if (payment_status !== "all") q.payment_status = payment_status;
    if (vendor !== "all" && mongoose.isValidObjectId(vendor)) q.vendor_id = vendor;
    if (["7", "30", "90"].includes(range)) q.created_at = { $gte: new Date(Date.now() - Number(range) * 86400000) };
    if (search) { const rx = new RegExp(escapeRegex(search), "i"); q.$or = [{ po_number: rx }, { "vendor_snapshot.name": rx }, { status: rx }]; }

    // ✅ Sorting bhi server par hoti hai (whitelist ke ilawa koi custom field nahi).
    //    Default: created_at desc (legacy jaisa) — ties par _id stable order.
    const sortKeyRaw = String(req.query.sort || "").trim();
    const hasSort = Boolean(PO_SORT_FIELDS[sortKeyRaw]);
    const sortField = hasSort ? PO_SORT_FIELDS[sortKeyRaw] : "created_at";
    const sortOrder = hasSort ? (String(req.query.order || "").trim().toLowerCase() === "asc" ? 1 : -1) : -1;

    // ✅ Counts meta — stat cards poore collection ke (current page ke POs se nahi)
    const statAgg = await PurchaseOrder.aggregate([
      { $match: { is_deleted: { $ne: true } } },
      { $group: { _id: "$status", count: { $sum: 1 }, value: { $sum: "$total" } } },
    ]);
    const counts = { total: 0, pending: 0, received: 0, cancelled: 0, value: 0 };
    for (const row of statAgg) {
      counts.total += row.count || 0;
      counts.value += Number(row.value) || 0;
      if (["pending", "confirmed"].includes(row._id)) counts.pending += row.count || 0;
      else if (["delivered", "closed"].includes(row._id)) counts.received += row.count || 0;
      else if (row._id === "cancelled") counts.cancelled += row.count || 0;
    }

    const [pos, total] = await Promise.all([
      PurchaseOrder.find(q).select("po_number vendor_id vendor_snapshot status payment_status total expected_date created_at items.qty_ordered items.received_qty")
        .populate("vendor_id", "name vendor_code is_active company_name phone email address city translations")
        .sort({ [sortField]: sortOrder, _id: 1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      PurchaseOrder.countDocuments(q),
    ]);
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);

    // ✅ Har row me sirf front-visible fields — receive % sirf qty counts se,
    //    item details/populated products/variants list page me display nahi hote.
    const rows = pos.map((po) => ({
      _id: po._id,
      po_number: po.po_number,
      status: po.status,
      payment_status: po.payment_status,
      total: po.total,
      expected_date: po.expected_date || null,
      created_at: po.created_at,
      vendor_id: slimPOVendor(po.vendor_id, locale),
      vendor_snapshot: { name: po.vendor_snapshot?.name || "" },
      items: (po.items || []).map((item) => ({ qty_ordered: Number(item.qty_ordered) || 0, received_qty: Number(item.received_qty) || 0 })),
    }));

    res.status(200).json({
      success: true,
      data: rows,
      counts,
      pagination: { total, page: safePage, limit, pages, totalPages: pages, hasNext: safePage < pages, hasPrev: safePage > 1 },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

const getPOByIdAdmin = async (req, res) => {
  try {
    const locale = parsePOLocale(req.query.locale);
    const po = await PurchaseOrder.findById(req.params.id).populate("vendor_id", "name vendor_code company_name phone email address city is_active translations").populate("items.product_id", "name translations").populate("items.variant_id", "title translations").populate("createdby", "name").lean();
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found" });
    const legacyVariantIds = (po.items || [])
      .filter((item) => item.sell_price == null)
      .map((item) => item.variant_id);
    const [payments, legacyVariants] = await Promise.all([
      PurchasePayment.find({ po_id: po._id }).sort({ created_at: -1 }).lean(),
      legacyVariantIds.length ? Variant.find({ _id: { $in: legacyVariantIds } }).select("selling_price").lean() : [],
    ]);
    const currentSellPriceByVariant = new Map(legacyVariants.map((variant) => [String(variant._id), Number(variant.selling_price) || 0]));

    // ✅ Items — detail page + edit form (new?edit=) ke saare snapshot fields,
    //    batch_no/internals bahar; populated product/variant locale-slim.
    const items = (po.items || []).map((item) => ({
      product_id: slimPORef(item.product_id, locale),
      variant_id: slimPORef(item.variant_id, locale),
      name: item.name,
      sku: item.sku || "",
      variantTitle: item.variantTitle || "",
      image: item.image || "",
      cost_price: item.cost_price,
      sell_price: item.sell_price ?? currentSellPriceByVariant.get(String(item.variant_id)) ?? 0,
      qty_ordered: item.qty_ordered,
      received_qty: item.received_qty || 0,
      line_total: item.line_total,
      tax_rate: item.tax_rate || 0,
      mfg_date: item.mfg_date || null,
      expiry_date: item.expiry_date || null,
      expiry_after_delivery: item.expiry_after_delivery || 0,
      expiry_after_delivery_unit: item.expiry_after_delivery_unit || "days",
      topup: Number(item.topup) || 0,
    }));
    // ✅ Payments — sirf front fields (reference/notes pehle se hi strip the)
    const safePayments = payments.map((payment) => ({
      _id: payment._id,
      po_id: payment.po_id,
      amount: payment.amount,
      method: payment.method,
      paid_at: payment.paid_at,
      created_at: payment.created_at,
    }));

    const responsePO = {
      _id: po._id,
      po_number: po.po_number,
      status: po.status,
      payment_status: po.payment_status,
      paid_amount: po.paid_amount,
      due_amount: po.due_amount,
      subtotal: po.subtotal,
      tax: po.tax,
      overall_tax: po.overall_tax,
      overall_tax_rate: po.overall_tax_rate,
      shipping: po.shipping,
      discount: po.discount,
      total: po.total,
      expected_date: po.expected_date || null,
      notes: po.notes || "",
      cancel_reason: po.cancel_reason || "",
      created_at: po.created_at,
      vendor_id: slimPOVendor(po.vendor_id, locale),
      vendor_snapshot: po.vendor_snapshot ? { ...po.vendor_snapshot } : {},
      items,
      payments: safePayments,
      activity: po.activity || [],
      createdby: po.createdby ? { _id: po.createdby._id, name: po.createdby.name } : null,
    };
    // ✅ Selected locale ki slim translation (notes/cancel_reason)
    const poTranslations = slimPOTranslations(po, locale);
    if (poTranslations) responsePO.translations = poTranslations;

    res.status(200).json({ success: true, data: responsePO });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

const updatePO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found" });
    if (po.status !== "pending") return res.status(400).json({ success: false, message: "Only pending POs can be edited" });
    const before = po.toObject();
    const { vendor_id, items: rawItems, shipping, discount, overall_tax, overall_tax_rate, expected_date, due_date, notes } = req.body;
    if (vendor_id && String(vendor_id) !== String(po.vendor_id)) {
      const vendor = await Vendor.findOne({ _id: vendor_id, is_deleted: false, is_active: true });
      if (!vendor) return res.status(400).json({ success: false, message: "Vendor not found or inactive" });
      po.vendor_id = vendor._id;
      po.vendor_snapshot = { name: vendor.name, company_name: vendor.company_name, phone: vendor.phone, email: vendor.email, address: vendor.address, city: vendor.city };
    }
    if (rawItems) {
      const { items, subtotal, tax } = await buildItems(rawItems);
      po.items = items; po.subtotal = subtotal; po.tax = tax;
    }
    if (shipping !== undefined) po.shipping = Math.max(0, Number(shipping) || 0);
    if (discount !== undefined) po.discount = Math.max(0, Number(discount) || 0);
    if (overall_tax !== undefined) po.overall_tax = Math.max(0, Number(overall_tax) || 0);
    if (overall_tax_rate !== undefined) po.overall_tax_rate = Math.min(100, Math.max(0, Number(overall_tax_rate) || 0));
    po.total = Math.max(0, Math.round(po.subtotal + po.tax + po.overall_tax + po.shipping - po.discount));
    po.due_amount = Math.max(0, po.total - po.paid_amount);
    if (expected_date !== undefined) po.expected_date = expected_date || null;
    if (due_date !== undefined) po.due_date = due_date || null;
    if (notes !== undefined) po.notes = notes || "";
    po.updatedby = req.user?._id || null;
    const changes = [
      ...diffFields(before, po.toObject(), [["shipping", "Shipping"], ["discount", "Discount"], ["overall_tax", "Additional tax"], ["overall_tax_rate", "Additional tax rate"], ["expected_date", "Expected delivery"], ["due_date", "Due date"], ["notes", "Notes"], ["subtotal", "Subtotal"], ["tax", "Tax"], ["total", "Total"]]),
      ...(rawItems ? diffItems(before.items, po.items, { itemFields: { cost_price: "Cost price", sell_price: "Selling price", tax_rate: "Tax rate", expiry_after_delivery: "Expiry period", expiry_after_delivery_unit: "Expiry unit" } }) : []),
    ];
    if (changes.length) po.activity.push(auditEvent(req, "updated", changes));
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
    const beforeStatus = po.status;
    po.status = to;
    po.updatedby = req.user?._id || null;
    po.activity.push(auditEvent(req, "status", [
      { field: "Status", before: beforeStatus, after: to },
      ...(to === "cancelled" && po.cancel_reason ? [{ field: "Cancellation reason", before: "—", after: po.cancel_reason }] : []),
    ]));
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
    po.activity.push(auditEvent(req, "status", [{ field: "Status", before: "delivered", after: "closed" }]));
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
      norm.push({ variant_id: item.variant_id, product_id: item.product_id, qty, item, priorReceived: Number(item.received_qty) || 0 });
    }
    // Delivered means the complete ordered quantity arrived — no partial state.
    const notFull = po.items.some((i) => {
      const add = norm.find((n) => String(n.variant_id) === String(i.variant_id))?.qty || 0;
      return i.received_qty + add < i.qty_ordered;
    });
    if (notFull) return res.status(400).json({ success: false, message: "Deliver the full ordered quantity for all lines" });

    if (useTx) { session = await mongoose.startSession(); session.startTransaction(); }
    const touched = [];
    const receivedAt = new Date();
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
            expiry_after_delivery: Math.max(0, Number(n.item.expiry_after_delivery) || 0),
            expiry_after_delivery_unit: n.item.expiry_after_delivery_unit || "days",
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
    po.receivings.push({ received_at: receivedAt, invoice_no, explanation, items: norm.map((n) => ({ variant_id: n.variant_id, product_id: n.product_id, qty: n.qty })), received_by: req.user?._id || null, received_by_name: req.user?.name || "Admin" });
    po.activity.push(auditEvent(req, "received", [
      { field: "Status", before: "confirmed", after: "delivered" },
      ...(invoice_no ? [{ field: "Supplier invoice", before: "—", after: invoice_no }] : []),
      { field: "Receiving note", before: "—", after: explanation },
      ...norm.map(({ item, qty, priorReceived }) => ({ action: "received", field: "Received quantity", product_name: item.name, variant_title: item.variantTitle || "", sku: item.sku || "", before: String(priorReceived), after: String(priorReceived + qty), from_quantity: priorReceived, to_quantity: priorReceived + qty })),
    ]));
    po.status = "delivered";
    po.updatedby = req.user?._id || null;
    await po.save({ session });
    if (session) await session.commitTransaction();
    emitStock({ variants: touched, source: "po_delivered" });
    emitPO("po:delivered", { success: true, data: po });
    emitPO("po:updated", { success: true, data: po });
    res.status(200).json({ success: true, message: "PO delivered — inventory, prices, and expiry settings updated", data: po });
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
    const oldPaidAmount = po.paid_amount;
    const oldDueAmount = po.due_amount;
    const oldStatus = po.status;
    po.paid_amount = Math.round((po.paid_amount + amount) * 100) / 100;
    po.due_amount = Math.max(0, Math.round((po.total - po.paid_amount) * 100) / 100);
    po.payment_status = po.paid_amount <= 0 ? "unpaid" : po.paid_amount >= po.total ? "paid" : "partial";
    if (po.payment_status === "paid") po.status = "closed";
    po.activity.push(auditEvent(req, "payment", [
      { field: "Payment", before: "—", after: `${method} · ${amount} · ${new Date(req.body?.paid_at || Date.now()).toISOString().slice(0, 10)}` },
      ...(oldPaidAmount !== po.paid_amount ? [{ field: "Paid amount", before: String(oldPaidAmount), after: String(po.paid_amount) }] : []),
      ...(oldDueAmount !== po.due_amount ? [{ field: "Due amount", before: String(oldDueAmount), after: String(po.due_amount) }] : []),
      ...(oldStatus !== po.status ? [{ field: "Status", before: oldStatus, after: po.status }] : []),
    ]));
    po.updatedby = req.user?._id || null;
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
