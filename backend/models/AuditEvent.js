const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

const changeSchema = new mongoose.Schema(
  {
    field: { type: String, default: "" },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const auditEventSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, trim: true, index: true },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    action: { type: String, required: true, trim: true },
    actorType: {
      type: String,
      enum: ["employee", "user", "superadmin", "system", "guest"],
      default: "system",
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    actorName: { type: String, default: "", trim: true },
    changes: { type: [changeSchema], default: [] },
    meta: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    at: { type: Date, default: Date.now, required: true },
  },
  { versionKey: false },
);

auditEventSchema.index({ storeId: 1, entityType: 1, entityId: 1, at: -1 });
auditEventSchema.index({ storeId: 1, at: -1 });
auditEventSchema.index({ storeId: 1, actorId: 1, at: -1 });

// TTL optional — abhi skip (optimizeplan §3.5); baad me low-value events par laga sakte hain

auditEventSchema.plugin(tenantScope);

module.exports = mongoose.model("AuditEvent", auditEventSchema);