// ==========================================================
// LEDGER — double-entry journal (§3.9)
// ----------------------------------------------------------
// Controllers seedha ledger_entries / account_balances na likhein —
// sirf ledger.post() use karo.
// ==========================================================
const mongoose = require("mongoose");
const LedgerEntry = require("../models/LedgerEntry");
const AccountBalance = require("../models/AccountBalance");
const { nextSeq } = require("../utils/counter");
const { getStoreId } = require("../utils/tenantContext");

/** Per-store chart of accounts — seed list */
const CHART_OF_ACCOUNTS = [
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
];

const withSession = (opts, session) => (session ? { ...opts, session } : opts);
const partyKey = (partyId) => (partyId ? String(partyId) : "");

function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length < 1) {
    throw new Error("Ledger requires at least one line");
  }
  let debits = 0;
  let credits = 0;
  for (const line of lines) {
    debits += Number(line.debit_minor) || 0;
    credits += Number(line.credit_minor) || 0;
  }
  if (debits !== credits || debits <= 0) {
    throw new Error("Ledger lines must balance (Σdebit === Σcredit)");
  }
}

/**
 * @param {{ ref_type?: string, ref_id?: import("mongoose").Types.ObjectId, memo?: string, lines: object[], posted_by?: import("mongoose").Types.ObjectId }} input
 * @param {import("mongoose").ClientSession} [session]
 */
async function post(input, session) {
  const { ref_type = "", ref_id = null, memo = "", lines, posted_by = null } = input;
  validateLines(lines);

  const journal_no = await nextSeq("ledger_journal", withSession({}, session));
  const at = new Date();

  const [entry] = await LedgerEntry.create(
    [{ journal_no, at, ref_type, ref_id, memo, lines, posted_by }],
    withSession({}, session),
  );

  for (const line of lines) {
    const debit = Number(line.debit_minor) || 0;
    const credit = Number(line.credit_minor) || 0;
    const net = debit - credit;
    if (net === 0) continue;

    const pid = partyKey(line.party_id);
    await AccountBalance.updateOne(
      {
        account: line.account,
        party_id: pid,
        ...(line.party_type ? { party_type: line.party_type } : {}),
      },
      {
        $inc: { balance_minor: net },
        $setOnInsert: {
          party_type: line.party_type || null,
        },
      },
      withSession({ upsert: true }, session),
    );
  }

  return entry;
}

/**
 * Chart accounts ke liye zero balance rows (idempotent).
 * @param {import("mongoose").Types.ObjectId|string} [_storeId] — tenant context se storeId aata hai
 * @param {import("mongoose").ClientSession} [session]
 */
async function ensureChartOfAccounts(_storeId, session) {
  const storeId = _storeId || getStoreId();
  if (!storeId) throw new Error("ensureChartOfAccounts needs store context");

  for (const account of CHART_OF_ACCOUNTS) {
    await AccountBalance.updateOne(
      { account, party_id: "" },
      {
        $setOnInsert: {
          balance_minor: 0,
          party_type: null,
        },
      },
      withSession({ upsert: true }, session),
    );
  }
  return CHART_OF_ACCOUNTS;
}

module.exports = { post, ensureChartOfAccounts, CHART_OF_ACCOUNTS, validateLines };