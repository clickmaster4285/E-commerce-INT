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
  // §3.7 convention: created_at / updated_at. Purane docs me createdAt/updatedAt stored hain —
  // controller DTO (toDto) dono ko dual-read karta hai (FE nahi tootta).
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "contact_messages" },
);

// ── Multi-tenant ──
contactMessageSchema.plugin(tenantScope);
contactMessageSchema.index({ storeId: 1, created_at: -1 });
contactMessageSchema.index({ storeId: 1, createdAt: -1 }); // legacy docs
contactMessageSchema.index({ storeId: 1, status: 1, created_at: -1 });

/** Lean doc → FE DTO: createdAt/updatedAt dual-read (legacy docs me created_at nahi hota) */
contactMessageSchema.statics.toDto = (doc) => (doc ? {
  ...doc,
  createdAt: doc.created_at || doc.createdAt,
  updatedAt: doc.updated_at || doc.updatedAt,
} : doc);

module.exports = mongoose.model("ContactMessage", contactMessageSchema);
