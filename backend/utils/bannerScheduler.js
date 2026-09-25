const cron = require('node-cron');
const Banner = require('../models/Banner');

// Har minute check karo
cron.schedule('* * * * *', async () => {
  try {
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
  } catch (err) {
    console.error('Banner auto-schedule cron error:', err.message);
  }
});