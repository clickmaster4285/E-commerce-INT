const mongoose = require("mongoose");

const quoteItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
  name: { type: String, required: true, trim: true, maxlength: 240 },
  variant_name: { type: String, trim: true, default: "", maxlength: 240 },
  sku: { type: String, trim: true, default: "" },
  quantity: { type: Number, required: true, min: 1 },
  unit_price: { type: Number, required: true, min: 0 },
  discount_rate: { type: Number, default: 0, min: 0, max: 100 },
  discount: { type: Number, default: 0, min: 0 },
  tax_rate: { type: Number, default: 0, min: 0, max: 100 },
  tax: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
}, { _id: true });

const quoteSchema = new mongoose.Schema({
  quote_number: { type: String, unique: true, required: true, trim: true, index: true },
  customer_type: { type: String, enum: ["Customer", "Lead", "Other"], default: "Other" },
  customer_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  lead_id: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
  customer_name: { type: String, required: true, trim: true, maxlength: 160 },
  customer_email: { type: String, trim: true, lowercase: true, default: "", maxlength: 254 },
  customer_phone: { type: String, trim: true, default: "", maxlength: 30 },
  customer_address: { type: String, trim: true, default: "", maxlength: 1000 },
  quote_date: { type: Date, required: true },
  expiry_date: { type: Date, required: true },
  items: { type: [quoteItemSchema], required: true, validate: (items) => items.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  overall_discount_rate: { type: Number, default: 0, min: 0, max: 100 },
  overall_discount: { type: Number, default: 0, min: 0 },
  tax_rate: { type: Number, default: 0, min: 0, max: 100 },
  tax: { type: Number, default: 0, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  terms: { type: String, trim: true, default: "", maxlength: 5000 },
  notes: { type: String, trim: true, default: "", maxlength: 1000 },
  pdf_design: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  status: { type: String, enum: ["Pending", "Draft", "Sent", "Accepted", "Rejected"], default: "Pending", index: true },
  createdby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  is_deleted: { type: Boolean, default: false, index: true },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

quoteSchema.index({ status: 1, created_at: -1 });
quoteSchema.index({ customer_name: 1 });

const quoteNumberReservationSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  quote_number: { type: String, required: true, unique: true, index: true },
  createdby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  expires_at: { type: Date, required: true, index: true },
  consumed_at: { type: Date, default: null },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

const Quote = mongoose.models.Quote || mongoose.model("Quote", quoteSchema);
Quote.NumberReservation = mongoose.models.QuoteNumberReservation || mongoose.model("QuoteNumberReservation", quoteNumberReservationSchema);

module.exports = Quote;
