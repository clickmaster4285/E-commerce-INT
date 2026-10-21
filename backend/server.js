require("dotenv").config({ quiet: true });

const express = require("express");
const http = require("http");
const cors = require("cors");
const compression = require("compression");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");

const net = require('net');

const connectDB = require("./config/db");
const log = require("./utils/logger");
const User = require("./models/User");
const Employee = require("./models/Employee");
const Store = require("./models/Store");
const { initSocket } = require("./utils/socket");

// ✅ Seed script ko import karein (Data yahan nahi, wahan rahega)
const { seedAttributes } = require("./scripts/seedAttributes");

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

// ==========================================
// APP & SERVER SETUP
// ==========================================
const app = express();
const server = http.createServer(app);


const PORT = Number(process.env.PORT);
// TRUST_PROXY sirf env se — blank/off ho to proxy trust nahi hota
if (String(process.env.TRUST_PROXY).trim()) {
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
const DEFAULT_ADMIN_ROLE = process.env.DEFAULT_ADMIN_ROLE;
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
    
    if (NODE_ENV !== "production") {
      try {
        const url = new URL(origin);
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return callback(null, true);
      } catch (error) { return callback(new Error("Invalid request origin")); }
    }

    if (process.env.ALLOW_LOCAL_NETWORK === "true") {
      try {
        const url = new URL(origin);
        const isPrivate = /^192\.168\.\d+\.\d+$/.test(url.hostname) || 
                          /^10\.\d+\.\d+\.\d+$/.test(url.hostname) || 
                          /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(url.hostname);
        if (isPrivate) return callback(null, true);
      } catch (error) { return callback(new Error("Invalid request origin")); }
    }
    return callback(new Error("Not allowed by CORS"));
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

const uploadDir = path.join(__dirname, UPLOAD_DIR);
const storeUploadDir = path.join(uploadDir, STORE_UPLOAD_SUBDIR);
// ✅ /uploads: saari filenames Date.now/uuid wali hain (overwrite par naya
// naam banta hai) → 1y immutable safe. Webp pehle se compressed hai.
app.use(
  "/uploads",
  express.static(uploadDir, {
    maxAge: "1y",
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
  error: (msg) => console.error(`❌ ${msg}`),
};

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
  const bundleUploadDir = path.join(uploadDir, "bundles");
  if (!fs.existsSync(bundleUploadDir)) fs.mkdirSync(bundleUploadDir, { recursive: true });
  // ✅ Review media (images + video)
  const reviewUploadDir = path.join(uploadDir, "reviews");
  if (!fs.existsSync(reviewUploadDir)) fs.mkdirSync(reviewUploadDir, { recursive: true });
};

const seedDefaultData = async () => {
  try {
    // 1. Store Seed
    const storeName = process.env.DEFAULT_STORE_NAME;
    if (storeName) {
      let defaultStore = await Store.findOne({ store_name: storeName });
      if (!defaultStore) {
        await Store.create({
          store_name: storeName,
          tagline: process.env.DEFAULT_STORE_TAGLINE,
          email: process.env.DEFAULT_STORE_EMAIL,
          phone: process.env.DEFAULT_STORE_PHONE,
          support_email: process.env.DEFAULT_STORE_SUPPORT_EMAIL,
          support_phone: process.env.DEFAULT_STORE_SUPPORT_PHONE,
          country: process.env.DEFAULT_STORE_COUNTRY,
          state: process.env.DEFAULT_STORE_STATE,
          city: process.env.DEFAULT_STORE_CITY,
          zip_code: process.env.DEFAULT_STORE_ZIP_CODE,
          address: process.env.DEFAULT_STORE_ADDRESS,
          currency: process.env.DEFAULT_STORE_CURRENCY,
          tax_rate: Number(process.env.DEFAULT_STORE_TAX_RATE),
          weight_unit: process.env.DEFAULT_STORE_WEIGHT_UNIT,
          store_status: process.env.DEFAULT_STORE_STATUS,
        });
        log.info("✅ Default Store Created");
      }

      // 2. Admin Seed (Employees collection only)
      const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
      const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
      if (adminEmail && adminPassword) {
        let admin = await Employee.findOne({ email: adminEmail });
        if (!admin) {
          const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);
          await Employee.create({
            name: process.env.DEFAULT_ADMIN_NAME,
            username: process.env.DEFAULT_ADMIN_USERNAME,
            email: adminEmail,
            password: hashedPassword,
            role: DEFAULT_ADMIN_ROLE,
            status: "active",
            storeId: defaultStore?._id || null,
            permissions: {
              products: true, brands: true, categories: true,
              users: true, orders: true, settings: true,
              profile: true, employees: true, discounts: true,
              deals: true, bundles: true, store: true, banners: true,
              manageStock: true, shipping: true, order: true, attribute: true,
              vendors: true, purchaseOrders: true, customers: true, pos: true, leads: true, quotes: true,
            },
          });
          log.info("✅ Default Admin Employee Created (employees collection)");
        }
      }
    }

    // ✅ 3. Attributes Auto-Seed (Imported Function Call)
    await seedAttributes(); 

  } catch (error) {
    log.error("❌ Seed Error:", error.message);
  }
};

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') resolve(false);
      else resolve(true);
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// ==========================================
// SERVER STARTUP
// ==========================================
const startServer = async () => {
  try {
    await connectDB();
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
      // ✅ Pehle ye block poora silent tha — process bina kuch bataye exit ho jata tha
      startupLog.error(`Port ${PORT} already in use (EADDRINUSE) — doosra backend chal raha hai.`);
      console.error(`💡 Fix: taskkill /PID <pid> /F   |   ya .env me PORT badal do`);
      process.exit(1);
    }

    server.listen(PORT, HOST, () => {
      // ✅ Sirf 2 lines — server start + socket status. Extra info nahi.
      console.log(`✅ ${STARTUP_MESSAGE}`);
      console.log(`🔌 Socket ${socketStatus === "connected" ? "connected" : "not connected"}`);
    });
  } catch (error) {
    // ✅ Pehle ye bhi silent tha — ab reason dikhegi
    startupLog.error(`Server start failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
