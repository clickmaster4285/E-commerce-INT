const cron = require('node-cron');
const Banner = require('../models/Banner');
const log = require("./logger");
const { runUnscoped } = require("./tenantContext");
const { withLeaderLock } = require("./leaderLock");
const { invalidate: invalidatePublicCache } = require("./publicCache");

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
      const activated = await Banner.updateMany(
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
      const expired = await Banner.updateMany(
        {
          status: { $in: ['active', 'scheduled'] },
          endDate: { $lt: now },
        },
        { $set: { status: 'expired' } }
      );

      // Status badla to public banners cache foran drop (store context nahi → saare stores).
      // Storefront ka 60s cache-control phir bhi hai, lekin server memo ab stale nahi rehta.
      if ((activated?.modifiedCount || 0) + (expired?.modifiedCount || 0) > 0) {
        invalidatePublicCache('banners');
      }
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
  // Multi-instance: sirf leader (Redis lock) sweep chalaye; Redis na ho to hamesha chalta hai
  task = cron.schedule('* * * * *', () => withLeaderLock('banner', runOnce));
  return task;
}

module.exports = { start, runOnce };
