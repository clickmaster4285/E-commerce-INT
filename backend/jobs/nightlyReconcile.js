// ==========================================================
// NIGHTLY MONEY / STOCK RECONCILE (§3.9 / §6.2)
// ----------------------------------------------------------
// Drift alert only — auto-fix nahi. Leader lock se multi-instance safe.
// ==========================================================
const cron = require("node-cron");
const mongoose = require("mongoose");
const StockLevel = require("../models/StockLevel");
const StockMovement = require("../models/StockMovement");
const Payment = require("../models/Payment");
const LedgerEntry = require("../models/LedgerEntry");
const AccountBalance = require("../models/AccountBalance");
const log = require("../utils/logger");
const { runUnscoped } = require("../utils/tenantContext");
const { withLeaderLock } = require("../utils/leaderLock");

let task = null;
let isRunning = false;

async function reconcileStock() {
  const drifts = [];
  const levels = await StockLevel.find({}).select("storeId variant_id location_id on_hand").lean().limit(5000);
  for (const level of levels) {
    const sum = await StockMovement.aggregate([
      {
        $match: {
          storeId: level.storeId,
          variant_id: level.variant_id,
          location_id: level.location_id || "main",
        },
      },
      { $group: { _id: null, total: { $sum: "$qty_delta" } } },
    ]);
    const movementSum = Number(sum[0]?.total) || 0;
    const onHand = Number(level.on_hand) || 0;
    if (movementSum !== onHand) {
      drifts.push({
        storeId: String(level.storeId),
        variant_id: String(level.variant_id),
        on_hand: onHand,
        movement_sum: movementSum,
        drift: onHand - movementSum,
      });
    }
  }
  return drifts;
}

async function reconcileLedgerBalances() {
  const drifts = [];
  const balances = await AccountBalance.find({}).lean().limit(5000);
  for (const bal of balances) {
    const match = {
      storeId: bal.storeId,
      "lines.account": bal.account,
    };
    if (bal.party_id) match["lines.party_id"] = bal.party_id;
    const rows = await LedgerEntry.aggregate([
      { $match: match },
      { $unwind: "$lines" },
      {
        $match: {
          "lines.account": bal.account,
          ...(bal.party_id ? { "lines.party_id": bal.party_id } : {}),
        },
      },
      {
        $group: {
          _id: null,
          net: { $sum: { $subtract: ["$lines.debit_minor", "$lines.credit_minor"] } },
        },
      },
    ]);
    const journalNet = Number(rows[0]?.net) || 0;
    const balance = Number(bal.balance_minor) || 0;
    if (journalNet !== balance) {
      drifts.push({
        storeId: String(bal.storeId),
        account: bal.account,
        party_id: bal.party_id ? String(bal.party_id) : null,
        balance_minor: balance,
        journal_net: journalNet,
        drift: balance - journalNet,
      });
    }
  }
  return drifts;
}

async function runOnce() {
  if (isRunning) return { skipped: true };
  isRunning = true;
  const report = { stockDrifts: [], ledgerDrifts: [], paymentCount: 0 };
  try {
    await withLeaderLock("nightly-reconcile", async () => {
      await runUnscoped(async () => {
        report.stockDrifts = await reconcileStock();
        report.ledgerDrifts = await reconcileLedgerBalances();
        report.paymentCount = await Payment.countDocuments({});
        if (report.stockDrifts.length || report.ledgerDrifts.length) {
          log.warn(
            {
              stockDrifts: report.stockDrifts.length,
              ledgerDrifts: report.ledgerDrifts.length,
              sampleStock: report.stockDrifts.slice(0, 5),
              sampleLedger: report.ledgerDrifts.slice(0, 5),
            },
            "nightlyReconcile drift detected",
          );
        } else {
          log.info({ paymentCount: report.paymentCount }, "nightlyReconcile ok");
        }
      });
    });
  } catch (err) {
    log.error("nightlyReconcile:", err?.message || err);
  } finally {
    isRunning = false;
  }
  return report;
}

function start() {
  if (task) return task;
  // 03:15 local — low traffic
  task = cron.schedule("15 3 * * *", () => {
    runOnce().catch(() => {});
  });
  return task;
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { start, stop, runOnce, reconcileStock, reconcileLedgerBalances };
