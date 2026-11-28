// Per-store chart of accounts codes (§3.9 ledger) — seed / reference ke liye
const CHART_OF_ACCOUNT_CODES = Object.freeze([
  "cash",
  "bank",
  "card_clearing",
  "wallet",
  "accounts_receivable",
  "accounts_payable",
  "store_credit",
  "sales_revenue",
  "sales_returns",
  "discounts_given",
  "shipping_income",
  "tax_payable",
  "inventory",
  "cogs",
]);

/** Default ledger account jab store payment method seed ho */
const PAYMENT_METHOD_DEFAULT_LEDGER = Object.freeze({
  cash: "cash",
  card: "card_clearing",
  bank_transfer: "bank",
  mobile_wallet: "wallet",
  cod: "accounts_receivable",
  store_credit: "store_credit",
  other: "cash",
});

module.exports = {
  CHART_OF_ACCOUNT_CODES,
  PAYMENT_METHOD_DEFAULT_LEDGER,
};