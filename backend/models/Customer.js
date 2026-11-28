const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");
const softDeletePlugin = require("../utils/softDeletePlugin");

const auditChangeSchema = new mongoose.Schema({ field: String, before: String, after: String }, { _id: false });
const activitySchema = new mongoose.Schema({ type: { type: String, required: true }, at: { type: Date, default: Date.now }, actor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null }, actor_name: { type: String, default: "Administrator" }, changes: { type: [auditChangeSchema], default: [] } }, { _id: false });

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    translations: {
      name: { type: Map, of: String, default: () => ({}) },
      address: { type: Map, of: String, default: () => ({}) },
    },
    translation_source: {
      name: { type: String, default: "" },
      address: { type: String, default: "" },
    },
    translation_status: {
      name: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
      address: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    // Storefront user account ↔ admin CRM customer (§3.6)
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Reverse link from Lead convert (§3.6)
    lead_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
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
    deletedby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    activity: { type: [activitySchema], default: [] },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// ── Multi-tenant ──
customerSchema.plugin(tenantScope); // har store ka data alag (storeId)
customerSchema.plugin(softDeletePlugin);
customerSchema.index({ storeId: 1, is_deleted: 1, created_at: -1 });
customerSchema.index({ storeId: 1, phone: 1 });
customerSchema.index({ storeId: 1, email: 1 });
customerSchema.index(
  { storeId: 1, user_id: 1 },
  { unique: true, partialFilterExpression: { user_id: { $type: "objectId" } } },
);

module.exports = mongoose.model("Customer", customerSchema);
