const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");
const translatablePlugin = require("./shared/translatablePlugin");

// Legal / policy texts — kam read frequency (§3.10)
const storeContentSchema = new mongoose.Schema(
  {
    return_policy: { type: String, default: "" },
    privacy_policy: { type: String, default: "" },
    terms_conditions: { type: String, default: "" },
    quote_terms_conditions: { type: String, default: "" },
    invoice_terms_conditions: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

storeContentSchema.plugin(translatablePlugin, [
  "return_policy",
  "privacy_policy",
  "terms_conditions",
  "quote_terms_conditions",
  "invoice_terms_conditions",
]);

storeContentSchema.plugin(tenantScope);
storeContentSchema.index({ storeId: 1 }, { unique: true });

module.exports = mongoose.model("StoreContent", storeContentSchema);