const mongoose = require("mongoose");

// ==========================================
// 🔐 OTP MODEL
// ==========================================
// Ek hi model dono flows handle karta hai:
//   - email_verification (register ke baad email verify)
//   - password_reset     (forgot password)
// Code kabhi plain text mein save nahi hota — bcrypt hash hota hai.

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    purpose: {
      type: String,
      required: true,
      enum: ["email_verification", "password_reset"],
    },
    code_hash: { type: String, required: true },
    expires_at: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    // ✅ password_reset mein OTP verify hone ke baad reset-token issue hota hai
    verified: { type: Boolean, default: false },
    // ✅ consume hone ke baad dobara use nahi ho sakta
    consumed: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

// ✅ TTL — expire hone par document khud delete ho jata hai
otpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
// ✅ Latest OTP quickly dhoondhne ke liye
otpSchema.index({ email: 1, purpose: 1, created_at: -1 });

module.exports = mongoose.model("Otp", otpSchema);
