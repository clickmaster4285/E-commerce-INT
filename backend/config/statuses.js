// ==========================================
// STATUS LISTS + ALLOWED TRANSITIONS (§3.10)
// Controllers ab copy-paste arrays ki jagah yahan se import karen.
// ==========================================

const ORDER_STATUSES = Object.freeze([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

const PO_STATUSES = Object.freeze([
  "pending",
  "confirmed",
  "delivered",
  "closed",
  "cancelled",
]);

const INVOICE_STATUSES = Object.freeze([
  "Unpaid",
  "Partially Paid",
  "Paid",
  "Overdue",
]);

/** @type {Record<string, readonly string[]>} */
const ORDER_ALLOWED_TRANSITIONS = Object.freeze({
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
});

/** @type {Record<string, readonly string[]>} */
const PO_ALLOWED_TRANSITIONS = Object.freeze({
  pending: ["confirmed", "cancelled"],
  confirmed: ["delivered", "cancelled"],
  delivered: ["closed"],
  closed: [],
  cancelled: [],
});

/** @type {Record<string, readonly string[]>} */
const INVOICE_ALLOWED_TRANSITIONS = Object.freeze({
  Unpaid: ["Partially Paid", "Paid", "Overdue"],
  "Partially Paid": ["Paid", "Overdue", "Unpaid"],
  Paid: [],
  Overdue: ["Partially Paid", "Paid", "Unpaid"],
});

const ALLOWED_TRANSITIONS = Object.freeze({
  order: ORDER_ALLOWED_TRANSITIONS,
  po: PO_ALLOWED_TRANSITIONS,
  invoice: INVOICE_ALLOWED_TRANSITIONS,
});

/**
 * @param {"order"|"po"|"invoice"} kind
 * @param {string} fromStatus
 * @param {string} toStatus
 */
function isAllowedTransition(kind, fromStatus, toStatus) {
  const from = String(fromStatus ?? "").trim();
  const to = String(toStatus ?? "").trim();
  if (!from || !to || from === to) return false;
  const map = ALLOWED_TRANSITIONS[kind];
  if (!map) return false;
  const next = map[from];
  if (!next) return false;
  return next.includes(to);
}

module.exports = {
  ORDER_STATUSES,
  PO_STATUSES,
  INVOICE_STATUSES,
  ORDER_ALLOWED_TRANSITIONS,
  PO_ALLOWED_TRANSITIONS,
  INVOICE_ALLOWED_TRANSITIONS,
  ALLOWED_TRANSITIONS,
  isAllowedTransition,
};