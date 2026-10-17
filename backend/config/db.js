  const mongoose = require("mongoose");
  const log = require("../utils/logger");

  const connectDB = async () => {
    try {
      // Some MongoDB-compatible deployments require retryWrites=false in the URI itself.
      // Replace any existing value so an env URI containing retryWrites=true cannot win.
      const sourceUri = process.env.MONGO_URI;
      const hasRetryWrites = /[?&]retryWrites=/i.test(sourceUri);
      const mongoUri = hasRetryWrites
        ? sourceUri.replace(/([?&])retryWrites=[^&]*/gi, "$1retryWrites=false")
        : `${sourceUri}${sourceUri.includes("?") ? "&" : "?"}retryWrites=false`;
      await mongoose.connect(mongoUri, { retryWrites: false });
      log.info("MongoDB connected successfully");
    } catch (error) {
      log.error("MongoDB connection failed:", error.message);
      process.exit(1);
    }
  };

  module.exports = connectDB;
