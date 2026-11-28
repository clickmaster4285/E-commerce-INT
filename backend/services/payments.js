// ==========================================================
// PAYMENTS — append-only money facts (§3.9)
// ----------------------------------------------------------
// captured status par ledger.post() ledger me entry daalta hai.
// ==========================================================
const Payment = require("../models/Payment");
const ledger = require("./ledger");

const withSession = (opts, session) => (session ? { ...opts, session } : opts);

const METHOD_LEDGER_ACCOUNT = {
  cash: "cash",
  cod: "cash",
  card: "card_clearing",
  mobile_wallet: "wallet",
  bank: "bank",
  bank_transfer: "bank",
  store_credit: "store_credit",
  other: "bank",
};

function ledgerAccountForMethod(method_code) {
  const code = String(method_code || "cash").toLowerCase();
  return METHOD_LEDGER_ACCOUNT[code] || "cash";
}

function journalLinesForPayment({ direction, method_code, amount_minor, party_type, party_id }) {
  const asset = ledgerAccountForMethod(method_code);
  const party = party_id || null;
  const pt = party_type || null;

  if (direction === "in") {
    return [
      { account: asset, party_type: pt, party_id: party, debit_minor: amount_minor, credit_minor: 0 },
      { account: "sales_revenue", party_type: null, party_id: null, debit_minor: 0, credit_minor: amount_minor },
    ];
  }
  // Customer refund / sale return — sales_returns Dr / cash Cr
  if (pt === "customer") {
    return [
      { account: "sales_returns", party_type: null, party_id: null, debit_minor: amount_minor, credit_minor: 0 },
      { account: asset, party_type: null, party_id: null, debit_minor: 0, credit_minor: amount_minor },
    ];
  }
  // vendor / payout — AP debit, cash credit
  return [
    { account: "accounts_payable", party_type: pt || "vendor", party_id: party, debit_minor: amount_minor, credit_minor: 0 },
    { account: asset, party_type: null, party_id: null, debit_minor: 0, credit_minor: amount_minor },
  ];
}

/**
 * @param {object} input
 * @param {import("mongoose").ClientSession} [session]
 */
async function record(input, session) {
  const {
    direction,
    method_code,
    amount_minor,
    currency = "PKR",
    status = "pending",
    ref_type,
    ref_id,
    party_type = null,
    party_id = null,
    reference = "",
    received_by = null,
    idempotency_key = null,
  } = input;

  if (idempotency_key) {
    let dupQuery = Payment.findOne({ idempotency_key });
    if (session) dupQuery = dupQuery.session(session);
    const existing = await dupQuery.lean();
    if (existing) return { payment: existing, idempotent: true, ledgerEntry: null };
  }

  const at = new Date();
  const [payment] = await Payment.create(
    [
      {
        direction,
        method_code,
        amount_minor,
        currency,
        status,
        ref_type,
        ref_id,
        party_type,
        party_id,
        reference,
        received_by,
        idempotency_key,
        at,
      },
    ],
    withSession({}, session),
  );

  let ledgerEntry = null;
  if (status === "captured") {
    const lines = journalLinesForPayment({
      direction,
      method_code,
      amount_minor,
      party_type,
      party_id,
    });
    ledgerEntry = await ledger.post(
      {
        ref_type: `payment:${ref_type}`,
        ref_id: payment._id,
        memo: reference || `${direction} ${method_code}`,
        lines,
        posted_by: received_by,
      },
      session,
    );
  }

  return { payment, idempotent: false, ledgerEntry };
}

module.exports = { record, ledgerAccountForMethod, journalLinesForPayment };