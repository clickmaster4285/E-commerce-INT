// ==========================================
// PAYMENT METHOD CODES (§3.10) — ek canonical list
// Order / POS / Invoice alag enums se yahan normalize hote hain.
// ==========================================

const PAYMENT_METHOD_CODES = Object.freeze([
  "cash",
  "card",
  "bank_transfer",
  "mobile_wallet",
  "cod",
  "store_credit",
  "other",
]);

/** Invoice model abhi bhi enum ["Cash","Bank","Card","Other"] use karta hai */
const CODE_TO_INVOICE_LABEL = Object.freeze({
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank",
  mobile_wallet: "Other",
  cod: "Other",
  store_credit: "Other",
  other: "Other",
});

/**
 * @param {string} legacy — koi bhi purana payment string
 * @returns {string} canonical code (ya `other` agar match na ho)
 */
function normalizeMethod(legacy) {
  const raw = String(legacy ?? "").trim();
  if (!raw) return "other";
  const key = raw.toLowerCase();
  if (PAYMENT_METHOD_CODES.includes(key)) return key;
  // Purane enums / refund labels
  if (key === "bank") return "bank_transfer";
  if (key === "cash refund") return "cash";
  if (key === "balance adjustment") return "store_credit";
  return "other";
}

/** Canonical code → Invoice payment row ke liye legacy label */
function toInvoicePaymentLabel(code) {
  const c = normalizeMethod(code);
  return CODE_TO_INVOICE_LABEL[c] || "Other";
}

function isPaymentMethodCode(value) {
  return PAYMENT_METHOD_CODES.includes(String(value ?? "").trim().toLowerCase());
}

module.exports = {
  PAYMENT_METHOD_CODES,
  normalizeMethod,
  toInvoicePaymentLabel,
  isPaymentMethodCode,
};