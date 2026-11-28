const mongoose = require("mongoose");

// §3.7 — Cart / CheckoutDraft items ka typed subschema (pehle Mixed tha)
// ⚠️ strict:false — purane docs aur deal/bundle fields (key, regularPrice, dealId ...) as-is save hote rehte hain.
// variant_id / product_id Mixed-ish rakhe hain: gift lines me null aur legacy docs me string aa sakti hai.
const MAX_CART_ITEMS = 50;

const cartItemSchema = new mongoose.Schema(
  {
    key: { type: String },
    // default nahi — purane docs ka shape response me badalna nahi chahiye
    product_id: { type: mongoose.Schema.Types.Mixed },
    variant_id: { type: mongoose.Schema.Types.Mixed },
    qty: { type: Number },
  },
  { _id: false, strict: false },
);

// Array size cap validator — items field me `validate` ke tor par lagao
const maxItemsValidator = {
  validator: (arr) => !Array.isArray(arr) || arr.length <= MAX_CART_ITEMS,
  message: `Cart me max ${MAX_CART_ITEMS} items allowed hain`,
};

module.exports = { cartItemSchema, maxItemsValidator, MAX_CART_ITEMS };
