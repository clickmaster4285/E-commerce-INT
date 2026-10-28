const mongoose = require("mongoose");

const auditChangeSchema = new mongoose.Schema({ field: String, before: String, after: String }, { _id: false });
const activitySchema = new mongoose.Schema({ type: { type: String, required: true }, at: { type: Date, default: Date.now }, actor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null }, actor_name: { type: String, default: "Administrator" }, changes: { type: [auditChangeSchema], default: [] } }, { _id: false });

const vendorSchema = new mongoose.Schema(
  {
    vendor_code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    company_name: { type: String, trim: true, default: "" },
    translations: {
      name: { type: Map, of: String, default: () => ({}) },
      company_name: { type: Map, of: String, default: () => ({}) },
      address: { type: Map, of: String, default: () => ({}) },
      city: { type: Map, of: String, default: () => ({}) },
      state: { type: Map, of: String, default: () => ({}) },
      country: { type: Map, of: String, default: () => ({}) },
    },
    translation_source: {
      name: { type: String, default: "" },
      company_name: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    translation_status: {
      name: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
      company_name: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
      address: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
      city: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
      state: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
      country: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
    },
    contact_person: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    whatsapp: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    zip_code: { type: String, trim: true, default: "" },
    tax_id: { type: String, trim: true, default: "" },
    bank_details: {
      bank: { type: String, trim: true, default: "" },
      account_title: { type: String, trim: true, default: "" },
      account_no: { type: String, trim: true, default: "" },
    },
    lead_time_days: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    is_active: { type: Boolean, default: true },
    balance_payable: { type: Number, default: 0, min: 0 },
    total_purchased: { type: Number, default: 0, min: 0 },
    total_paid: { type: Number, default: 0, min: 0 },
    is_deleted: { type: Boolean, default: false, index: true },
    deleted_at: { type: Date, default: null },
    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    deletedby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    activity: { type: [activitySchema], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

vendorSchema.index({ vendor_code: 1, is_deleted: 1 }, { unique: true });
vendorSchema.index({ name: 1, is_deleted: 1 });
vendorSchema.index({ city: 1, is_deleted: 1 });

vendorSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, is_deleted: false });
};

vendorSchema.methods.softDelete = async function (userId) {
  this.is_deleted = true;
  this.deleted_at = new Date();
  this.deletedby = userId || null;
  return this.save();
};

vendorSchema.methods.restore = async function () {
  this.is_deleted = false;
  this.deleted_at = null;
  this.deletedby = null;
  return this.save();
};

module.exports = mongoose.model("Vendor", vendorSchema);
