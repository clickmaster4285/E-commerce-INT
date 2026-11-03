const mongoose = require("mongoose");
const contextItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  product_name: { type: String, default: "", maxlength: 160 },
  variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
  variant_name: { type: String, default: "", maxlength: 160 },
  variant_image: { type: String, default: "", maxlength: 300 },
  product_description: { type: String, default: "", maxlength: 1000 },
  sku: { type: String, default: "", maxlength: 80 },
  qty: { type: Number, min: 1, default: 1 },
  unit_price: { type: Number, min: 0, default: 0 },
  line_total: { type: Number, min: 0, default: 0 },
}, { _id: false });
const contextSchema = new mongoose.Schema({
  kind: { type: String, enum: ["cart", "product", "order"], required: true },
  label: { type: String, required: true, maxlength: 80 },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  product_name: { type: String, default: "", maxlength: 160 },
  product_description: { type: String, default: "", maxlength: 1000 },
  variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
  variant_name: { type: String, default: "", maxlength: 160 },
  variant_image: { type: String, default: "", maxlength: 300 },
  sku: { type: String, default: "", maxlength: 80 },
  unit_price: { type: Number, min: 0, default: null },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  order_number: { type: String, default: "", maxlength: 80 },
  order_status: { type: String, default: "", maxlength: 40 },
  item_count: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, default: 0 },
  items: { type: [contextItemSchema], default: [] },
}, { _id: false });
const schema = new mongoose.Schema({
  conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChatConversation", required: true },
  sender_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  sender_type: { type: String, enum: ["customer", "admin"], required: true },
  sender_name: { type: String, required: true, trim: true, maxlength: 120 },
  text: { type: String, required: true, trim: true, maxlength: 4000 },
  context_snapshot: { type: contextSchema, default: null },
  read_at: { type: Date, default: null },
}, { timestamps: { createdAt: "created_at", updatedAt: false } });
schema.index({ conversation_id: 1, created_at: -1, _id: -1 });
schema.index({ conversation_id: 1, sender_type: 1, read_at: 1 });
module.exports = mongoose.models.ChatMessage || mongoose.model("ChatMessage", schema);
