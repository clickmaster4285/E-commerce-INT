const mongoose = require("mongoose");
const tenantScope = require("../utils/tenantScopePlugin");
const immutablePlugin = require("../utils/immutablePlugin");

const ledgerLineSchema = new mongoose.Schema(
  {
    account: { type: String, trim: true, required: true },
    party_type: {
      type: String,
      enum: ["customer", "vendor", null],
      default: null,
    },
    party_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    debit_minor: { type: Number, default: 0, min: 0 },
    credit_minor: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const ledgerEntrySchema = new mongoose.Schema(
  {
    journal_no: { type: Number, required: true, min: 1 },
    at: { type: Date, default: Date.now },
    ref_type: { type: String, trim: true, default: "" },
    ref_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    memo: { type: String, trim: true, default: "" },
    lines: {
      type: [ledgerLineSchema],
      required: true,
      validate: {
        validator(lines) {
          if (!Array.isArray(lines) || lines.length < 2) return false;
          let debits = 0;
          let credits = 0;
          for (const line of lines) {
            debits += Number(line.debit_minor) || 0;
            credits += Number(line.credit_minor) || 0;
          }
          return debits === credits && debits > 0;
        },
        message: "Ledger lines must balance (Σdebit === Σcredit)",
      },
    },
    posted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "ledger_entries",
  },
);

ledgerEntrySchema.plugin(tenantScope);
ledgerEntrySchema.plugin(immutablePlugin);

ledgerEntrySchema.index({ storeId: 1, at: -1 });
ledgerEntrySchema.index({ storeId: 1, ref_type: 1, ref_id: 1 });
ledgerEntrySchema.index({ storeId: 1, "lines.account": 1, at: -1 });
ledgerEntrySchema.index({ storeId: 1, "lines.party_id": 1, at: -1 });
ledgerEntrySchema.index({ storeId: 1, journal_no: 1 }, { unique: true });

module.exports = mongoose.model("LedgerEntry", ledgerEntrySchema);