const mongoose = require("mongoose");

// Seller application queue — public signup lands here as "pending".
// Super admin approves/rejects; approval provisions Store + User exactly once.
const sellerApplicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, default: "", trim: true },
    username: { type: String, trim: true, default: "" },
    // bcrypt hash — never plain text
    passwordHash: { type: String, required: true },
    // Requested store
    store_name: { type: String, required: true, trim: true },
    store_description: { type: String, default: "", trim: true },
    // Review workflow
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rejection_reason: { type: String, default: "", trim: true },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    reviewed_at: { type: Date, default: null },
    // Provisioned on approval (exactly once)
    store_id: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

sellerApplicationSchema.index({ created_at: -1 });

module.exports = mongoose.model("SellerApplication", sellerApplicationSchema);
