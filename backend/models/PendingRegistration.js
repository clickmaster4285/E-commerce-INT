const mongoose = require("mongoose");

// ==========================================
// 📝 PENDING REGISTRATION (OTP verify se PEHLE)
// ==========================================
// Register dabane par User NAHI banta — sirf ye pending record banta hai.
// Sahi OTP par hi User document banega, phir ye record delete ho jayega.
// OTP aur password kabhi plain text mein save nahi hote — bcrypt hash hote hain.

const pendingRegistrationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    // ✅ bcrypt-hashed login password (User.create mein seedha pass hoga, dobara hash nahi hoga)
    passwordHash: { type: String, required: true },
    // ✅ bcrypt-hashed 6-digit OTP
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, versionKey: false },
);

// ✅ TTL — expiresAt ke baad MongoDB khud document delete kar dega
pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PendingRegistration", pendingRegistrationSchema);
