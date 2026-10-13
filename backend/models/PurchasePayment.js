const mongoose = require("mongoose");

const purchasePaymentSchema = new mongoose.Schema(
  {
    po_id: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true, index: true },
    vendor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: {
      type: String,
      enum: ["bank", "cash", "cod", "credit", "advance_adjust"],
      required: true,
    },
    paid_at: { type: Date, default: Date.now },
    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

purchasePaymentSchema.index({ po_id: 1, created_at: -1 });

module.exports = mongoose.model("PurchasePayment", purchasePaymentSchema);
