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
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, default: "" },
    role: { type: String, default: "user", enum: ["user", "admin", "staff"] },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
    },
    avatar: { type: String, default: "" },

     wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    twoFactorEnabled: { type: Boolean, default: false },
    permissions: {
      products: { type: Boolean, default: true },
      brands: { type: Boolean, default: true },
      categories: { type: Boolean, default: true },
      users: { type: Boolean, default: false },
      orders: { type: Boolean, default: true },
      settings: { type: Boolean, default: true },
      profile: { type: Boolean, default: true },       // ✅ Added
      employees: { type: Boolean, default: true },     // ✅ Added
      discounts: { type: Boolean, default: true },     // ✅ Added
      store: { type: Boolean, default: false },        // ✅ Added
    },
    
    preferences: {
      darkMode: { type: Boolean, default: true },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        weekly: { type: Boolean, default: true },
      },
    },

    // ✅ NEW: Checkout Draft (step/choices refresh par yaad rahein)
      // ✅ MULTIPLE DRAFTS (array of drafts)
    checkout_drafts: [{
      step: { type: Number, default: 1 },
      selectedKeys: [{ type: String }],
      selectedAddressId: { type: mongoose.Schema.Types.ObjectId, default: null },
      shippingMethod: { type: String, default: "standard" },
      paymentMethod: { type: String, default: "cod" },
      saved: { type: Boolean, default: false },
      items: { type: mongoose.Schema.Types.Mixed, default: [] },
      updatedAt: { type: Date, default: Date.now },
    }],
    
    activities: [
      {
        action: { type: String, required: true },
        category: {
          type: String,
          enum: [
            "Employee Management",
            "Brand Management",
            "Category Management",
            "Product Management",
            "Store Management",
            "Order Management",
            "Customer Management",
            "Coupon Management",
            "Authentication",
            "System",
          ],
          default: "System",
        },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        performedByName: { type: String, default: "System" },
        details: { type: mongoose.Schema.Types.Mixed, default: {} },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    ordersHandled: { type: Number, default: 0 },
    salesGenerated: { type: Number, default: 0 },
    productsAdded: { type: Number, default: 0 },
    performanceRating: { type: Number, default: 0 },
    dateOfBirth: { type: String, default: "" },
    address: { type: String, default: "" },
    employeeId: { type: String, default: "" },

    createdby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
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

userSchema.index({ "activities.timestamp": -1 });

userSchema.methods.softDelete = function (userId) {
  this.is_deleted = true;
  this.deleted_at = new Date();
  this.deletedby = userId;
  return this.save();
};

module.exports = mongoose.model("User", userSchema);
