// ==========================================================
// USED TOKEN — one-time tokens (store handoff jti) ka "istemal ho chuka" record
// ----------------------------------------------------------
// Redis na ho (REDIS_URL khali) to utils/oneTimeToken.js isay use karta hai.
// _id unique hai → do servers / restart ke baad bhi ek token sirf ek baar.
// TTL index: token expire hote hi record khud delete.
// Platform-level (koi tenantScope nahi) — key me hi purpose + jti hai.
// ==========================================================

const mongoose = require("mongoose");

const usedTokenSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g. "handoff:<jti>"
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

usedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("UsedToken", usedTokenSchema);
