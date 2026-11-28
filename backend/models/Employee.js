const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const employeeSchema = new mongoose.Schema(
  {
    // User link optional ab (self-contained employee record)
   

    // --- Core Identity Fields (direct on Employee) ---
    name: { type: String, required: true, trim: true },
    translations: {
      name: { type: Map, of: String, default: {} },
    },
    translation_source: { name: { type: String, default: "" } },
    translation_status: { name: { type: String, default: "pending" } },
    // Multi-tenant: unique sirf store ke andar ({storeId, username} / {storeId, email}
    // neeche). Seller OWNER email phir bhi poore platform me ek hi store ka — utils/sellerOwnership.js
    username: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: { type: String, default: "", trim: true },
    // storehandler = store owner (seller signup). Dekho utils/roles.js
    role: {
      type: String,
      default: "staff",
      enum: ["storehandler", "admin", "manager", "staff"],
    },
    // Seller-owner account created at signup stays pending until Super Admin approves.
    // While pending: the admin panel opens in read-only mode (GETs allowed, mutations blocked).
    seller_pending: { type: Boolean, default: false, index: true },
    status: { type: String, default: "active", enum: ["active", "inactive"] },
    // Profile picture — optimized data URL (Employees form se set hoti hai)
    avatar: { type: String, default: "" },
  

    // --- Permissions (same structure as User) ---
    // ✅ Sab permissions by default true — admin chahe to baad me off kar sakta hai
    permissions: {
      dashboard: { type: Boolean, default: true },
      products: { type: Boolean, default: true },
      brands: { type: Boolean, default: true },
      categories: { type: Boolean, default: true },
      users: { type: Boolean, default: true },
      settings: { type: Boolean, default: true },
      profile: { type: Boolean, default: true },
      employees: { type: Boolean, default: true },
      discounts: { type: Boolean, default: true },
      deals: { type: Boolean, default: true },
      bundles: { type: Boolean, default: true },
      store: { type: Boolean, default: true },
      banners: { type: Boolean, default: true },
      manageStock: { type: Boolean, default: true },
      shipping: { type: Boolean, default: true },
      // Canonical `orders` + legacy `order` (fixPermissions alias §5.4)
      orders: { type: Boolean, default: true },
      order: { type: Boolean, default: true },
      attribute: { type: Boolean, default: true },
      vendors: { type: Boolean, default: true },
      purchaseOrders: { type: Boolean, default: true },
      customers: { type: Boolean, default: true },
      leads: { type: Boolean, default: false },
      quotes: { type: Boolean, default: true },
      invoices: { type: Boolean, default: true },
      finance: { type: Boolean, default: false },
      pos: { type: Boolean, default: true },
      featuredProducts: { type: Boolean, default: true },
      reviews: { type: Boolean, default: true },
      storeEditor: { type: Boolean, default: true },
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

    // --- Address (profile page par employee ke liye bhi show ho) ---
    address: { type: String, default: "", trim: true },

    // --- HR & Organizational Details ---
    employeeCode: { type: String, trim: true },
    department: { type: String, trim: true },

    // --- Performance & Stats (only present once actually used) ---
    ordersHandled: { type: Number },
    salesGenerated: { type: Number },
    productsAdded: { type: Number },
    performanceRating: { type: Number },

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
    // Collection: admin_users (pehle "employees") — scripts/renameAuthCollections.js
    collection: "admin_users",
  }
);

employeeSchema.index({ storeId: 1, department: 1 });
employeeSchema.index({ storeId: 1, role: 1 });
// Per-store unique (purane global unique indexes migrateTenantIndexes.js hatata hai)
employeeSchema.index({ storeId: 1, email: 1 }, { unique: true });
employeeSchema.index({ storeId: 1, username: 1 }, { unique: true });
// Platform-wide login checks (seller ownership, duplicate phone)
employeeSchema.index({ username: 1 });
employeeSchema.index({ phone: 1 });
employeeSchema.index({ email: 1 });


// ── Multi-tenant ──
employeeSchema.plugin(tenantScope); // har store ka data alag (storeId)

module.exports = mongoose.model("Employee", employeeSchema);
