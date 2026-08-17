const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    action: {
      type: String,
      required: true,
      // e.g., "Updated employee John Doe", "Created brand Realme"
    },
    category: {
      type: String,
      enum: [
        "Authentication",
        "Employee Management",
        "Product Management",
        "Order Management",
        "Customer Management",
        "Coupon Management",
        "Brand Management",
        "System",
      ],
      default: "System",
    },
    details: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
      // e.g., { field: "email", oldValue: "a@b.com", newValue: "c@d.com" }
    },
    ipAddress: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for fast queries
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ targetUser: 1, createdAt: -1 });
activitySchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model("Activity", activitySchema);