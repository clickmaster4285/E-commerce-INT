const mongoose = require("mongoose");
const log = require("../utils/logger");

/**
 * MongoDB connection (§3.1).
 * - Requires a replica set (transactions / majority / change streams).
 * - Prefer `mongodb://127.0.0.1:27017/...?replicaSet=rs0&retryWrites=true&w=majority`
 *   (member host must match rs config — use 127.0.0.1, not localhost).
 */
const connectDB = async () => {
  const sourceUri = process.env.MONGO_URI;
  if (!sourceUri || !String(sourceUri).trim()) {
    log.error("MONGO_URI is missing — set it in backend/.env (see .env.example)");
    process.exit(1);
  }

  // Drop any legacy retryWrites=false rewrite — replica set needs retryable writes.
  let mongoUri = String(sourceUri).trim();
  if (/[?&]retryWrites=false\b/i.test(mongoUri)) {
    mongoUri = mongoUri.replace(/([?&])retryWrites=false\b/gi, "$1retryWrites=true");
  } else if (!/[?&]retryWrites=/i.test(mongoUri)) {
    mongoUri += `${mongoUri.includes("?") ? "&" : "?"}retryWrites=true`;
  }
  if (!/[?&]w=/i.test(mongoUri)) {
    mongoUri += `${mongoUri.includes("?") ? "&" : "?"}w=majority`;
  }

  const isProd = process.env.NODE_ENV === "production";
  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 50,
      minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 0,
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_MS) || 5000,
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 45000,
      // Indexes: migrateTenantIndexes.js / ensure* scripts — not on every boot in prod
      autoIndex: !isProd && process.env.MONGO_AUTO_INDEX !== "false",
    });

    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello?.setName && hello?.msg !== "isdbgrid") {
      log.error("MongoDB must be a replica set (optimizeplan.md §3.1). hello.setName missing.");
      console.error("❌ MongoDB must be a replica set. See backend/README.md (rs0).");
      process.exit(1);
    }

    // Staging profiler (opt-in) — never force on production without ops sign-off
    if (process.env.MONGO_PROFILE_SLOWMS) {
      const slowms = Number(process.env.MONGO_PROFILE_SLOWMS) || 100;
      await mongoose.connection.db.command({ profile: 1, slowms }).catch((err) => {
        log.warn({ err: err.message }, "Could not enable MongoDB profiler");
      });
      log.info({ slowms }, "MongoDB profiler level 1 enabled");
    }

    log.info({ setName: hello.setName || "mongos", autoIndex: !isProd }, "MongoDB connected (replica set)");
    console.log(`✅ MongoDB connected (replica set: ${hello.setName || "mongos"})`);
  } catch (error) {
    log.error("MongoDB connection failed:", error.message);
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
