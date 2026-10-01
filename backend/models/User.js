const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: false, minlength: 6 },
    // ✅ EMAIL VERIFICATION (OTP) — register ke baad OTP verify hone par true
    // Purane users ke liye undefined rehta hai jise login par verified maana jata hai
    emailVerified: { type: Boolean, default: false },
    google_id: { type: String, default: null },
    provider: { type: String, default: "local", enum: ["local", "google"] },
    phone: { type: String, default: "" },
    role: { type: String, default: "user", enum: ["user", "admin", "staff"] },

    // ✅ Account page fields — ye pehle schema mein the hi nahi,
    // isliye avatar save aur preferences silently drop ho rahe the
    avatar: { type: String, default: null },
    dob: { type: String, default: "" }, // YYYY-MM-DD (input type="date" se aata hai)
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: true },
      productRecommendations: { type: Boolean, default: true },
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
    },

    // ✅ createdby REMOVED — customer khud register karta hai, koi admin create nahi karta

    updatedby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

userSchema.methods.softDelete = function (userId) {
  this.is_deleted = true;
  this.deleted_at = new Date();
  this.deletedby = userId;
  return this.save();
};

module.exports = mongoose.model("User", userSchema);