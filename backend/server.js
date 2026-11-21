const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const backendEnvPath = path.join(__dirname, ".env");
dotenv.config({ path: backendEnvPath, quiet: true });

const express = require("express");
const http = require("http");
const cors = require("cors");
const compression = require("compression");
const bcrypt = require("bcryptjs");
const os = require("os");
const cookieParser = require("cookie-parser");


const connectDB = require("./config/db");
const log = require("./utils/logger");
const User = require("./models/User");
const ChatConversation = require("./models/ChatConversation");
const SuperAdmin = require("./models/SuperAdmin");
const { initSocket } = require("./utils/socket");
const { resolveStore, resolveStoreByHost } = require("./middleware/resolveStore");
const { isPlatformFamilyHost, ROOT_DOMAIN } = require("./utils/tenantHost");

// ==========================================
// ROUTES IMPORT
// ==========================================
const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const variantRoutes = require("./routes/variantRoutes");
const storeRoutes = require("./routes/storeRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const discountRoutes = require("./routes/discountRoutes");
const dealRoutes = require("./routes/dealRoutes");
const bundleRoutes = require("./routes/bundleRoutes");
const tagRoutes = require("./routes/tagRoutes");
const addressRoutes = require("./routes/addressRoutes");
const bannerRoutes = require("./routes/bannerRoutes");
const bannerScheduler = require("./utils/bannerScheduler");
const orderRoutes = require("./routes/orderRoutes");
const cartRoutes = require("./routes/cartRoutes");
const stockRoutes = require("./routes/stockRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const shippingRoutes = require("./routes/shippingRoutes");
const attributeRoutes = require("./routes/attributeRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const customerRoutes = require("./routes/customerRoutes");
const leadRoutes = require("./routes/leadRoutes");
const quoteRoutes = require("./routes/quoteRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const posRoutes = require("./routes/posRoutes");
const financeRoutes = require("./routes/financeRoutes");
const translationRoutes = require("./routes/translationRoutes");
const chatRoutes = require("./routes/chatRoutes");

// ==========================================
// APP & SERVER SETUP
// ==========================================
const app = express();
const server = http.createServer(app);


const PORT = Number(process.env.PORT);
// TRUST_PROXY sirf env se — blank/off ho to proxy trust nahi hota
if (String(process.env.TRUST_PROXY || "").trim()) {
  app.set("trust proxy", String(process.env.TRUST_PROXY).trim());
}
const HOST = process.env.HOST;
const CLIENT_URL = process.env.CLIENT_URL;
const API_PREFIX = process.env.API_PREFIX;
const NODE_ENV = process.env.NODE_ENV;
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS);
const REQUEST_SIZE_LIMIT = process.env.REQUEST_SIZE_LIMIT;
const UPLOAD_CACHE_MAX_AGE = process.env.UPLOAD_CACHE_MAX_AGE;
const UPLOAD_DIR = process.env.UPLOAD_DIR;
const STORE_UPLOAD_SUBDIR = process.env.STORE_UPLOAD_SUBDIR;
const BUNDLE_UPLOAD_SUBDIR = process.env.BUNDLE_UPLOAD_SUBDIR;
const REVIEW_UPLOAD_SUBDIR = process.env.REVIEW_UPLOAD_SUBDIR;
const STARTUP_MESSAGE = process.env.SERVER_STARTUP_MESSAGE;

// ==========================================
// MIDDLEWARES
// ==========================================
if (!CLIENT_URL) log.warn("⚠️ CLIENT_URL is not configured in .env");

const buildAllowedOrigins = () => {
  const origins = new Set();
  if (CLIENT_URL) origins.add(CLIENT_URL.trim());
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim()).filter(Boolean).forEach(o => origins.add(o));
  }
  return [...origins];
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (buildAllowedOrigins().includes(origin)) return callback(null, true);
    
    if (NODE_ENV === "development") {
      try {
        const url = new URL(origin);
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return callback(null, true);
      } catch (error) { return callback(new Error("Invalid request origin")); }
    }

    if (NODE_ENV === "development" && process.env.ALLOW_LOCAL_NETWORK === "true") {
      try {
        const url = new URL(origin);
        const isPrivate = /^192\.168\.\d+\.\d+$/.test(url.hostname) || 
                          /^10\.\d+\.\d+\.\d+$/.test(url.hostname) || 
                          /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(url.hostname);
        if (isPrivate) return callback(null, true);
      } catch (error) { return callback(new Error("Invalid request origin")); }
    }

    // Multi-tenant: platform root + uske saare store subdomains
    // (dev: *.192.168.88.35.nip.io, prod: *.eccomerce.com) + registered custom domains
    let originHost;
    try { originHost = new URL(origin).hostname; } catch (error) { return callback(new Error("Invalid request origin")); }
    if (isPlatformFamilyHost(originHost)) return callback(null, true);
    return resolveStoreByHost(originHost)
      .then(({ store }) => (store ? callback(null, true) : callback(new Error("Not allowed by CORS"))))
      .catch(() => callback(new Error("Not allowed by CORS")));
  },
  credentials: true,
}));

// ✅ COMPRESSION (gzip) — JSON APIs ke liye. /uploads (pehle se webp/compressed)
// aur /socket.io (binary frames) ko skip — double compress se bacho.
// Order: cors ke baad, rate-limit/routes se pehle (order unchanged).
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.path.startsWith("/uploads") || req.path.startsWith("/socket.io")) return false;
      return compression.filter(req, res);
    },
  }),
);

app.use(express.json({ limit: REQUEST_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_SIZE_LIMIT }));
app.use(cookieParser());
// Multi-tenant: Host header → req.tenant / req.store (block nahi karta)
app.use(API_PREFIX, resolveStore);

const uploadDir = path.join(__dirname, UPLOAD_DIR);
const storeUploadDir = path.join(uploadDir, STORE_UPLOAD_SUBDIR);
// 🔒 KYC documents (uploads/documents) PRIVATE — sirf super admin session (sa_at).
// Path normalize karke check (".../x/../documents/..." jaisa chakkar bhi pakda jata
// hai), warna neeche wala public static inhe kisi ko bhi de deta tha.
const { requireSuperAdmin } = require("./middleware/superAdminAuth");
const documentsDir = path.join(uploadDir, "documents");
app.use("/uploads", (req, res, next) => {
  let normalized;
  try {
    normalized = path.posix.normalize(decodeURIComponent(req.path));
  } catch {
    return res.status(400).json({ success: false, message: "Bad path." });
  }
  if (normalized !== "/documents" && !normalized.startsWith("/documents/")) return next();
  return requireSuperAdmin(req, res, () => {
    res.set("Cache-Control", "private, no-store");
    const fileName = normalized.slice("/documents/".length);
    if (!fileName || fileName.includes("/")) return res.status(404).json({ success: false, message: "Not found." });
    return res.sendFile(fileName, { root: documentsDir, dotfiles: "deny" }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ success: false, message: "Not found." });
    });
  });
});

// ✅ /uploads: saari filenames Date.now/uuid wali hain (overwrite par naya
// naam banta hai) → 1y immutable safe. Webp pehle se compressed hai.
// Naye uploads store ke folder me: /uploads/stores/<storeId>/... (utils/uploadPaths.js)
app.use(
  "/uploads",
  express.static(uploadDir, {
    maxAge: UPLOAD_CACHE_MAX_AGE,
    immutable: true,
    etag: true,
  }),
);

// ==========================================
// STARTUP CONSOLE — sirf startup ke critical lines (DB / SMTP / port / server / socket).
// ✅ Ye logger.js se alag hai: logger sab kuch silence karta hai (log.info/
//    log.error no-op hain), jisse server start hone par console bilkul khamosh
//    rehta tha. Yahan direct console use hota hai taaki "server started"
//    confirmation user ko DIKHE.
// ⚠️ Koi file nahi banti — pure console output. Baaki logging jaisi thi waisi
//    hi silent chhodi gayi hai.
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

app.use((req, res, next) => { req.io = io; next(); });

// ✅ GLOBAL RATE LIMIT — poori /api par (health check skip, static /uploads waise hi bahar)
const { limiters } = require("./middleware/rateLimit");
app.use(API_PREFIX, (req, res, next) => {
  if (req.path === "/health") return next();
  // Chat has a dedicated limiter so storefront browsing cannot exhaust its API budget.
  if (req.path === "/chats" || req.path.startsWith("/chats/")) return next();
  return limiters.global(req, res, next);
});

// ==========================================
// ROUTES
// ==========================================
app.use(`${API_PREFIX}/categories`, categoryRoutes);
app.use(`${API_PREFIX}/brands`, brandRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/variants`, variantRoutes);
app.use(`${API_PREFIX}/store`, storeRoutes);
app.use(`${API_PREFIX}/employees`, employeeRoutes);
app.use(`${API_PREFIX}/discounts`, discountRoutes);
app.use(`${API_PREFIX}/deals`, dealRoutes);
app.use(`${API_PREFIX}/bundles`, bundleRoutes);
app.use(`${API_PREFIX}/tags`, tagRoutes);
app.use(`${API_PREFIX}/addresses`, addressRoutes);
app.use(`${API_PREFIX}/banners`, bannerRoutes);
app.use(`${API_PREFIX}/orders`, orderRoutes);
app.use(`${API_PREFIX}/cart`, cartRoutes);
app.use(`${API_PREFIX}/stock`, stockRoutes);
app.use(`${API_PREFIX}/reviews`, reviewRoutes);
app.use(`${API_PREFIX}/attributes`, attributeRoutes);
app.use(`${API_PREFIX}/shipping`, shippingRoutes);
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
app.use(`${API_PREFIX}/vendors`, vendorRoutes);
app.use(`${API_PREFIX}/purchase-orders`, purchaseOrderRoutes);
app.use(`${API_PREFIX}/customers`, customerRoutes);
app.use(`${API_PREFIX}/leads`, leadRoutes);
app.use(`${API_PREFIX}/quotes`, quoteRoutes);
app.use(`${API_PREFIX}/invoices`, invoiceRoutes);
app.use(`${API_PREFIX}/pos`, posRoutes);
app.use(`${API_PREFIX}/finance`, financeRoutes);
app.use(`${API_PREFIX}/translations`, translationRoutes);
app.use(`${API_PREFIX}/chats`, chatRoutes);
// ── Super Admin module (separate namespace + auth) ──
app.use(`${API_PREFIX}/super-admin`, require("./routes/superAdminRoutes"));
// ── Public seller application (pending-review queue) ──
app.use(`${API_PREFIX}/seller`, require("./routes/sellerApplicationRoutes"));

app.get("/", (req, res) => res.send(STARTUP_MESSAGE));
app.get(`${API_PREFIX}/health`, (req, res) => {
  res.status(200).json({ success: true, message: "API is running", environment: NODE_ENV, timestamp: new Date() });
});
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found", path: req.originalUrl });
});

// ==========================================
// DIRECTORIES & SEEDING
// ==========================================
const createUploadDirectories = () => {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  if (!fs.existsSync(storeUploadDir)) fs.mkdirSync(storeUploadDir, { recursive: true });
  // ✅ Bundle cover images
  const bundleUploadDir = path.join(uploadDir, BUNDLE_UPLOAD_SUBDIR);
  if (!fs.existsSync(bundleUploadDir)) fs.mkdirSync(bundleUploadDir, { recursive: true });
  // ✅ Review media (images + video)
  const reviewUploadDir = path.join(uploadDir, REVIEW_UPLOAD_SUBDIR);
  if (!fs.existsSync(reviewUploadDir)) fs.mkdirSync(reviewUploadDir, { recursive: true });
};

const seedDefaultData = async () => {
  try {
    // Default store / store-admin auto-seed HATA diya gaya hai (multi-tenant):
    // stores sirf seller signup se bante hain (Super Admin approval ke baad).
    // Attributes startup par nahi — naya store save hote hi Store model seed karta hai.

    // 1. Super Admin Seed (development convenience; production requires a strong password)
    const saEmail = process.env.SUPER_ADMIN_EMAIL;
    const saPassword = process.env.SUPER_ADMIN_PASSWORD;
    if (saEmail && saPassword) {
      const emailSa = String(saEmail).toLowerCase().trim();
      const saName = process.env.SUPER_ADMIN_NAME || emailSa.split("@")[0];
      const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
      const minPasswordLength = Number(process.env.SUPER_ADMIN_MIN_PASSWORD_LENGTH);
      const passwordTooWeak =
        !Number.isFinite(minPasswordLength) ||
        minPasswordLength < 1 ||
        String(saPassword).length < minPasswordLength;
      if (isProduction && passwordTooWeak) {
        log.warn(
          "[superadmin] Refusing to seed: set SUPER_ADMIN_MIN_PASSWORD_LENGTH and a SUPER_ADMIN_PASSWORD of at least that length in production."
        );
      } else {
        try {
          const existing = await SuperAdmin.findOne({ email: emailSa });
          if (existing) {
            log.info("[superadmin] Super Admin already seeded; keeping existing credentials.");
          } else {
            const hashed = await bcrypt.hash(String(saPassword), SALT_ROUNDS);
            await SuperAdmin.create({ name: saName, email: emailSa, passwordHash: hashed, status: "active" });
            log.info("[superadmin] Super Admin seeded.");
          }
        } catch (e) {
          log.error("[superadmin] Seed error:", e.message);
        }
      }
    } else {
      log.warn("[superadmin] SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD not set; /super-admin will be unavailable.");
    }

  } catch (error) {
    log.error("❌ Seed Error:", error.message);
  }
};

// ==========================================
// SERVER STARTUP
// ==========================================
const startServer = async () => {
  try {
    await connectDB();
    await ChatConversation.ensureChatIndexes();
    createUploadDirectories();
    
    // Yahan sab kuch auto-run hoga
    await seedDefaultData(); 
    
    if (typeof bannerScheduler === 'function') bannerScheduler();
    else if (bannerScheduler?.start) bannerScheduler.start();

    // 📧 SMTP check (chalta rehta hai, par print nahi — extra info nahi chahiye)
    try {
      const { isSmtpConfigured, verifySmtpConnection, getSmtpConfig } = require("./utils/sendEmail");
      if (isSmtpConfigured()) {
        await verifySmtpConnection();
      }
    } catch (smtpError) {
      log.error("❌ SMTP check failed:", smtpError.message);
    }
    
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
    // ✅ Pehle ye bhi silent tha — ab reason dikhegi
    startupLog.error(`Server start failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();