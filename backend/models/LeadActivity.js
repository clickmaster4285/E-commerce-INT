const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");

/** CRM lead activities (calls/meetings) — not audit (§3.5) */
const leadActivitySchema = new mongoose.Schema(
  {
    lead_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["call", "meeting", "note", "email", "follow_up", "other"],
      default: "note",
    },
    notes: { type: String, default: "", trim: true },
    follow_up_date: { type: Date, default: null },
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

leadActivitySchema.index({ storeId: 1, lead_id: 1, at: -1 });
leadActivitySchema.plugin(tenantScope);

module.exports = mongoose.model("LeadActivity", leadActivitySchema);
