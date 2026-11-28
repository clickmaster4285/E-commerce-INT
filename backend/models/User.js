const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: false, minlength: 6, select: false },
    // ✅ EMAIL VERIFICATION (OTP) — register ke baad OTP verify hone par true
    // Purane users ke liye undefined rehta hai jise login par verified maana jata hai
    emailVerified: { type: Boolean, default: false },
    google_id: { type: String, default: null },
    provider: { type: String, default: "local", enum: ["local", "google"] },
    phone: { type: String, default: "" },
    // Account status — super admin can block a seller without deleting data
    status: { type: String, default: "active", enum: ["active", "blocked"], index: true },
    role: { type: String, default: "user", enum: ["user"] },

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
  // Collection: customer_users (pehle "users") — scripts/renameAuthCollections.js
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "customer_users" },
);

userSchema.methods.softDelete = function (userId) {
  this.is_deleted = true;
  this.deleted_at = new Date();
  this.deletedby = userId;
  return this.save();
};


// ── Multi-tenant ──
userSchema.plugin(tenantScope); // har store ka data alag (storeId)
userSchema.index({ storeId: 1, username: 1 }, { unique: true }); // unique per store
userSchema.index({ storeId: 1, email: 1 }, { unique: true }); // unique per store

module.exports = mongoose.model("User", userSchema);