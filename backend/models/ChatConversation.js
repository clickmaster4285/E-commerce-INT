const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
  inquiry_type: { type: String, enum: ["general", "product", "cart", "order"], default: "general", index: true },
  inquiry_context: { type: mongoose.Schema.Types.Mixed, default: null },
  inquiry_product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  inquiry_variant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
  guest_name: { type: String, trim: true, maxlength: 80, default: "" },
  guest_email: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
  guest_token_hash: { type: String, select: false, unique: true, sparse: true },
  status: { type: String, enum: ["open", "closed"], default: "open", index: true },
  last_message: { type: String, default: "", maxlength: 4000 },
  last_message_at: { type: Date, default: Date.now, index: true },
  last_message_sender_type: { type: String, enum: ["customer", "admin", ""], default: "" },
  unread_admin_count: { type: Number, default: 0, min: 0 },
  unread_customer_count: { type: Number, default: 0, min: 0 },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });
schema.index({ customer_id: 1, order_id: 1 }, { unique: true, partialFilterExpression: { status: "open", customer_id: { $type: "objectId" } } });
schema.index({ status: 1, last_message_at: -1 });
schema.set("autoIndex", false);
schema.statics.ensureChatIndexes = async function ensureChatIndexes() {
  const indexes = await this.collection.indexes().catch((error) => {
    if (error.codeName === "NamespaceNotFound") return [];
    throw error;
  });
  const obsoleteOrderIndex = indexes.find((index) =>
    index.unique && index.key?.customer_id === 1 && index.key?.order_id === 1 &&
    index.partialFilterExpression?.status === "open" && !index.partialFilterExpression?.customer_id
  );
  if (obsoleteOrderIndex) await this.collection.dropIndex(obsoleteOrderIndex.name);
  await this.createIndexes();
};
module.exports = mongoose.models.ChatConversation || mongoose.model("ChatConversation", schema);
