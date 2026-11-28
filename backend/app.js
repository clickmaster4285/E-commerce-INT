// ==========================================================
// EXPRESS APP (optimizeplan.md §5.1)
// ----------------------------------------------------------
// Sirf app banata hai — listen / socket / seeding / schedulers server.js me.
// Is liye tests (supertest) app ko bina port khole require kar sakte hain.
// Socket.IO instance server.js `app.set("io", io)` se deta hai; har request par
// `req.io` wahi hota hai (pehle jaisa).
// ==========================================================

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const pinoHttp = require("pino-http");

const log = require("./utils/logger");
const { resolveStore, resolveStoreByHost } = require("./middleware/resolveStore");
const { isPlatformFamilyHost } = require("./utils/tenantHost");
const { errorHandler } = require("./middleware/errorHandler");

const NODE_ENV = process.env.NODE_ENV;
const IS_PRODUCTION = String(NODE_ENV || "").toLowerCase() === "production";
const API_PREFIX = process.env.API_PREFIX;
const CLIENT_URL = process.env.CLIENT_URL;
const REQUEST_SIZE_LIMIT = process.env.REQUEST_SIZE_LIMIT;
const UPLOAD_CACHE_MAX_AGE = process.env.UPLOAD_CACHE_MAX_AGE;
const UPLOAD_DIR = process.env.UPLOAD_DIR;
const STARTUP_MESSAGE = process.env.SERVER_STARTUP_MESSAGE;

const app = express();
app.disable("x-powered-by");

// TRUST_PROXY sirf env se — blank/off ho to proxy trust nahi hota
if (String(process.env.TRUST_PROXY || "").trim()) {
  app.set("trust proxy", String(process.env.TRUST_PROXY).trim());
}

// ==========================================
// REQUEST ID + ACCESS LOG (pino-http)
// Har request ka `req.id` (X-Request-Id) — error responses aur logs me same id.
// Access log "info" level par: production me dikhta hai, dev (warn) me khamosh.
// ==========================================
app.use(require("./utils/metrics").middleware); // request/error counters (stub)
app.use(pinoHttp({
  logger: log.pino,
  genReqId: (req, res) => {
    const incoming = String(req.headers["x-request-id"] || "");
    const id = /^[A-Za-z0-9._-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  autoLogging: { ignore: (req) => req.url === `${API_PREFIX}/health` || req.url === `${API_PREFIX}/ready` || String(req.url || "").startsWith("/socket.io") },
  // 4xx (expired token 401, validation) roz ka maamla hai → "info" (dev me khamosh);
  // sirf 5xx "error" — wahi asal problem hai.
  customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? "error" : "info"),
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url, host: req.headers?.host }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  customSuccessObject: (req, res, val) => ({ ...val, storeId: req.store?._id ? String(req.store._id) : undefined }),
}));

// ==========================================
// SECURITY HEADERS (helmet) — optimizeplan.md §5.5 / §9.1
// - crossOriginResourcePolicy "cross-origin": storefront (port 3000 / CDN) /uploads
//   images API origin (port 5000) se load karta hai — same-origin se tootta.
// - HSTS sirf production (dev http par localhost/nip.io ko sticky https na bane).
// - CSP neeche khud set hota hai (API JSON + /uploads ke liye alag).
// ==========================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  hsts: IS_PRODUCTION ? { maxAge: 180 * 24 * 60 * 60, includeSubDomains: false } : false,
}));

// API responses kabhi document ki tarah render/frame na hon. /uploads (KYC PDFs
// ke ilawa) par `sandbox` bhi — koi upload browser me khol kar script na chala sake.
const API_CSP = "default-src 'none'; frame-ancestors 'none'";
const UPLOAD_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox";
app.use((req, res, next) => {
  if (req.path.startsWith("/uploads/")) {
    if (!req.path.startsWith("/uploads/documents")) res.setHeader("Content-Security-Policy", UPLOAD_CSP);
    // helmet default me deta hai, par static ke liye explicit — MIME sniffing se script na bane
    res.setHeader("X-Content-Type-Options", "nosniff");
  } else if (API_PREFIX && req.path.startsWith(API_PREFIX)) {
    res.setHeader("Content-Security-Policy", API_CSP);
  }
  next();
});

// ==========================================
// CORS
// ==========================================
if (!CLIENT_URL) log.warn("⚠️ CLIENT_URL is not configured in .env");

const buildAllowedOrigins = () => {
  const origins = new Set();
  if (CLIENT_URL) origins.add(CLIENT_URL.trim());
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean).forEach((o) => origins.add(o));
  }
  return [...origins];
};

// Preflight par har baar DB lookup (resolveStoreByHost) na ho — chhota TTL cache.
// Size bounded (CORS_HOST_CACHE_MAX) taake random Origin spam se memory na barhe.
const CORS_HOST_CACHE_TTL_MS = 45 * 1000;
const CORS_HOST_CACHE_MAX = 500;
const corsHostCache = new Map(); // host -> { ok, exp }
const corsHostCacheSet = (host, ok) => {
  if (corsHostCache.size >= CORS_HOST_CACHE_MAX) {
    const oldest = corsHostCache.keys().next().value; // insertion order = sabse purani entry
    corsHostCache.delete(oldest);
  }
  corsHostCache.set(host, { ok, exp: Date.now() + CORS_HOST_CACHE_TTL_MS });
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
    const cached = corsHostCache.get(originHost);
    if (cached && cached.exp > Date.now()) {
      return cached.ok ? callback(null, true) : callback(new Error("Not allowed by CORS"));
    }
    return resolveStoreByHost(originHost)
      .then(({ store }) => {
        corsHostCacheSet(originHost, Boolean(store));
        return store ? callback(null, true) : callback(new Error("Not allowed by CORS"));
      })
      .catch(() => callback(new Error("Not allowed by CORS"))); // DB error cache nahi hota
  },
  credentials: true,
}));

// ✅ COMPRESSION (gzip) — JSON APIs ke liye. /uploads (pehle se webp/compressed)
// aur /socket.io (binary frames) ko skip — double compress se bacho.
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.path.startsWith("/uploads") || req.path.startsWith("/socket.io")) return false;
      return compression.filter(req, res);
    },
  }),
);

// Default JSON body is small; KYC complete-setup keeps the large limit (§5.5).
const DEFAULT_JSON_LIMIT = process.env.DEFAULT_JSON_LIMIT || "256kb";
const LARGE_JSON_LIMIT = REQUEST_SIZE_LIMIT || "6mb";
app.use((req, res, next) => {
  const large =
    req.method === "POST" &&
    String(req.originalUrl || "").includes("/seller/apply/complete-setup");
  return express.json({ limit: large ? LARGE_JSON_LIMIT : DEFAULT_JSON_LIMIT })(req, res, next);
});
app.use((req, res, next) => {
  const large =
    req.method === "POST" &&
    String(req.originalUrl || "").includes("/seller/apply/complete-setup");
  return express.urlencoded({ extended: true, limit: large ? LARGE_JSON_LIMIT : DEFAULT_JSON_LIMIT })(req, res, next);
});
app.use(cookieParser());

// ✅ GLOBAL RATE LIMIT before resolveStore — unknown Hosts cannot hammer Mongo (§5.5)
const { limiters } = require("./middleware/rateLimit");
app.use(API_PREFIX, (req, res, next) => {
  if (req.path === "/health" || req.path === "/ready") return next();
  // Chat has a dedicated limiter so storefront browsing cannot exhaust its API budget.
  if (req.path === "/chats" || req.path.startsWith("/chats/")) return next();
  return limiters.global(req, res, next);
});

// 🔒 Cross-store CSRF: Origin host == API host (opt-in ENFORCE_ORIGIN_CHECK=1, middleware/originCheck.js)
app.use(API_PREFIX, require("./middleware/originCheck"));

// Multi-tenant: Host header → req.tenant / req.store (block nahi karta)
app.use(API_PREFIX, resolveStore);

// ==========================================
// UPLOADS
// ==========================================
const uploadDir = path.join(__dirname, UPLOAD_DIR);
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

// Socket.IO instance (server.js set karta hai) — controllers req.io se emit karte hain
app.use((req, res, next) => { req.io = app.get("io") || null; next(); });

// ==========================================
// ROUTES
// ==========================================
// Routers ek jagah require (style unify) — mount neeche
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
const orderRoutes = require("./routes/orderRoutes");
const cartRoutes = require("./routes/cartRoutes");
const stockRoutes = require("./routes/stockRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const attributeRoutes = require("./routes/attributeRoutes");
const shippingRoutes = require("./routes/shippingRoutes");
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
const loyaltyRoutes = require("./routes/loyaltyRoutes");
const themeRoutes = require("./routes/themeRoutes");
const pageRoutes = require("./routes/pageRoutes");
const subscriberRoutes = require("./routes/subscriberRoutes");
const contactRoutes = require("./routes/contactRoutes");
const superAdminRoutes = require("./routes/superAdminRoutes");
const sellerApplicationRoutes = require("./routes/sellerApplicationRoutes");

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
app.use(`${API_PREFIX}/loyalty`, loyaltyRoutes);
// ── Store editor (theme draft/publish) + custom pages ──
app.use(`${API_PREFIX}/theme`, themeRoutes);
app.use(`${API_PREFIX}/pages`, pageRoutes);
// ── Newsletter subscribers (store editor newsletter section) ──
app.use(`${API_PREFIX}/newsletter`, subscriberRoutes);
// ── Contact form messages (store editor contact section) ──
app.use(`${API_PREFIX}/contact`, contactRoutes);
// ── Super Admin module (separate namespace + auth) ──
app.use(`${API_PREFIX}/super-admin`, superAdminRoutes);
// ── Public seller application (pending-review queue) ──
app.use(`${API_PREFIX}/seller`, sellerApplicationRoutes);

app.get("/", (req, res) => res.send(STARTUP_MESSAGE));
app.get(`${API_PREFIX}/health`, (req, res) => {
  res.status(200).json({ success: true, message: "API is running", environment: NODE_ENV, timestamp: new Date() });
});
app.get(`${API_PREFIX}/ready`, async (req, res) => {
  // READINESS: Mongo connected + (REDIS_URL ho to) Redis ping. Liveness /health alag aur halka rehta hai.
  const checks = { mongo: mongoose.connection.readyState === 1, redis: null };
  if (String(process.env.REDIS_URL || "").trim()) {
    try {
      const client = require("./middleware/rateLimit").getRedisClient();
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("redis ping timeout")), 1500));
      checks.redis = client ? (await Promise.race([client.ping(), timeout])) === "PONG" : false;
    } catch {
      checks.redis = false;
    }
  }
  const ok = checks.mongo && checks.redis !== false;
  if (ok) return res.status(200).json({ ok: true });
  return res.status(503).json({ ok: false, checks });
});
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found", path: req.originalUrl });
});

// Har `next(err)` → JSON (pehle Express ka HTML 500 page)
app.use(errorHandler);

module.exports = app;
