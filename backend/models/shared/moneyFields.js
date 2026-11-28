/** Minor-unit money sub-fields (§3.9) — parent schema par spread / nested use */
const moneyAmountFields = {
  amount_minor: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, trim: true, uppercase: true },
};

const moneyAmountOptionalFields = {
  amount_minor: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: "", trim: true, uppercase: true },
};

module.exports = {
  moneyAmountFields,
  moneyAmountOptionalFields,
};