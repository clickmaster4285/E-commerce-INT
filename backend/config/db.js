  const mongoose = require("mongoose");
  const log = require("../utils/logger");

  const connectDB = async () => {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      log.info("MongoDB connected successfully");
    } catch (error) {
      log.error("MongoDB connection failed:", error.message);
      process.exit(1);
    }
  };

  module.exports = connectDB;