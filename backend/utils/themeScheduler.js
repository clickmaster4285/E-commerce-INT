// ==========================================================
// THEME SCHEDULER — scheduled publish (store editor "Schedule")
// ----------------------------------------------------------
// Har minute: jin stores ka scheduled.at guzar chuka, unka snapshot publish.
//   • Atomic claim (findOneAndUpdate scheduled → null) — multi-instance par bhi
//     sirf EK server publish karta hai.
//   • Publish store context (runWithStore) me — tenant scope, cache invalidate,
//     socket room sab wahi jo Publish button par.
//   • Fail ho (schema invalid) → scheduled.error set, dobara try nahi (admin dekhe).
// ==========================================================

const cron = require("node-cron");
const StoreTheme = require("../models/StoreTheme");
const { runUnscoped, runWithStore } = require("./tenantContext");

let task = null;
let running = false;

async function runOnce({ now = new Date(), publish } = {}) {
  if (running) return 0;
  running = true;
  let published = 0;
  try {
    const publishThemeData = publish || require("../controllers/themeController").publishThemeData;
    const due = await runUnscoped(() =>
      StoreTheme.find({ "scheduled.at": { $lte: now } })
        .select("_id storeId")
        .setOptions({ skipTenantScope: true })
        .lean(),
    );

    for (const { _id, storeId } of due) {
      // Claim: jo instance pehle null kare wahi publish kare
      // eslint-disable-next-line no-await-in-loop
      const claimed = await runUnscoped(() =>
        StoreTheme.findOneAndUpdate(
          { _id, "scheduled.at": { $lte: now } },
          { $set: { scheduled: null } },
          { returnDocument: "before" },
        )
          .setOptions({ skipTenantScope: true })
          .lean(),
      );
      const snapshot = claimed?.scheduled;
      if (!snapshot?.data) continue;

      // eslint-disable-next-line no-await-in-loop
      await runWithStore(storeId, async () => {
        let io = null;
        try {
          io = require("./socket").getIO();
        } catch (_) {}
        const r = await publishThemeData({
          data: snapshot.data,
          storeId: String(storeId),
          actor: snapshot.by || null,
          note: snapshot.note ? `Scheduled: ${snapshot.note}` : "Scheduled publish",
          io,
        });
        if (r.ok) {
          published += 1;
        } else {
          console.error(`[themeScheduler] store ${storeId}: scheduled publish failed — ${r.message}`);
          await StoreTheme.updateOne({}, { $set: { lastScheduleError: { at: new Date(), message: r.message } } });
        }
      });
    }
  } catch (error) {
    console.error("[themeScheduler] failed:", error.message);
  } finally {
    running = false;
  }
  return published;
}

function start() {
  if (task) return task;
  task = cron.schedule("* * * * *", () => runOnce());
  return task;
}

module.exports = { start, runOnce };
