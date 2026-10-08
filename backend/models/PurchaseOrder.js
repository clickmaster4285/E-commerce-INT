const mongoose = require("mongoose");

const poItemSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, default: "" },
    variantTitle: { type: String, trim: true, default: "" },
    image: { type: String, default: "" },
    cost_price: { type: Number, required: true, min: 0 },
    qty_ordered: { type: Number, required: true, min: 1 },
    received_qty: { type: Number, default: 0, min: 0 },
    line_total: { type: Number, required: true, min: 0 },
    tax_rate: { type: Number, default: 0, min: 0, max: 100 },
    batch_no: { type: String, trim: true, default: "" },
    mfg_date: { type: Date, default: null },
    expiry_date: { type: Date, default: null },
  },
  { _id: false }
);

const receivingSchema = new mongoose.Schema(
  {
    received_at: { type: Date, default: Date.now },
    invoice_no: { type: String, required: true, trim: true },
    explanation: { type: String, required: true, trim: true },
    items: [
      {
        variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", required: true },
        product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
        qty: { type: Number, required: true, min: 1 },
        _id: false,
      },
    ],
    received_by: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    received_by_name: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    po_number: { type: String, unique: true, required: true, trim: true },
    vendor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    vendor_snapshot: {
      name: { type: String, default: "" },
      company_name: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
    },
    items: { type: [poItemSchema], required: true, validate: (v) => Array.isArray(v) && v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    shipping: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "delivered", "closed", "cancelled"],
      default: "pending",
      index: true,
    },
    payment_status: { type: String, enum: ["unpaid", "partial", "paid"], default: "unpaid" },
    paid_amount: { type: Number, default: 0, min: 0 },
    due_amount: { type: Number, default: 0, min: 0 },
    expected_date: { type: Date, default: null },
    due_date: { type: Date, default: null },
    notes: { type: String, default: "", trim: true },
    cancel_reason: { type: String, default: "", trim: true },
    receivings: { type: [receivingSchema], default: [] },
    is_deleted: { type: Boolean, default: false, index: true },
    deleted_at: { type: Date, default: null },
    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

purchaseOrderSchema.index({ vendor_id: 1, status: 1, created_at: -1 });
purchaseOrderSchema.index({ status: 1, created_at: -1 });

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
