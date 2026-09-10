const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    // User se link (Har employee ka ek user account hona chahiye)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    // --- HR & Organizational Details ---
    employeeCode: { type: String, default: "", trim: true }, // Pehlay employeeId tha, ab code rakh dia
    department: { type: String, default: "", trim: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null },
    dateOfBirth: { type: String, default: "" },
    address: { type: String, default: "" },

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
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        performedByName: { type: String, default: "System" },
        details: { type: mongoose.Schema.Types.Mixed, default: {} },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // --- Audit Fields ---
    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Activities ko timestamp ke hisaab se fast query karne ke liye index
employeeSchema.index({ "activities.timestamp": -1 });
employeeSchema.index({ storeId: 1, department: 1 });

module.exports = mongoose.model("Employee", employeeSchema);