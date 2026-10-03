const mongoose = require("mongoose");

// ✅ Custom shipping methods — admin inko "Add New" se add karta hai.
//    'code' frontend checkout + orders mein method id ki tarah use hota hai.
const shippingMethodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    code: { type: String, required: true, unique: true, trim: true, lowercase: true },
    fee: { type: Number, default: 0, min: 0 },
    min_days: { type: Number, default: 2, min: 0 },
    max_days: { type: Number, default: 4, min: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ShippingMethod", shippingMethodSchema);