// ==========================================================
// SERVER — HTTP + Socket.IO + DB + schedulers (optimizeplan.md §5.1)
// ----------------------------------------------------------
// Express app (middleware + routes) `app.js` me hai; ye file sirf process
// chalati hai: DB connect, socket init, seeding, schedulers, listen, aur
// graceful shutdown. Tests `require("./app")` karte hain (port nahi khulta).
// ==========================================================

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

const http = require("http");
const os = require("os");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const app = require("./app");
const connectDB = require("./config/db");
const log = require("./utils/logger");
const ChatConversation = require("./models/ChatConversation");
const SuperAdmin = require("./models/SuperAdmin");
const { initSocket } = require("./utils/socket");
const { ROOT_DOMAIN } = require("./utils/tenantHost");
const bannerScheduler = require("./utils/bannerScheduler");

const PORT = Number(process.env.PORT);
const HOST = process.env.HOST;
const API_PREFIX = process.env.API_PREFIX;
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS);
const UPLOAD_DIR = process.env.UPLOAD_DIR;
const STORE_UPLOAD_SUBDIR = process.env.STORE_UPLOAD_SUBDIR;
const BUNDLE_UPLOAD_SUBDIR = process.env.BUNDLE_UPLOAD_SUBDIR;
const REVIEW_UPLOAD_SUBDIR = process.env.REVIEW_UPLOAD_SUBDIR;
const STARTUP_MESSAGE = process.env.SERVER_STARTUP_MESSAGE;

const server = http.createServer(app);

// ==========================================
// STARTUP CONSOLE — sirf startup ke critical lines (DB / SMTP / port / server / socket).
// Ye logger se alag hai taake "server started" hamesha dikhe (dev me logger
// level "warn" hota hai).
// ==========================================
const startupLog = {
  info: (msg) => console.log(`ℹ️ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
};

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const net = require("net");
    const probe = net.createServer();
    probe.once("error", (error) => resolve(error.code !== "EADDRINUSE"));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port);
  });
}

// ==========================================
// SOCKET.IO — init + status (startup console ke liye)
// ==========================================
let socketStatus = "not connected";
let io = null;
try {
  io = initSocket(server);
  socketStatus = "connected";
} catch (socketErr) {
  // ✅ Socket fail ho jaye to server mat maro — baaki API chalti rahe
  socketStatus = `NOT connected (${socketErr.message})`;
}
app.set("io", io); // app.js → req.io

// ==========================================
// DIRECTORIES & SEEDING
// ==========================================
const uploadDir = path.join(__dirname, UPLOAD_DIR);
const createUploadDirectories = () => {
  const dirs = [uploadDir, path.join(uploadDir, STORE_UPLOAD_SUBDIR)];
  // Legacy shared folders (purane uploads) — naye uploads uploads/stores/<id>/ me jate hain
  if (BUNDLE_UPLOAD_SUBDIR) dirs.push(path.join(uploadDir, BUNDLE_UPLOAD_SUBDIR));
  if (REVIEW_UPLOAD_SUBDIR) dirs.push(path.join(uploadDir, REVIEW_UPLOAD_SUBDIR));
  for (const dir of dirs) if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const seedDefaultData = async () => {
  try {
    // Default store / store-admin auto-seed HATA diya gaya hai (multi-tenant):
    // stores sirf seller signup se bante hain (Super Admin approval ke baad).
    // Attributes startup par nahi — naya store save hote hi Store model seed karta hai.

    // Super Admin Seed (development convenience; production requires a strong password)
    const saEmail = process.env.SUPER_ADMIN_EMAIL;
    const saPassword = process.env.SUPER_ADMIN_PASSWORD;
    if (!saEmail || !saPassword) {
      log.warn("[superadmin] SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD not set; /super-admin will be unavailable.");
      return;
    }
    const emailSa = String(saEmail).toLowerCase().trim();
    const saName = process.env.SUPER_ADMIN_NAME || emailSa.split("@")[0];
    const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
    const minPasswordLength = Number(process.env.SUPER_ADMIN_MIN_PASSWORD_LENGTH);
    const passwordTooWeak =
      !Number.isFinite(minPasswordLength) ||
      minPasswordLength < 1 ||
      String(saPassword).length < minPasswordLength;
    if (isProduction && passwordTooWeak) {
      log.warn("[superadmin] Refusing to seed: set SUPER_ADMIN_MIN_PASSWORD_LENGTH and a SUPER_ADMIN_PASSWORD of at least that length in production.");
      return;
    }
    const existing = await SuperAdmin.findOne({ email: emailSa });
    if (existing) {
      log.info("[superadmin] Super Admin already seeded; keeping existing credentials.");
    } else {
      const hashed = await bcrypt.hash(String(saPassword), SALT_ROUNDS);
      await SuperAdmin.create({ name: saName, email: emailSa, passwordHash: hashed, status: "active" });
      log.info("[superadmin] Super Admin seeded.");
    }
  } catch (error) {
    log.error("❌ Seed Error:", error);
  }
};

// ==========================================
// GRACEFUL SHUTDOWN — deploy / restart par in-flight requests pure hon
// ==========================================
let shuttingDown = false;
async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  startupLog.info(`${signal} received — shutting down…`);
  const force = setTimeout(() => process.exit(exitCode || 1), 10000);
  force.unref();
  try {
    if (io) await new Promise((resolve) => io.close(() => resolve()));
    await new Promise((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  } catch (error) {
    log.error("Shutdown error:", error);
  } finally {
    process.exit(exitCode);
  }
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
// Pehle in errors par process chupke se mar jata ya ajeeb state me chalta rehta tha
process.on("unhandledRejection", (reason) => {
  log.error({ err: reason instanceof Error ? reason : new Error(String(reason)) }, "Unhandled promise rejection");
});
process.on("uncaughtException", (error) => {
  log.error({ err: error }, "Uncaught exception — exiting");
  console.error("❌ Uncaught exception:", error);
  shutdown("uncaughtException", 1);
});

// ==========================================
// SERVER STARTUP
// ==========================================
const startServer = async () => {
  try {
    await connectDB();
    await ChatConversation.ensureChatIndexes();
    createUploadDirectories();
    await seedDefaultData();

    if (typeof bannerScheduler === "function") bannerScheduler();
    else if (bannerScheduler?.start) bannerScheduler.start();

    // 🧹 Store editor: unused theme images (nightly, 24h grace) — multi-instance par
    // ek saath chale to bhi safe (unlink idempotent)
    require("./utils/themeImageCleanup").start();
    // ⏰ Store editor scheduled publish (har minute, multi-instance safe)
    require("./utils/themeScheduler").start();

    // 📧 SMTP check — BACKGROUND me (await NAHI): startup ~12s SMTP handshake par
    // nahi rukta. Email bhejna is check par depend nahi karta — sirf early warning.
    setImmediate(() => {
      try {
        const { isSmtpConfigured, verifySmtpConnection } = require("./utils/sendEmail");
        if (!isSmtpConfigured()) return;
        verifySmtpConnection().catch((smtpError) => {
          console.warn(`⚠️  SMTP check failed: ${smtpError.message}`);
        });
      } catch (smtpError) {
        console.warn(`⚠️  SMTP check failed: ${smtpError.message}`);
      }
    });

    const portAvailable = await checkPortAvailable(PORT);
    if (!portAvailable) {
      startupLog.error(`Port ${PORT} already in use — stop the existing service or configure a different PORT.`);
      process.exit(1);
    }

    server.listen(PORT, HOST, () => {
      console.log(`✅ ${STARTUP_MESSAGE}`);
      const address = server.address();
      const boundHost = typeof address === "object" && address ? address.address : HOST;
      const isWildcardHost = !boundHost || ["0.0.0.0", "::", "::ffff:0.0.0.0"].includes(boundHost);
      const apiPath = API_PREFIX ? `/${String(API_PREFIX).replace(/^\/+|\/+$/g, "")}` : "";
      console.log(`🔗 Local: http://localhost:${PORT}${apiPath}`);
      if (isWildcardHost) {
        const localIPv4s = [...new Set(Object.values(os.networkInterfaces()).flatMap((interfaces) =>
          (interfaces || [])
            .filter((network) => !network.internal && (network.family === "IPv4" || network.family === 4))
            .map((network) => network.address),
        ))];
        for (const ip of localIPv4s) console.log(`📡 Network: http://${ip}:${PORT}${apiPath}`);
      }
      console.log(`🔌 Socket ${socketStatus === "connected" ? "connected" : "not connected"}`);
      if (ROOT_DOMAIN) {
        console.log(`🏬 Platform: http://${ROOT_DOMAIN}  ·  Stores: http://<subdomain>.${ROOT_DOMAIN}`);
      }
    });
  } catch (error) {
    startupLog.error(`Server start failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
