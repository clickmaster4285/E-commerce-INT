// ==========================================================
// REFRESH SESSION — har login ka ek record (rotation + revoke)
// ----------------------------------------------------------
//   jti       → is refresh token ki unique id (har refresh par naya)
//   familyId  → ek login se bani poori chain; reuse pakra jaye to poori family revoke
//   aud       → "user" | "admin" | "superadmin"
//   storeId   → session kis store ka hai (superadmin: null)
//   tokenHash → sha256(refresh token) — asli token DB me nahi
//
// ⚠️ tenantScope plugin JAAN BOOJH KAR nahi lagaya: superadmin sessions ka
// koi store nahi, aur rotation/revoke ko platform host par bhi chalna hai.
// storeId har jagah explicitly compare hota hai (utils/tokens.js).
// ==========================================================

const mongoose = require("mongoose");

const refreshSessionSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    aud: { type: String, required: true, enum: ["user", "admin", "superadmin"] },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null }, // rotated | logout | reuse | password_change | invalid_subject
    replacedBy: { type: String, default: null },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: true },
);

// Expire hote hi Mongo khud delete kar deta hai
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshSessionSchema.index({ aud: 1, subjectId: 1, revokedAt: 1 });

module.exports = mongoose.model("RefreshSession", refreshSessionSchema);
