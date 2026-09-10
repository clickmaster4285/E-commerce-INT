const cron = require('node-cron');
const Banner = require('../models/Banner');

// Har minute check karo
cron.schedule('* * * * *', async () => {
  const now = new Date();

  // Scheduled → Active (start date aa gayi)
  await Banner.updateMany(
    {
      status: 'scheduled',
      autoPublish: true,
      startDate: { $lte: now }
    },
    { $set: { status: 'active' } }
  );

  // Active → Expired (end date guzar gayi)
  await Banner.updateMany(
    {
      status: 'active',
      autoDisable: true,
      endDate: { $lt: now }
    },
    { $set: { status: 'expired' } }
  );
});

