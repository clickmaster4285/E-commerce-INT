const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

// ==========================================================
// CONTACT MESSAGE — store editor ke "Contact form" section se
// Admin → Messages inbox (new / read / archived).
// ==========================================================

const contactMessageSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, default: "", trim: true, maxlength: 30 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: ["new", "read", "archived"], default: "new" },
    locale: { type: String, default: "en", maxlength: 10 },
    page: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true, collection: "contact_messages" },
);

// ── Multi-tenant ──
contactMessageSchema.plugin(tenantScope);
contactMessageSchema.index({ storeId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("ContactMessage", contactMessageSchema);
