const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Customer = require("../models/Customer");
const Variant = require("../models/Variant");
const { calculateReturnLine, capReturnLines, calculateReturnSettlement, getOriginalInvoiceTotal } = require("../utils/invoiceReturnMath");
const StockHistory = require("../models/StockHistory");
const { getInvoiceStockAdjustments } = require("../utils/invoiceStockAdjustments");

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const actorName = (req) => String(req.user?.name || req.user?.username || req.user?.email || "Administrator").trim();
const auditValue = (value) => String(value ?? "")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
  .replace(/<[^>]*>/g, "")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/\s+/g, " ")
  .trim();
const isEmptyOrZeroActivityValue = (value) => {
  const text = String(value ?? "").trim();
  if (!text || text === "—") return true;
  const numeric = text.replace(/[^\d.-]/g, "");
  return numeric !== "" && Number(numeric) === 0;
};
const isMeaningfulInvoiceActivityChange = (change) => {
  if (!["Discount", "Tax", "Total discount", "Total tax"].includes(change.field)) return true;
  return !(isEmptyOrZeroActivityValue(change.before) && isEmptyOrZeroActivityValue(change.after));
};
const invoiceActivity = (req, type, changes = []) => ({
  type,
  at: new Date(),
  actor_id: req.user?._id || null,
  actor_name: actorName(req),
  changes,
});
const compareInvoice = (current, next) => {
  const changes = [];
  const add = (action, field, before, after, item = {}) => {
    const oldValue = String(before ?? "");
    const newValue = String(after ?? "");
    if (oldValue === newValue) return;
    changes.push({ action, field, ...item, before: oldValue || "—", after: newValue || "—" });
  };
  const previousItems = current.items || [];
  const nextItems = next.items || [];
  const matchedPreviousIndexes = new Set();
  const sameId = (left, right) => String(left?._id || left || "") === String(right?._id || right || "");
  const findPreviousMatch = (item) => {
    const available = previousItems.map((previous, index) => ({ previous, index })).filter(({ index }) => !matchedPreviousIndexes.has(index));
    const variantId = item.variant_id?._id || item.variant_id;
    const sku = String(item.sku || "").trim().toLowerCase();
    const productId = item.product_id?._id || item.product_id;
    const normalizedName = String(item.name || "").trim().toLowerCase();
    const byVariant = variantId && available.filter(({ previous }) => sameId(previous.variant_id, variantId));
    if (byVariant?.length === 1) return byVariant[0];
    const byProductAndName = productId && available.filter(({ previous }) => sameId(previous.product_id, productId) && String(previous.name || "").trim().toLowerCase() === normalizedName);
    if (byProductAndName?.length === 1) return byProductAndName[0];
    const bySku = sku && available.filter(({ previous }) => String(previous.sku || "").trim().toLowerCase() === sku);
    if (bySku?.length === 1) return bySku[0];
    const byProduct = productId && available.filter(({ previous }) => sameId(previous.product_id, productId));
    return byProduct?.length === 1 ? byProduct[0] : null;
  };
  for (const item of nextItems) {
    const match = findPreviousMatch(item);
    const previous = match?.previous;
    const product = { product_name: item.name || "Invoice item", variant_title: item.variant_title || "", sku: item.sku || "" };
    if (!previous) {
      changes.push({ action: "added", field: "item", ...product, from_quantity: 0, to_quantity: Number(item.quantity) || 0 });
      changes.push({ action: "item_field", field: "Unit price", ...product, before: "—", after: String(Number(item.unit_price) || 0) });
      const discountChange = { action: "item_field", field: "Discount", ...product, before: "—", after: `${Number(item.discount_rate) || 0}% · ${Number(item.discount) || 0}` };
      const taxChange = { action: "item_field", field: "Tax", ...product, before: "—", after: `${Number(item.tax_rate) || 0}% · ${Number(item.tax) || 0}` };
      if (isMeaningfulInvoiceActivityChange(discountChange)) changes.push(discountChange);
      if (isMeaningfulInvoiceActivityChange(taxChange)) changes.push(taxChange);
      continue;
    }
    matchedPreviousIndexes.add(match.index);
    add("item_field", "Product / variant", previous.name, item.name, product);
    if (Number(previous.quantity) !== Number(item.quantity)) changes.push({ action: "quantity", field: "quantity", ...product, from_quantity: Number(previous.quantity) || 0, to_quantity: Number(item.quantity) || 0 });
    add("item_field", "Unit price", previous.unit_price, item.unit_price, product);
    add("item_field", "Discount", `${Number(previous.discount_rate) || 0}% · ${Number(previous.discount) || 0}`, `${Number(item.discount_rate) || 0}% · ${Number(item.discount) || 0}`, product);
    add("item_field", "Tax", `${Number(previous.tax_rate) || 0}% · ${Number(previous.tax) || 0}`, `${Number(item.tax_rate) || 0}% · ${Number(item.tax) || 0}`, product);
  }
  previousItems.forEach((item, index) => {
    if (!matchedPreviousIndexes.has(index)) changes.push({ action: "removed", field: "item", product_name: item.name || "Invoice item", variant_title: item.variant_title || "", sku: item.sku || "", from_quantity: Number(item.quantity) || 0, to_quantity: 0 });
  });
  [
    ["Customer", current.customer_name, next.customer_name],
    ["Customer email", current.customer_email, next.customer_email],
    ["Customer phone", current.customer_phone, next.customer_phone],
    ["Billing address", current.customer_address, next.customer_address],
    ["Invoice date", current.invoice_date && new Date(current.invoice_date).toISOString().slice(0, 10), next.invoice_date && new Date(next.invoice_date).toISOString().slice(0, 10)],
    ["Due date", current.due_date && new Date(current.due_date).toISOString().slice(0, 10), next.due_date && new Date(next.due_date).toISOString().slice(0, 10)],
    ["Payment terms", current.payment_terms, next.payment_terms],
    ["Subtotal", current.subtotal, next.subtotal],
    ["Total discount", current.discount, next.discount],
    ["Total tax", current.tax, next.tax],
    ["Invoice total", current.total, next.total],
    ["Bank details", current.bank_details, next.bank_details],
    ["Terms & conditions", auditValue(current.terms), auditValue(next.terms)],
  ].forEach(([field, before, after]) => add("field", field, before, after));
  return changes;
};
const nextInvoiceNumber = async () => {
  const existing = await Invoice.find({ invoice_number: /^INV-(?:\d{4}-)?\d+$/ }).select("invoice_number").lean();
  const max = existing.reduce((highest, item) => Math.max(highest, Number(item.invoice_number.split("-").at(-1)) || 0), 0);
  return `INV-${String(max + 1).padStart(4, "0")}`;
};

const buildInvoice = (body = {}) => {
  const customerName = String(body.customer_name || "").trim();
  const invoiceDate = new Date(body.invoice_date);
  const dueDate = new Date(body.due_date);
  if (!customerName) throw new Error("Customer name is required");
  if (Number.isNaN(invoiceDate.getTime()) || Number.isNaN(dueDate.getTime())) throw new Error("Enter valid invoice and due dates");
  if (!Array.isArray(body.items) || !body.items.length) throw new Error("Add at least one product");

  const items = body.items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);
    const gross = quantity * unitPrice;
    const discountRate = Math.max(0, Math.min(100, Number(item.discount_rate) || 0));
    const taxRate = Math.max(0, Math.min(100, Number(item.tax_rate) || 0));
    if (!mongoose.isValidObjectId(item.product_id) || !String(item.name || "").trim() || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("Check product names, quantities, prices, and discounts");
    }
    const discount = round(gross * discountRate / 100);
    const tax = round((gross - discount) * taxRate / 100);
    return {
      product_id: item.product_id,
      variant_id: mongoose.isValidObjectId(item.variant_id) ? item.variant_id : null,
      name: String(item.name).trim(), sku: String(item.sku || "").trim(), image: String(item.image || "").trim(), quantity,
      unit_price: unitPrice, discount_rate: discountRate, discount, tax_rate: taxRate,
      tax, total: round(gross - discount + tax),
    };
  });
  const subtotal = round(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0));
  const itemDiscount = round(items.reduce((sum, item) => sum + item.discount, 0));
  const itemTax = round(items.reduce((sum, item) => sum + item.tax, 0));
  const discountBase = Math.max(0, subtotal - itemDiscount);
  const discountInput = Math.max(0, Number(body.overall_discount_rate) || 0);
  const overallDiscount = round(body.overall_discount_type === "flat"
    ? Math.min(discountBase, discountInput)
    : discountBase * Math.min(100, discountInput) / 100);
  const overallTaxRate = Math.max(0, Math.min(100, Number(body.tax_rate) || 0));
  const overallTaxBase = Math.max(0, discountBase - overallDiscount);
  const overallTax = round(overallTaxBase * overallTaxRate / 100);
  const discount = round(itemDiscount + overallDiscount);
  const tax = round(itemTax + overallTax);
  const allocateAmount = (amount, weights) => {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (!amount || !totalWeight) return weights.map(() => 0);
    let allocated = 0;
    return weights.map((weight, index) => {
      if (index === weights.length - 1) return round(amount - allocated);
      const share = round(amount * weight / totalWeight);
      allocated = round(allocated + share);
      return share;
    });
  };
  const discountShares = allocateAmount(overallDiscount, items.map((item) => Math.max(0, item.quantity * item.unit_price - item.discount)));
  const taxShares = allocateAmount(overallTax, items.map((item, index) => Math.max(0, item.quantity * item.unit_price - item.discount - discountShares[index])));
  items.forEach((item, index) => {
    item.discount = round(item.discount + discountShares[index]);
    item.tax = round(item.tax + taxShares[index]);
    item.total = round(item.quantity * item.unit_price - item.discount + item.tax);
  });
  const total = round(subtotal - discount + tax);
  return {
    customer_id: mongoose.isValidObjectId(body.customer_id) ? body.customer_id : null,
    customer_name: customerName,
    customer_email: String(body.customer_email || "").trim().toLowerCase(),
    customer_phone: String(body.customer_phone || "").trim(),
    customer_address: String(body.customer_address || "").trim(),
    invoice_date: invoiceDate, due_date: dueDate,
    payment_terms: String(body.payment_terms || "Due on receipt").trim(),
    items, subtotal, discount, tax, original_total: total, total,
    bank_details: String(body.bank_details || "").trim(), terms: String(body.terms || "").trim(),
    pdf_design: body.pdf_design && typeof body.pdf_design === "object" && !Array.isArray(body.pdf_design) ? body.pdf_design : {},
  };
};

exports.listInvoices = async (_req, res) => {
  try {
    const invoices = (await Invoice.find({ is_deleted: false }).select("-activity").sort({ created_at: -1 }).lean())
      .map((invoice) => ({ ...invoice, original_total: getOriginalInvoiceTotal(invoice) }));
    res.json({ success: true, data: invoices });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getNextInvoiceNumber = async (_req, res) => {
  try {
    res.json({ success: true, data: { invoice_number: await nextInvoiceNumber() } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, is_deleted: false })
      .populate("createdby", "name")
      .populate("updatedby", "name")
      .lean();
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, data: { ...invoice, original_total: getOriginalInvoiceTotal(invoice) } });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.createInvoice = async (req, res) => {
  const deductedStock = [];
  try {
    const data = buildInvoice(req.body);
    if (!data.customer_id) return res.status(400).json({ success: false, message: "Select a valid customer" });
    const customer = await Customer.findOne({ _id: data.customer_id, is_deleted: { $ne: true } }).select("name email phone address").lean();
    if (!customer) return res.status(400).json({ success: false, message: "Selected customer was not found" });
    // Keep the invoice contact snapshot supplied by the form. It may have
    // been edited on the invoice or copied from an accepted quote.
    const quantitiesByVariant = new Map();
    for (const item of data.items) {
      if (!item.variant_id) throw new Error(`Select a valid variant for "${item.name}" to update its stock`);
      const key = String(item.variant_id);
      const existing = quantitiesByVariant.get(key);
      if (existing && String(existing.product_id) !== String(item.product_id)) throw new Error("Invoice variant does not match its product");
      quantitiesByVariant.set(key, { product_id: item.product_id, quantity: (existing?.quantity || 0) + item.quantity, name: item.name });
    }

    for (const [variantId, entry] of quantitiesByVariant) {
      const variant = await Variant.findOneAndUpdate(
        { _id: variantId, product_id: entry.product_id, quantity: { $gte: entry.quantity }, status: "active" },
        { $inc: { quantity: -entry.quantity } },
        { new: true, select: "_id quantity product_id" },
      );
      if (!variant) {
        const current = await Variant.findOne({ _id: variantId, product_id: entry.product_id }).select("quantity").lean();
        if (!current) throw new Error(`Variant for "${entry.name}" was not found`);
        throw new Error(`Insufficient stock for "${entry.name}" (available: ${current.quantity || 0})`);
      }
      deductedStock.push({ variant_id: variant._id, quantity: entry.quantity });
    }

    const total = data.total;
    let invoice;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        invoice = await Invoice.create({
          ...data,
          invoice_number: await nextInvoiceNumber(),
          status: "Unpaid",
          amount_paid: 0,
          remaining_balance: total,
          createdby: req.user?._id || null,
          activity: [invoiceActivity(req, "created", data.items.map((item) => ({
            action: "added", field: "item", product_name: item.name, sku: item.sku || "", from_quantity: 0, to_quantity: item.quantity,
          })))],
        });
        break;
      } catch (error) { if (error.code !== 11000 || attempt === 4) throw error; }
    }
    try {
      const io = require("../utils/socket").getIO();
      if (io && deductedStock.length) io.emit("stockUpdated", { variants: deductedStock.map(({ variant_id, quantity }) => ({ variant_id, change: -quantity })), source: "invoice_created" });
    } catch (socketError) {}
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    await Promise.all(deductedStock.map(({ variant_id, quantity }) => Variant.updateOne({ _id: variant_id }, { $inc: { quantity } }).catch(() => null)));
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateInvoice = async (req, res) => {
  const stockChanges = [];
  const rollbackStock = async () => {
    let failed = false;
    for (const change of [...stockChanges].reverse()) {
      await Variant.updateOne({ _id: change.variant_id }, { $inc: { quantity: -change.stockChange } }).catch(() => { failed = true; });
    }
    stockChanges.length = 0;
    return failed;
  };
  try {
    const current = await Invoice.findOne({ _id: req.params.id, is_deleted: false });
    if (!current) return res.status(404).json({ success: false, message: "Invoice not found" });
    if (current.sent_at) return res.status(409).json({ success: false, message: "A sent invoice can no longer be edited" });

    const data = buildInvoice(req.body);
    if (!data.customer_id) return res.status(400).json({ success: false, message: "Select a valid customer" });
    const customer = await Customer.findOne({ _id: data.customer_id, is_deleted: { $ne: true } }).select("_id").lean();
    if (!customer) return res.status(400).json({ success: false, message: "Selected customer was not found" });

    const productByVariant = new Map();
    for (const item of [...(current.items || []), ...data.items]) {
      if (!item.variant_id) throw new Error(`Select a valid variant for "${item.name}" to update its stock`);
      const key = String(item.variant_id);
      const productId = String(item.product_id);
      if (productByVariant.has(key) && productByVariant.get(key) !== productId) throw new Error("Invoice variant does not match its product");
      productByVariant.set(key, productId);
    }

    const adjustments = getInvoiceStockAdjustments(current.items, data.items);
    for (const adjustment of adjustments) {
      const product_id = productByVariant.get(adjustment.variant_id);
      let updatedVariant;
      if (adjustment.quantity > 0) {
        updatedVariant = await Variant.findOneAndUpdate(
          { _id: adjustment.variant_id, product_id, quantity: { $gte: adjustment.quantity }, status: "active" },
          { $inc: { quantity: -adjustment.quantity } },
          { new: true, select: "_id quantity product_id" },
        );
        if (!updatedVariant) {
          const existing = await Variant.findOne({ _id: adjustment.variant_id, product_id }).select("quantity").lean();
          if (!existing) throw new Error("An invoice variant was not found");
          throw new Error(`Insufficient stock for the updated invoice (available: ${existing.quantity || 0})`);
        }
        stockChanges.push({ variant_id: adjustment.variant_id, stockChange: -adjustment.quantity });
      } else {
        updatedVariant = await Variant.findOneAndUpdate(
          { _id: adjustment.variant_id, product_id },
          { $inc: { quantity: -adjustment.quantity } },
          { new: true, select: "_id quantity product_id" },
        );
        if (!updatedVariant) throw new Error("An invoice variant was not found");
        stockChanges.push({ variant_id: adjustment.variant_id, stockChange: -adjustment.quantity });
      }
    }

    const amountPaid = round(Number(current.amount_paid || 0));
    if (data.total < amountPaid) throw new Error("Invoice total cannot be lower than the amount already paid");
    const remaining = round(data.total - amountPaid);
    const dueDateDay = new Date(data.due_date).toISOString().slice(0, 10);
    const todayDay = new Date().toISOString().slice(0, 10);
    const status = remaining <= 0 ? "Paid" : amountPaid > 0 ? "Partially Paid" : dueDateDay < todayDay ? "Overdue" : "Unpaid";
    const changes = [
      ...compareInvoice(current, data),
      ...(round(Number(current.remaining_balance || 0)) !== remaining ? [{ action: "balance", field: "Remaining balance", before: round(Number(current.remaining_balance || 0)), after: remaining }] : []),
      ...(current.status !== status ? [{ action: "field", field: "Status", before: current.status || "Unpaid", after: status }] : []),
    ];
    const update = {
      $set: { ...data, original_total: data.total, total: data.total, amount_paid: amountPaid, remaining_balance: remaining, status, paid_at: status === "Paid" ? current.paid_at || new Date() : null, updatedby: req.user?._id || null },
      $inc: { __v: 1 },
    };
    // A save with no meaningful differences should not create an empty timeline entry.
    if (changes.length) update.$push = { activity: invoiceActivity(req, "updated", changes) };
    const updatedInvoice = await Invoice.findOneAndUpdate(
      { _id: current._id, is_deleted: false, sent_at: null, __v: current.__v ?? 0 },
      update,
      { new: true, runValidators: true },
    );
    if (!updatedInvoice) {
      const rollbackFailed = await rollbackStock();
      return res.status(409).json({ success: false, message: rollbackFailed ? "Invoice changed and stock rollback needs review" : "Invoice was sent or changed while editing. Refresh and try again." });
    }
    try {
      const io = require("../utils/socket").getIO();
      if (io && stockChanges.length) io.emit("stockUpdated", { variants: stockChanges.map(({ variant_id, stockChange }) => ({ variant_id, change: stockChange })), source: "invoice_updated" });
    } catch (socketError) {}
    return res.json({ success: true, data: updatedInvoice });
  } catch (error) {
    const rollbackFailed = await rollbackStock();
    return res.status(400).json({ success: false, message: rollbackFailed ? `${error.message}. Stock rollback needs review.` : error.message });
  }
};

exports.recordPayment = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const paymentDate = new Date(req.body.payment_date);
    const method = String(req.body.payment_method || "").trim();
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: "Payment amount must be greater than zero" });
    if (Number.isNaN(paymentDate.getTime())) return res.status(400).json({ success: false, message: "Enter a valid payment date" });
    if (!["Cash", "Bank", "Card", "Other"].includes(method)) return res.status(400).json({ success: false, message: "Choose a valid payment method" });

    const invoice = await Invoice.findOne({ _id: req.params.id, is_deleted: false });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    const priorPaid = round(Number(invoice.amount_paid || 0));
    const priorRemaining = round(Math.max(0, Number(invoice.total) - priorPaid));
    const paid = round(priorPaid + amount);
    const remaining = round(Math.max(0, Number(invoice.total) - paid));
    if (amount > priorRemaining) {
      return res.status(400).json({ success: false, message: "Payment cannot exceed the remaining balance" });
    }
    const paymentTime = String(req.body.payment_time || "").trim();
    if (paymentTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(paymentTime)) return res.status(400).json({ success: false, message: "Enter a valid payment time" });
    invoice.payments.push({ amount, payment_date: paymentDate, payment_time: paymentTime, payment_method: method, note: String(req.body.note || "").trim() });
    invoice.amount_paid = paid;
    invoice.remaining_balance = remaining;
    invoice.status = remaining <= 0 ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid";
    invoice.paid_at = remaining <= 0 ? paymentDate : null;
    invoice.updatedby = req.user?._id || null;
    invoice.activity.push(invoiceActivity(req, "payment", [{
      action: "payment_recorded",
      field: "Payment",
      before: "—",
      after: `${method} · ${amount} · ${paymentDate.toISOString().slice(0, 10)}${paymentTime ? ` ${paymentTime}` : ""}${String(req.body.note || "").trim() ? ` · ${String(req.body.note).trim()}` : ""}`,
    }, { action: "balance", field: "Remaining balance", before: priorRemaining, after: remaining }]));
    await invoice.save();
    res.json({ success: true, data: invoice });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.recordReturn = async (req, res) => {
  const stockChanges = [];
  let stockHistoryExplanation = "";
  const rollbackRestock = async () => {
    let failed = false;
    if (stockHistoryExplanation) {
      await StockHistory.deleteMany({ explanation: stockHistoryExplanation }).catch(() => { failed = true; });
    }
    for (const change of [...stockChanges].reverse()) {
      await Variant.updateOne({ _id: change.variant_id }, { $inc: { quantity: -change.quantity } })
        .catch(() => { failed = true; });
    }
    stockChanges.length = 0;
    return failed;
  };
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, is_deleted: false });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    if (!invoice.sent_at) return res.status(400).json({ success: false, message: "Send the invoice to the customer before processing a return or refund" });

    const priorPaid = round(Number(invoice.amount_paid || 0));
    const priorTotal = round(Number(invoice.total || 0));
    const originalTotal = getOriginalInvoiceTotal(invoice);
    const refundMethod = String(req.body.refund_method || "").trim();
    if (!["Cash Refund", "Balance Adjustment"].includes(refundMethod)) {
      return res.status(400).json({ success: false, message: "Choose a valid refund method" });
    }
    const refundPaymentMethod = String(req.body.refund_payment_method || "Cash").trim();
    if (refundMethod === "Cash Refund" && !["Cash", "Bank"].includes(refundPaymentMethod)) {
      return res.status(400).json({ success: false, message: "Choose Cash or Bank for the cash refund" });
    }
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ success: false, message: "Select or enter a reason for return" });

    if (!Array.isArray(req.body.items_returned) || !req.body.items_returned.length) {
      return res.status(400).json({ success: false, message: "Select at least one item to return" });
    }

    const priorReturned = new Map();
    for (const previousReturn of invoice.returns || []) {
      for (const returnedItem of previousReturn.items_returned || []) {
        const itemId = String(returnedItem.item_id || "");
        priorReturned.set(itemId, (priorReturned.get(itemId) || 0) + Number(returnedItem.qty || 0));
      }
    }

    const requested = new Map();
    for (const entry of req.body.items_returned) {
      const itemId = String(entry?.item_id || "");
      const qty = Number(entry?.qty);
      if (!mongoose.isValidObjectId(itemId) || !Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ success: false, message: "Choose a valid return quantity for each item" });
      }
      requested.set(itemId, (requested.get(itemId) || 0) + qty);
    }

    let itemsReturned = [];
    for (const [itemId, qty] of requested) {
      const item = invoice.items.id(itemId);
      if (!item) return res.status(400).json({ success: false, message: "A selected item does not belong to this invoice" });
      const availableQty = Number(item.quantity || 0) - (priorReturned.get(itemId) || 0);
      if (qty > availableQty) {
        return res.status(400).json({ success: false, message: `Return quantity for ${item.name} exceeds the unreturned quantity (${Math.max(0, availableQty)})` });
      }
      const lineValue = calculateReturnLine(item, qty, invoice.returns || []);
      itemsReturned.push({ item_id: item._id, qty, name: item.name, unit_price: lineValue.unit_price, return_value: lineValue.return_value });
    }
    const cappedReturn = capReturnLines(itemsReturned, priorTotal);
    itemsReturned = cappedReturn.lines;
    const refundAmount = cappedReturn.total;
    if (refundAmount <= 0) return res.status(400).json({ success: false, message: "Refund amount must be greater than zero" });
    const settlement = calculateReturnSettlement(priorTotal, priorPaid, refundAmount);
    if (settlement.cash_refund > 0 && refundMethod !== "Cash Refund") {
      return res.status(400).json({ success: false, message: "The customer has overpaid. Process the excess as a cash or bank refund." });
    }
    if (refundMethod === "Cash Refund" && settlement.cash_refund <= 0) {
      return res.status(400).json({ success: false, message: "Cash refund is only needed when the invoice is fully paid or the return creates an excess payment" });
    }
    const cashRefundAmount = refundMethod === "Cash Refund" ? settlement.cash_refund : 0;
    // Cash paid back is only the amount that remains after the return offsets the invoice balance.
    const amountToRefund = round(cashRefundAmount);
    const adjustedTotal = settlement.adjusted_total;
    const paid = settlement.amount_paid;
    const remaining = settlement.remaining_balance;
    const nextStatus = remaining <= 0 ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid";
    const returnRecord = {
      return_id: new mongoose.Types.ObjectId().toString(),
      items_returned: itemsReturned,
      refund_amount: refundAmount,
      amount_to_refund: amountToRefund,
      total_adjustment: refundAmount,
      refund_method: refundMethod,
      reason: reason.slice(0, 500),
      notes: String(req.body.notes || "").trim().slice(0, 2000),
      status: "Completed",
      date: new Date(),
      refunded_by: req.user?._id || null,
    };

    const restockByVariant = new Map();
    for (const returnedItem of itemsReturned) {
      const invoiceItem = invoice.items.id(returnedItem.item_id);
      let variantId = invoiceItem?.variant_id;
      if (!mongoose.isValidObjectId(variantId) && invoiceItem?.product_id && invoiceItem?.sku) {
        const matchingVariant = await Variant.findOne({ product_id: invoiceItem.product_id, sku: invoiceItem.sku }).select("_id").lean();
        variantId = matchingVariant?._id;
      }
      if (!mongoose.isValidObjectId(variantId)) {
        return res.status(400).json({ success: false, message: `Cannot restore stock for ${returnedItem.name}: its product variant is missing` });
      }
      const key = String(variantId);
      const current = restockByVariant.get(key);
      restockByVariant.set(key, current
        ? { ...current, quantity: current.quantity + returnedItem.qty }
        : { variant_id: variantId, product_id: invoiceItem.product_id, quantity: returnedItem.qty, name: invoiceItem.name, sku: invoiceItem.sku, title: invoiceItem.name });
    }
    stockHistoryExplanation = `Invoice return ${returnRecord.return_id} for ${invoice.invoice_number}: ${reason}`;
    const stockHistoryRows = [];
    for (const restore of restockByVariant.values()) {
      const variant = await Variant.findOneAndUpdate(
        { _id: restore.variant_id, product_id: restore.product_id },
        { $inc: { quantity: restore.quantity } },
        { new: true, select: "_id quantity product_id title sku" },
      );
      if (!variant) throw new Error(`Could not restore stock for ${restore.name}`);
      stockChanges.push({ variant_id: variant._id, quantity: restore.quantity });
      stockHistoryRows.push({
        variant_id: variant._id,
        product_id: variant.product_id,
        product_name: restore.name,
        sku: restore.sku || variant.sku || "",
        variant_title: variant.title || restore.title,
        previous_quantity: variant.quantity - restore.quantity,
        new_quantity: variant.quantity,
        change_quantity: restore.quantity,
        adjustment_type: "add",
        reason: "Invoice return",
        explanation: stockHistoryExplanation,
        performed_by: req.user?._id || null,
        performed_by_name: req.user?.name || "Administrator",
      });
    }
    if (stockHistoryRows.length) await StockHistory.insertMany(stockHistoryRows);

    const update = {
      $push: {
        returns: returnRecord,
        activity: invoiceActivity(req, "return", [
          ...itemsReturned.map((item) => ({ action: "returned", field: "item", product_name: item.name, from_quantity: 0, to_quantity: item.qty, before: "—", after: `${item.qty} returned · ${item.return_value}` })),
          { action: "refund", field: "Return", before: "—", after: `${refundMethod} · ${reason} · refund ${refundAmount} · cash paid ${amountToRefund}` },
          { action: "balance", field: "Invoice total", before: priorTotal, after: adjustedTotal },
        ]),
      },
      $set: { original_total: originalTotal, amount_paid: paid, total: adjustedTotal, remaining_balance: remaining, status: nextStatus, paid_at: nextStatus === "Paid" ? invoice.paid_at || new Date() : null, updatedby: req.user?._id || null },
      $inc: { __v: 1 },
    };
    if (cashRefundAmount > 0) {
      update.$push.payments = {
        amount: -amountToRefund,
        payment_date: new Date(),
        payment_time: "",
        payment_method: refundPaymentMethod,
        note: `${refundPaymentMethod} refund for return ${returnRecord.return_id}`,
      };
    }
    const updatedInvoice = await Invoice.findOneAndUpdate(
      { _id: invoice._id, is_deleted: false, amount_paid: priorPaid, total: priorTotal, __v: invoice.__v },
      update,
      { new: true, runValidators: true }
    );
    if (!updatedInvoice) {
      const rollbackFailed = await rollbackRestock();
      return res.status(409).json({ success: false, message: rollbackFailed ? "Invoice changed and stock rollback needs review. Refresh stock history." : "Invoice changed while processing. Refresh and try again." });
    }
    try {
      const io = require("../utils/socket").getIO();
      if (io) io.emit("stockUpdated", { variants: stockChanges.map(({ variant_id, quantity }) => ({ variant_id, change: quantity })), source: "invoice_return" });
    } catch (socketError) {}
    return res.json({ success: true, data: updatedInvoice });
  } catch (error) {
    const rollbackFailed = await rollbackRestock();
    if (rollbackFailed) return res.status(500).json({ success: false, message: `${error.message}. Stock rollback needs review; check stock history.` });
    return res.status(400).json({ success: false, message: error.message });
  }
};

exports.sendInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, is_deleted: false });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    if (!invoice.sent_at) {
      invoice.sent_at = new Date();
      invoice.updatedby = req.user?._id || null;
      invoice.activity.push(invoiceActivity(req, "sent", [{ action: "sent", field: "Invoice sent to customer", before: "Not sent", after: invoice.sent_at.toISOString() }]));
      await invoice.save();
    }
    res.json({ success: true, data: invoice });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};
