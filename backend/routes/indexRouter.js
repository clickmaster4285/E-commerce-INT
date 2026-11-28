// ==========================================================
// INDEX ROUTER — saari API routes ek jagah
// ----------------------------------------------------------
// app.js sirf `app.use(API_PREFIX, indexRouter)` mount karta hai.
// Paths yahan relative hain (prefix ke baghair), e.g. `/products`
// → public URL `/api/products`.
// ==========================================================
const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

// ── Catalog ──
router.use("/categories", require("./categoryRoutes"));
router.use("/brands", require("./brandRoutes"));
router.use("/products", require("./productRoutes"));
router.use("/variants", require("./variantRoutes"));
router.use("/attributes", require("./attributeRoutes"));
router.use("/tags", require("./tagRoutes"));
router.use("/reviews", require("./reviewRoutes"));
router.use("/stock", require("./stockRoutes"));

// ── Commerce ──
router.use("/orders", require("./orderRoutes"));
router.use("/cart", require("./cartRoutes"));
router.use("/discounts", require("./discountRoutes"));
router.use("/deals", require("./dealRoutes"));
router.use("/bundles", require("./bundleRoutes"));
router.use("/shipping", require("./shippingRoutes"));
router.use("/pos", require("./posRoutes"));
router.use("/invoices", require("./invoiceRoutes"));
router.use("/quotes", require("./quoteRoutes"));
router.use("/finance", require("./financeRoutes"));
router.use("/loyalty", require("./loyaltyRoutes"));

// ── CRM / inventory ops ──
router.use("/customers", require("./customerRoutes"));
router.use("/leads", require("./leadRoutes"));
router.use("/vendors", require("./vendorRoutes"));
router.use("/purchase-orders", require("./purchaseOrderRoutes"));
router.use("/employees", require("./employeeRoutes"));
router.use("/dashboard", require("./dashboardRoutes"));

// ── Store + auth ──
router.use("/store", require("./storeRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/addresses", require("./addressRoutes"));
router.use("/banners", require("./bannerRoutes"));
router.use("/chats", require("./chatRoutes"));
router.use("/translations", require("./translationRoutes"));

// ── Store editor / storefront content ──
router.use("/theme", require("./themeRoutes"));
router.use("/pages", require("./pageRoutes"));
router.use("/newsletter", require("./subscriberRoutes"));
router.use("/contact", require("./contactRoutes"));

// ── Platform ──
router.use("/super-admin", require("./superAdminRoutes"));
router.use("/seller", require("./sellerApplicationRoutes"));

// ── Health ──
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    environment: process.env.NODE_ENV,
    timestamp: new Date(),
  });
});

router.get("/ready", async (req, res) => {
  // READINESS: Mongo + optional Redis + queue driver. Liveness /health alag aur halka rehta hai.
  const checks = { mongo: mongoose.connection.readyState === 1, redis: null, queue: null };
  if (String(process.env.REDIS_URL || "").trim()) {
    try {
      const client = require("../middleware/rateLimit").getRedisClient();
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("redis ping timeout")), 1500));
      checks.redis = client ? (await Promise.race([client.ping(), timeout])) === "PONG" : false;
    } catch {
      checks.redis = false;
    }
  }
  try {
    const q = await require("../jobs/queue").ping();
    checks.queue = q?.ok !== false;
    checks.queueDriver = q?.driver || null;
  } catch {
    checks.queue = false;
  }
  const ok = checks.mongo && checks.redis !== false && checks.queue !== false;
  if (ok) return res.status(200).json({ ok: true, checks });
  return res.status(503).json({ ok: false, checks });
});

module.exports = router;
