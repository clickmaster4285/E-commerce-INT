const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    vendor_code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    company_name: { type: String, trim: true, default: "" },
    contact_person: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    whatsapp: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    zip_code: { type: String, trim: true, default: "" },
    payment_terms: {
      type: String,
      enum: ["advance", "net_7", "net_15", "net_30", "cod"],
      default: "net_15",
    },
    tax_id: { type: String, trim: true, default: "" },
    bank_details: {
      bank: { type: String, trim: true, default: "" },
      account_title: { type: String, trim: true, default: "" },
      account_no: { type: String, trim: true, default: "" },
      iban: { type: String, trim: true, default: "" },
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
