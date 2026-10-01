const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    // User link optional ab (self-contained employee record)
   

    // --- Core Identity Fields (direct on Employee) ---
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
    phone: { type: String, default: "", trim: true },
    role: {
      type: String,
      default: "staff",
      enum: ["user", "admin", "staff", "manager"],
    },
    status: { type: String, default: "active", enum: ["active", "inactive"] },
    // Profile picture — optimized data URL (Employees form se set hoti hai)
    avatar: { type: String, default: "" },
  

    // --- Permissions (same structure as User) ---
    permissions: {
      products: { type: Boolean, default: true },
      brands: { type: Boolean, default: true },
      categories: { type: Boolean, default: true },
      users: { type: Boolean, default: false },
      orders: { type: Boolean, default: true },
      settings: { type: Boolean, default: true },
      profile: { type: Boolean, default: true },
      employees: { type: Boolean, default: true },
      discounts: { type: Boolean, default: true },
      deals: { type: Boolean, default: true },
      bundles: { type: Boolean, default: true },
      store: { type: Boolean, default: false },
      banners: { type: Boolean, default: true },
      manageStock: { type: Boolean, default: false },
      shipping: { type: Boolean, default: false },
      order: { type: Boolean, default: true },
      attribute: { type: Boolean, default: true },
    },

    preferences: {
      darkMode: { type: Boolean, default: true },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        weekly: { type: Boolean, default: true },
      },
    },

   
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null },

    // --- HR & Organizational Details ---
    employeeCode: { type: String, default: "", trim: true },
    department: { type: String, default: "", trim: true },

    // --- Performance & Stats ---
    ordersHandled: { type: Number, default: 0 },
    salesGenerated: { type: Number, default: 0 },
    productsAdded: { type: Number, default: 0 },
    performanceRating: { type: Number, default: 0 },

    // --- Activities Log ---
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
            "Discount Management",
            "Deals Management",
            "Authentication",
            "System",
          ],
          default: "System",
        },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
          default: null,
        },
        performedByName: { type: String, default: "System" },
        details: { type: mongoose.Schema.Types.Mixed, default: {} },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // --- Audit Fields ---
    createdby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    updatedby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

employeeSchema.index({ "activities.timestamp": -1 });
employeeSchema.index({ storeId: 1, department: 1 });

module.exports = mongoose.model("Employee", employeeSchema);
