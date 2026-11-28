// backend/scripts/seedAttributes.js — patla wrapper; asal logic services/seedAttributes.js me hai.
// Manual backfill: node scripts/seedAttributes.js
const svc = require("../services/seedAttributes");
const log = require("../utils/logger");

if (require.main === module) {
  const mongoose = require("mongoose");
  require("dotenv").config();

  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      log.info("✅ DB Connected for standalone seeding");
      return svc.seedAttributes();
    })
    .catch(() => (process.exitCode = 1))
    .finally(async () => {
      await mongoose.disconnect();
      process.exit();
    });
}

module.exports = svc;
