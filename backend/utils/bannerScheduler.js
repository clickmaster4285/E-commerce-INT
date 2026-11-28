const cron = require('node-cron');
const Banner = require('../models/Banner');
const log = require("./logger");
const { runUnscoped } = require("./tenantContext");

// Banner status har banner ki apni dates par chalta hai, is liye ek hi sweep
// saare stores ke banners par jaan-boojh kar chalti hai (runUnscoped) —
// koi leak hua store context isay ek store tak mehdood na kare.
let task = null;
let isRunning = false;

async function runOnce() {
  // Pichla tick abhi chal raha ho to overlap mat karo
  if (isRunning) return;
  isRunning = true;
  try {
    await runUnscoped(async () => {
      const now = new Date();

      // ✅ Scheduled/Draft → Active (start date aa gayi, end date nahi guzri)
      await Banner.updateMany(
        {
          status: { $in: ['scheduled', 'draft'] },
          startDate: { $ne: null, $lte: now },
          $or: [
            { endDate: null },
            { endDate: { $exists: false } },
            { endDate: { $gt: now } },
          ],
        },
        { $set: { status: 'active' } }
      );

      // ✅ Active/Scheduled → Expired (end date guzar gayi)
      await Banner.updateMany(
        {
          status: { $in: ['active', 'scheduled'] },
          endDate: { $lt: now },
        },
        { $set: { status: 'expired' } }
      );
    });
  } catch (err) {
    log.error('Banner auto-schedule cron error:', err.message);
  } finally {
    isRunning = false;
  }
}

// Sirf DB connect hone ke baad server.js se call karo. Do baar call ho to ek hi job.
function start() {
  if (task) return task;
  // Har minute check karo
  task = cron.schedule('* * * * *', runOnce);
  return task;
}

module.exports = { start, runOnce };
