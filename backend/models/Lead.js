const mongoose = require("mongoose");

const leadProductSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
  quantity: { type: Number, required: true, min: 1, default: 1 },
}, { _id: false });

const activitySchema = new mongoose.Schema({
  type: { type: String, enum: ["Call", "WhatsApp", "Email", "Meeting", "Other"], required: true },
  notes: { type: String, trim: true, required: true, maxlength: 3000 },
  follow_up_date: { type: Date, default: null },
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  employee_name: { type: String, trim: true, default: "Staff" },
  created_at: { type: Date, default: Date.now },
});

const historyChangeSchema = new mongoose.Schema({
  field: { type: String, trim: true, required: true },
  from: { type: String, trim: true, default: "" },
  to: { type: String, trim: true, default: "" },
}, { _id: false });

const historyEntrySchema = new mongoose.Schema({
  action: { type: String, enum: ["created", "updated", "status", "activity", "customer", "deleted"], required: true },
  summary: { type: String, trim: true, required: true, maxlength: 500 },
  changes: { type: [historyChangeSchema], default: [] },
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  employee_name: { type: String, trim: true, default: "Staff" },
  created_at: { type: Date, default: Date.now },
}, { _id: true });

const leadSchema = new mongoose.Schema({
  lead_number: { type: String, unique: true, index: true },
  lead_type: { type: String, enum: ["Individual", "Business"], required: true, default: "Individual" },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  phone: { type: String, required: true, trim: true, maxlength: 15, match: /^\d{7,15}$/ },
  email: { type: String, trim: true, lowercase: true, default: "", maxlength: 254 },
  company_name: { type: String, trim: true, default: "", maxlength: 160 },
  business_type: { type: String, trim: true, default: "", maxlength: 120 },
  business_address: { type: String, trim: true, default: "", maxlength: 500 },
  city: { type: String, trim: true, default: "", maxlength: 120 },
  source: { type: String, enum: ["Walk-in", "Phone Call", "WhatsApp", "Referral", "Email", "Social Media", "Other"], default: "Other" },
  status: { type: String, enum: ["New", "Contacted", "Qualified", "Customer", "Converted", "Lost"], default: "New" },
  customer_added: { type: Boolean, default: false },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
  product_interest: { type: String, trim: true, default: "", maxlength: 500 },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
  assigned_employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  estimated_deal_value: { type: Number, min: 0, default: null },
  expected_purchase_date: { type: Date, default: null },
  next_follow_up_date: { type: Date, default: null },
  lost_reason: { type: String, trim: true, default: "", maxlength: 1000 },
  products: { type: [leadProductSchema], default: [] },
  custom_requirements: { type: String, trim: true, default: "", maxlength: 5000 },
  notes: { type: String, trim: true, default: "", maxlength: 5000 },
  activities: { type: [activitySchema], default: [] },
  history: { type: [historyEntrySchema], default: [] },
  createdby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date, default: null },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

leadSchema.index({ created_at: -1, _id: -1 });
leadSchema.index({ status: 1, is_deleted: 1, created_at: -1 });
leadSchema.index({ phone: 1, is_deleted: 1 });

module.exports = mongoose.model("Lead", leadSchema);
