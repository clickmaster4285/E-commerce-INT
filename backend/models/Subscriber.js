const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// ==========================================================
// NEWSLETTER SUBSCRIBER — store editor ke newsletter section se
// Email har store me unique ({ storeId, email }). Unsubscribe = status.
// ==========================================================

const subscriberSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    status: { type: String, enum: ["subscribed", "unsubscribed"], default: "subscribed" },
    locale: { type: String, default: "en", maxlength: 10 },
    source: { type: String, default: "newsletter_section", maxlength: 40 },
  },
  { timestamps: true, collection: "subscribers" },
);

// ── Multi-tenant ──
subscriberSchema.plugin(tenantScope);
subscriberSchema.index({ storeId: 1, email: 1 }, { unique: true });
subscriberSchema.index({ storeId: 1, status: 1, createdAt: -1 });

subscriberSchema.statics.EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = mongoose.model("Subscriber", subscriberSchema);
