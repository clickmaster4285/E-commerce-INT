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
    // Seller application — collected on the same signup page
    // Customer signup kis store par hua (store host). null = platform seller signup.
    // Verify isi store par hota hai — store A ka code store B / platform par nahi.
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null },
    storeName: { type: String, default: "", trim: true },
    storeDescription: { type: String, default: "", trim: true },
    businessCategory: { type: String, default: "", trim: true },
    businessType: { type: String, enum: ["individual", "registered_business"], default: "individual" },
    country: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    zipCode: { type: String, default: "", trim: true },
    storeLogoUrl: { type: String, default: "", trim: true },
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
