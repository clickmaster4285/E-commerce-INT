// ==========================================================
// STOCK RESERVATION SWEEPER (§3.9 / §6.2)
// ----------------------------------------------------------
// Expired active reservations: reserved -= qty, status → expired.
// TTL index alone on_hand/reserved nahi chhuuta — is liye leader-locked job.
// ==========================================================
const cron = require("node-cron");
const StockReservation = require("../models/StockReservation");
const StockLevel = require("../models/StockLevel");
const log = require("../utils/logger");
const { runUnscoped } = require("../utils/tenantContext");
const { withLeaderLock } = require("../utils/leaderLock");
const { withTx } = require("../utils/tx");

let task = null;
let isRunning = false;

async function sweepOnce() {
  if (isRunning) return { skipped: true };
  isRunning = true;
  let released = 0;
  try {
    await withLeaderLock("stock-reservation-sweeper", async () => {
      await runUnscoped(async () => {
        const now = new Date();
        const expired = await StockReservation.find({
          status: "active",
          expires_at: { $lte: now },
        })
          .limit(200)
          .lean();

        for (const row of expired) {
          try {
            await withTx(async () => {
              const claim = await StockReservation.findOneAndUpdate(
                { _id: row._id, status: "active" },
                { $set: { status: "expired" } },
                { returnDocument: "after" },
              );
              if (!claim) return;
              const n = Number(claim.qty) || 0;
              if (n > 0) {
                await StockLevel.updateOne(
                  {
                    storeId: claim.storeId,
                    variant_id: claim.variant_id,
                    location_id: claim.location_id || "main",
                    reserved: { $gte: n },
                  },
                  { $inc: { reserved: -n } },
                ).setOptions({ skipTenantScope: true });
              }
            });
            released += 1;
          } catch (err) {
            log.warn("reservationSweeper row:", err?.message || err);
          }
        }
      });
    });
  } catch (err) {
    log.error("reservationSweeper:", err?.message || err);
  } finally {
    isRunning = false;
  }
  return { released };
}

function start() {
  if (task) return task;
  // Har minute — short-lived checkout holds
  task = cron.schedule("* * * * *", () => {
    sweepOnce().catch(() => {});
  });
  return task;
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { start, stop, sweepOnce };
