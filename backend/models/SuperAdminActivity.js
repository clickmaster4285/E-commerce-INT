const mongoose = require("mongoose");

const superAdminActivitySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    actor: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "SuperAdmin", default: null },
      email: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    entityType: {
      type: String,
      enum: ["seller_application", "store", "user", "superadmin", "auth", "settings", "system"],
      default: "system",
      index: true,
    },
    entityId: { type: String, default: "" },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
    collection: "superadmin_activities",
  }
);

superAdminActivitySchema.index({ created_at: -1 });

module.exports = mongoose.model("SuperAdminActivity", superAdminActivitySchema);
