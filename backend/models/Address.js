const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    country: { type: String, default: "Pakistan", trim: true },
    full_name: { type: String, required: true, trim: true },
    street_address1: { type: String, required: true, trim: true },
    street_address2: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    zip_code: { type: String, default: "", trim: true },
    phone: { type: String, required: true, trim: true },
    is_default: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

module.exports = mongoose.model("Address", addressSchema);
