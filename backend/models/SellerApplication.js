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
    logo: {
      img_url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    business_category: { type: String, default: "", trim: true },
    business_type: {
      type: String,
      enum: ["individual", "registered_business"],
      default: "individual",
    },
    country: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    zip_code: { type: String, default: "", trim: true },
    // Verification documents uploaded during store setup (IDs, registration)
    documents: {
      type: [
        {
          name: { type: String, default: "", trim: true },
          url: { type: String, default: "", trim: true },
          public_id: { type: String, default: "" },
        },
      ],
      default: [],
    },
    // Seller confirmed store details + submitted documents → unlocks Super Admin approval
    setup_completed: { type: Boolean, default: false },
    // Super Admin can ask the seller for more info — shown on the setup page + emailed
    info_request_message: { type: String, default: "", trim: true },
    info_requested_at: { type: Date, default: null },
    // Review workflow
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rejection_reason: { type: String, default: "", trim: true },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "SuperAdmin", default: null },
    reviewed_at: { type: Date, default: null },
    // Provisioned on approval (exactly once)
    store_id: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

sellerApplicationSchema.index({ created_at: -1 });
sellerApplicationSchema.index({ store_id: 1 });
sellerApplicationSchema.index({ user_id: 1 });

module.exports = mongoose.model("SellerApplication", sellerApplicationSchema);
