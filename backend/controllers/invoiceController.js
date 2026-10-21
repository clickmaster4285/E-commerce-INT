const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Customer = require("../models/Customer");
const Variant = require("../models/Variant");

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
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
  return {
    customer_id: mongoose.isValidObjectId(body.customer_id) ? body.customer_id : null,
    customer_name: customerName,
    customer_email: String(body.customer_email || "").trim().toLowerCase(),
    customer_phone: String(body.customer_phone || "").trim(),
    customer_address: String(body.customer_address || "").trim(),
    invoice_date: invoiceDate, due_date: dueDate,
    payment_terms: String(body.payment_terms || "Due on receipt").trim(),
    items, subtotal, discount, tax, total: round(subtotal - discount + tax),
    bank_details: String(body.bank_details || "").trim(), terms: String(body.terms || "").trim(),
  };
};

exports.listInvoices = async (_req, res) => {
  try {
    const invoices = await Invoice.find({ is_deleted: false }).sort({ created_at: -1 }).lean();
    res.json({ success: true, data: invoices });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, is_deleted: false }).lean();
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, data: invoice });
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
        invoice = await Invoice.create({ ...data, invoice_number: await nextInvoiceNumber(), status: "Unpaid", amount_paid: 0, remaining_balance: total, createdby: req.user?._id || null });
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
    await invoice.save();
    res.json({ success: true, data: invoice });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.recordReturn = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, is_deleted: false });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    const priorPaid = round(Number(invoice.amount_paid || 0));
    if (!["Paid", "Partially Paid"].includes(invoice.status) || priorPaid <= 0) {
      return res.status(400).json({ success: false, message: "Refund not possible. No payment received yet." });
    }

    const refundMethod = String(req.body.refund_method || "").trim();
    if (!["Bank Transfer", "Cash", "Store Credit"].includes(refundMethod)) {
      return res.status(400).json({ success: false, message: "Choose a valid refund method" });
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

    const itemsReturned = [];
    let refundAmount = 0;
    for (const [itemId, qty] of requested) {
      const item = invoice.items.id(itemId);
      if (!item) return res.status(400).json({ success: false, message: "A selected item does not belong to this invoice" });
      const availableQty = Number(item.quantity || 0) - (priorReturned.get(itemId) || 0);
      if (qty > availableQty) {
        return res.status(400).json({ success: false, message: `Return quantity for ${item.name} exceeds the unreturned quantity (${Math.max(0, availableQty)})` });
      }
      const unitPrice = round(Number(item.unit_price) || 0);
      refundAmount += unitPrice * qty;
      itemsReturned.push({ item_id: item._id, qty, name: item.name, unit_price: unitPrice });
    }
    refundAmount = round(refundAmount);
    if (refundAmount <= 0) return res.status(400).json({ success: false, message: "Refund amount must be greater than zero" });
    if (refundAmount > priorPaid) {
      return res.status(400).json({ success: false, message: "Refund amount cannot exceed the amount paid" });
    }

    const paid = round(priorPaid - refundAmount);
    const remaining = round(Math.max(0, Number(invoice.total || 0) - paid));
    const returnRecord = {
      return_id: new mongoose.Types.ObjectId().toString(),
      items_returned: itemsReturned,
      refund_amount: refundAmount,
      refund_method: refundMethod,
      reason: reason.slice(0, 500),
      notes: String(req.body.notes || "").trim().slice(0, 2000),
      status: "Completed",
      date: new Date(),
      refunded_by: req.user?._id || null,
    };
    const updatedInvoice = await Invoice.findOneAndUpdate(
      { _id: invoice._id, is_deleted: false, status: { $in: ["Paid", "Partially Paid"] }, amount_paid: priorPaid, __v: invoice.__v },
      {
        $push: { returns: returnRecord },
        $set: { amount_paid: paid, remaining_balance: remaining, status: paid > 0 ? "Partially Paid" : "Unpaid", paid_at: null, updatedby: req.user?._id || null },
        $inc: { __v: 1 },
      },
      { new: true, runValidators: true }
    );
    if (!updatedInvoice) return res.status(409).json({ success: false, message: "Invoice changed while processing. Refresh and try again." });
    return res.json({ success: true, data: updatedInvoice });
  } catch (error) {
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
      await invoice.save();
    }
    res.json({ success: true, data: invoice });
  } catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
};
