const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
  name: { type: String, required: true, trim: true },
  image: { type: String, trim: true, default: "" },
  sku: { type: String, trim: true, default: "" },
  quantity: { type: Number, required: true, min: 1 },
  unit_price: { type: Number, required: true, min: 0 },
  discount_rate: { type: Number, default: 0, min: 0, max: 100 },
  discount: { type: Number, default: 0, min: 0 },
  tax_rate: { type: Number, default: 0, min: 0, max: 100 },
  tax: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
}, { _id: true });

const invoicePaymentSchema = new mongoose.Schema({
  // Negative entries record cash refunds in the same ledger as received payments.
  amount: { type: Number, required: true, validate: { validator: (value) => Number.isFinite(value) && value !== 0, message: "Payment transaction amount cannot be zero" } },
  payment_date: { type: Date, required: true, default: Date.now },
  payment_time: { type: String, trim: true, default: "" },
  payment_method: { type: String, required: true, trim: true, enum: ["Cash", "Bank", "Card", "Other"] },
  note: { type: String, trim: true, default: "" },
}, { _id: true });

const invoiceReturnItemSchema = new mongoose.Schema({
  item_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  qty: { type: Number, required: true, min: 1 },
  name: { type: String, trim: true, default: "" },
  unit_price: { type: Number, required: true, min: 0 },
  return_value: { type: Number, default: 0, min: 0 },
}, { _id: false });

const invoiceReturnSchema = new mongoose.Schema({
  return_id: { type: String, required: true, trim: true, default: () => new mongoose.Types.ObjectId().toString() },
  items_returned: { type: [invoiceReturnItemSchema], required: true, validate: (items) => Array.isArray(items) && items.length > 0 },
  refund_amount: { type: Number, required: true, min: 0 },
  amount_to_refund: { type: Number, default: 0, min: 0 },
  total_adjustment: { type: Number, default: 0, min: 0 },
  refund_method: { type: String, required: true, enum: ["Cash Refund", "Balance Adjustment"] },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  notes: { type: String, trim: true, default: "", maxlength: 2000 },
  status: { type: String, enum: ["Pending", "Completed"], default: "Completed" },
  date: { type: Date, required: true, default: Date.now },
  refunded_by: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
  invoice_number: { type: String, unique: true, required: true, trim: true, index: true },
  
  // Customer Reference (Only Customers, no Leads)
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
  
  // Snapshot Data (To keep invoice history safe even if customer details change later)
  customer_name: { type: String, required: true, trim: true },
  customer_email: { type: String, trim: true, lowercase: true, default: "" },
  customer_phone: { type: String, trim: true, default: "" },
  customer_address: { type: String, trim: true, default: "" },
  
  invoice_date: { type: Date, required: true },
  due_date: { type: Date, required: true },
  payment_terms: { type: String, trim: true, default: "Due on receipt" },
  
  items: { type: [invoiceItemSchema], required: true, validate: (items) => items.length > 0 },
  
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  
  bank_details: { type: String, trim: true, default: "" },
  terms: { type: String, trim: true, default: "" },
  
  amount_paid: { type: Number, default: 0, min: 0 },
  remaining_balance: { type: Number, default: 0, min: 0 },
  payments: { type: [invoicePaymentSchema], default: [] },
  returns: { type: [invoiceReturnSchema], default: [] },
  status: { type: String, enum: ["Unpaid", "Partially Paid", "Paid", "Overdue"], default: "Unpaid", index: true },
  
  sent_at: { type: Date, default: null },
  paid_at: { type: Date, default: null },
  
  createdby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  is_deleted: { type: Boolean, default: false, index: true },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

invoiceSchema.index({ status: 1, due_date: 1, created_at: -1 });
invoiceSchema.index({ customer_name: 1 });

module.exports = mongoose.model("Invoice", invoiceSchema);
