const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const Quote = require("../models/Quote");
const QuoteNumberReservation = Quote.NumberReservation;
const { auditEvent, diffFields, diffItems, valueText } = require("../utils/auditHistory");

const nextQuoteNumber = async () => {
  const pattern = /^(?:QT|QUO)-(?:\d{4}-)?\d+$/;
  const [existing, reserved] = await Promise.all([
    Quote.find({ quote_number: pattern }).select("quote_number").lean(),
    QuoteNumberReservation.find({ quote_number: pattern }).select("quote_number").lean(),
  ]);
  const max = [...existing, ...reserved].reduce((highest, quote) => Math.max(highest, Number(String(quote.quote_number).split("-").at(-1)) || 0), 0);
  return `QUO-${String(max + 1).padStart(4, "0")}`;
};

exports.reserveQuoteNumber = async (req, res) => {
  try {
    const createdby = req.user?._id || null;
    const suppliedToken = String(req.body?.token || "");
    const validReservation = suppliedToken ? await QuoteNumberReservation.findOne({
      token: suppliedToken,
      createdby,
      consumed_at: null,
      expires_at: { $gt: new Date() },
    }).lean() : null;
    if (validReservation) {
      return res.json({ success: true, data: { quote_number: validReservation.quote_number, reservation_token: validReservation.token } });
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const reservation = await QuoteNumberReservation.create({
          token: randomUUID(),
          quote_number: await nextQuoteNumber(),
          createdby,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        return res.json({ success: true, data: { quote_number: reservation.quote_number, reservation_token: reservation.token } });
      } catch (error) {
        if (error.code !== 11000 || attempt === 9) throw error;
      }
    }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const buildQuote = (body = {}) => {
  const customerName = String(body.customer_name || "").trim();
  const quoteDate = new Date(body.quote_date);
  const expiryDate = new Date(body.expiry_date);
  if (!customerName) throw new Error("Customer or lead name is required");
  if (Number.isNaN(quoteDate.getTime()) || Number.isNaN(expiryDate.getTime())) throw new Error("Enter valid quote and expiry dates");
  if (expiryDate < quoteDate) throw new Error("Expiry date must be on or after the quote date");
  if (!Array.isArray(body.items) || !body.items.length) throw new Error("Add at least one product");

  const round = (value) => Math.round(value * 100) / 100;
  const items = body.items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);
    const gross = quantity * unitPrice;
    const discountRate = Math.max(0, Math.min(100, Number(item.discount_rate ?? (gross ? (Number(item.discount) || 0) / gross * 100 : 0)) || 0));
    const taxRate = Math.max(0, Math.min(100, Number(item.tax_rate) || 0));
    if (!String(item.name || "").trim() || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("Check product names, quantities, prices, and discounts");
    }
    const discount = round(gross * discountRate / 100);
    if (discount > gross) throw new Error(`Discount cannot exceed the line total for ${item.name}`);
    const tax = round((gross - discount) * taxRate / 100);
    return {
      product_id: mongoose.isValidObjectId(item.product_id) ? item.product_id : null,
      variant_id: mongoose.isValidObjectId(item.variant_id) ? item.variant_id : null,
      name: String(item.name).trim(), variant_name: String(item.variant_name || "").trim(), sku: String(item.sku || "").trim(),
      quantity, unit_price: unitPrice, discount_rate: discountRate, discount, tax_rate: taxRate, tax,
      total: round(gross - discount + tax),
    };
  });
  const subtotal = round(items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0));
  const itemDiscount = round(items.reduce((sum, item) => sum + item.discount, 0));
  const overallDiscountRate = Math.max(0, Math.min(100, Number(body.overall_discount_rate) || 0));
  const overallDiscount = round(Math.max(0, subtotal - itemDiscount) * overallDiscountRate / 100);
  const discount = round(itemDiscount + overallDiscount);
  const taxRate = Math.max(0, Math.min(100, Number(body.tax_rate) || 0));
  const itemTax = round(items.reduce((sum, item) => sum + item.tax, 0));
  const overallTax = round(Math.max(0, subtotal - discount) * taxRate / 100);
  const tax = round(itemTax + overallTax);
  const total = round(subtotal - discount + tax);

  return {
    customer_type: ["Customer", "Lead", "Other"].includes(body.customer_type) ? body.customer_type : "Other",
    customer_id: mongoose.isValidObjectId(body.customer_id) ? body.customer_id : null,
    lead_id: mongoose.isValidObjectId(body.lead_id) ? body.lead_id : null,
    customer_name: customerName,
    customer_email: String(body.customer_email || "").trim().toLowerCase(),
    customer_phone: String(body.customer_phone || "").trim(),
    customer_address: String(body.customer_address || "").trim(),
    quote_date: quoteDate, expiry_date: expiryDate, items, subtotal,
    overall_discount_rate: overallDiscountRate, overall_discount: overallDiscount,
    tax_rate: taxRate, tax, discount, total,
    terms: String(body.terms || "").trim(),
    notes: String(body.notes || "").trim(),
    pdf_design: body.pdf_design && typeof body.pdf_design === "object" ? body.pdf_design : {},
  };
};

exports.listQuotes = async (req, res) => {
  try {
    const quotes = await Quote.find({ is_deleted: false }).select("-activity").sort({ created_at: -1 }).lean();
    res.json({ success: true, data: quotes });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getQuote = async (req, res) => {
  try {
    const quote = await Quote.findOne({ _id: req.params.id, is_deleted: false }).populate("createdby", "name email").lean();
    if (!quote) return res.status(404).json({ success: false, message: "Quote not found" });
    res.json({ success: true, data: quote });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.createQuote = async (req, res) => {
  try {
    const data = buildQuote(req.body);
    const status = ["Pending", "Draft", "Sent"].includes(req.body.status) ? req.body.status : "Pending";
    const reservationToken = String(req.body.quote_number_reservation || "");
    let reservation = null;
    if (reservationToken) {
      reservation = await QuoteNumberReservation.findOneAndUpdate({
        token: reservationToken,
        createdby: req.user?._id || null,
        consumed_at: null,
        expires_at: { $gt: new Date() },
      }, { $set: { consumed_at: new Date() } }, { new: true });
      if (!reservation) return res.status(409).json({ success: false, message: "Quote number reservation expired. Please refresh the editor." });
    }
    let quote;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        quote = await Quote.create({ ...data, quote_number: reservation?.quote_number || await nextQuoteNumber(), status, createdby: req.user?._id || null, activity: [auditEvent(req, "created", [
          { field: "Quote", before: "—", after: data.customer_name },
          ...diffItems([], data.items, { itemFields: { unit_price: "Unit price", discount_rate: "Discount", tax_rate: "Tax" } }),
          { field: "Total", before: "—", after: String(data.total) },
        ])] });
        break;
      } catch (error) {
        if (reservation || error.code !== 11000 || attempt === 4) {
          if (reservation && error.code !== 11000) await QuoteNumberReservation.updateOne({ _id: reservation._id, consumed_at: { $ne: null } }, { $set: { consumed_at: null } });
          throw error;
        }
      }
    }
    res.status(201).json({ success: true, data: quote });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.updateQuote = async (req, res) => {
  try {
    const data = buildQuote(req.body);
    const quote = await Quote.findOne({ _id: req.params.id, is_deleted: false });
    if (!quote) return res.status(404).json({ success: false, message: "Quote not found" });

    const currentStatus = String(quote.status || "Pending").trim().toLowerCase();
    if (!["pending", "draft"].includes(currentStatus)) {
      return res.status(409).json({ success: false, message: "Only pending or draft quotes can be edited" });
    }

    const requestedStatus = ["Pending", "Draft", "Sent"].includes(req.body.status)
      ? req.body.status
      : (currentStatus === "draft" ? "Draft" : "Pending");
    const before = quote.toObject();
    const changes = [
      ...diffFields(before, data, [["customer_type", "Customer type"], ["customer_name", "Customer"], ["customer_email", "Customer email"], ["customer_phone", "Customer phone"], ["customer_address", "Address"], ["quote_date", "Quote date"], ["expiry_date", "Expiry date"], ["subtotal", "Subtotal"], ["overall_discount_rate", "Overall discount rate"], ["overall_discount", "Overall discount"], ["discount", "Discount"], ["tax_rate", "Tax rate"], ["tax", "Tax"], ["total", "Total"], ["terms", "Terms & conditions"], ["notes", "Notes"]]),
      ...(valueText(before.pdf_design) !== valueText(data.pdf_design) ? [{ field: "PDF design", before: "Previous settings", after: "Updated settings" }] : []),
      ...diffItems(before.items, data.items, { itemFields: { unit_price: "Unit price", discount_rate: "Discount rate", discount: "Discount", tax_rate: "Tax rate", tax: "Tax" } }),
      ...(before.status !== requestedStatus ? [{ field: "Status", before: before.status || "Pending", after: requestedStatus }] : []),
    ];
    quote.set({ ...data, status: requestedStatus, updatedby: req.user?._id || null });
    if (changes.length) quote.activity.push(auditEvent(req, "updated", changes));
    await quote.save();
    res.json({ success: true, data: quote });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.updateQuoteStatus = async (req, res) => {
  try {
    if (!["Accepted", "Rejected"].includes(req.body.status)) return res.status(400).json({ success: false, message: "Quote status can only be accepted or rejected here" });
    const quote = await Quote.findOne({ _id: req.params.id, is_deleted: false });
    if (!quote) return res.status(404).json({ success: false, message: "Quote not found" });
    const previousStatus = quote.status;
    if (previousStatus === req.body.status) return res.json({ success: true, data: quote });
    quote.status = req.body.status;
    quote.updatedby = req.user?._id || null;
    quote.activity.push(auditEvent(req, "status", [{ field: "Status", before: previousStatus || "Pending", after: req.body.status }]));
    await quote.save();
    res.json({ success: true, data: quote });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};
