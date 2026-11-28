// ==========================================================
// RESOLVE STORE — har API request par Host se tenant pehchano
// ----------------------------------------------------------
// Frontend API ko PAGE ke hostname par hi call karta hai (sirf port 5000),
// e.g. page alistore.192.168.88.35.nip.io:3000 → API alistore.192.168.88.35.nip.io:5000
// Is liye yahan Host header hi batata hai ke kaun sa store hai.
//
//   req.tenant       → { type: "platform" | "subdomain" | "custom" | "unknown", host, ... }
//   req.store        → Store (lean, 60s cache) ya null
//   req.storeMissing → true agar store host tha lekin store nahi mila
//
// STORE host par:
//   • baaki poori request `runWithStore(storeId)` ke andar chalti hai →
//     tenantScope plugin har query ko isi store tak mehdood karta hai
//   • /super-admin API band (404) — super admin sirf platform par hai
//   • store na mile → 404 STORE_NOT_FOUND (sirf /store/resolve aur /health khule)
// PLATFORM host par koi scope nahi — is liye wahan sirf PLATFORM_EXACT /
// PLATFORM_PREFIXES wali APIs khuli hain (signup, store-setup, seller login +
// handoff, super admin). Baaki sab → 404 STORE_REQUIRED.
// `x-store-host` sirf `x-internal-proxy-secret` (INTERNAL_PROXY_SECRET) ke saath.
// ==========================================================

const Store = require("../models/Store");
const { parseTenantHost } = require("../utils/tenantHost");
const { runWithStore } = require("../utils/tenantContext");

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // host → { store, expires }

const crypto = require("crypto");

const ALWAYS_OPEN = new Set(["/health", "/store/resolve"]);

// ── PLATFORM host par sirf yehi APIs khuli hain ──
// Baaki har store-owned API (products, orders, customers ...) platform par
// chalti to tenant scope nahi lagta aur SAARE stores ka data aa jata — is liye
// platform par woh 404 STORE_REQUIRED deti hain.
const PLATFORM_EXACT = new Set([
  "/health",
  "/store/resolve",
  "/store/check-subdomain",
  // Seller signup (landing/signup)
  "/users/register",
  "/users/register/check", // signup: email / username / phone / store address availability
  "/users/send-email-otp",
  "/users/verify-email-otp",
  "/users/google-customer-login",
  "/users/email-health",
  "/users/refresh-token",
  // Seller platform par login → apne store par handoff
  "/users/admin/login",
  "/users/google-login", // admin "Sign in with Google" (seller owner, phir handoff)
  "/users/admin/refresh-token",
  "/users/admin/handoff",
  "/users/logout",
]);
const PLATFORM_PREFIXES = ["/super-admin", "/seller/apply"];

function isPlatformRoute(path) {
  if (PLATFORM_EXACT.has(path)) return true;
  return PLATFORM_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

// Next.js server ka shared secret — sirf isi ke saath `x-store-host` maana jata hai
function hasInternalProxySecret(req) {
  const expected = process.env.INTERNAL_PROXY_SECRET;
  const given = req.headers["x-internal-proxy-secret"];
  if (!expected || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hostFromRequest(req) {
  const host = req.headers.host || "";
  // Next.js server (SSR / proxy.js) backend ko platform address (IP) par call karta
  // hai aur asli store host `x-store-host` me bhejta hai. Ye header SIRF tab maana
  // jata hai jab request platform host par ho AUR `x-internal-proxy-secret` sahi ho —
  // warna koi bhi client platform host par ye header laga kar kisi bhi store ka
  // context le sakta tha.
  const forwarded = req.headers["x-store-host"];
  if (forwarded && parseTenantHost(host).type === "platform" && hasInternalProxySecret(req)) {
    return String(forwarded);
  }
  return host;
}

async function findStoreForTenant(tenant) {
  const alive = { is_deleted: { $ne: true } };
  if (tenant.type === "subdomain") {
    return Store.findOne({ subdomain: tenant.subdomain, ...alive }).lean();
  }
  if (tenant.type === "custom") {
    const filter = {
      ...alive,
      customDomain: { $in: [tenant.domain, tenant.domain.replace(/^www\./, "")] },
    };
    // Development me hosts-file wale domains (eastore.test) bina DNS verification ke chalne do
    if (process.env.NODE_ENV === "production") filter.domainVerified = true;
    return Store.findOne(filter).lean();
  }
  return null;
}

/** Host → store (60s cache). Socket/CORS bhi yahi use karte hain. */
async function resolveStoreByHost(rawHost) {
  const tenant = parseTenantHost(rawHost);
  if (tenant.type === "platform" || tenant.type === "unknown") return { tenant, store: null };

  const hit = cache.get(tenant.host);
  if (hit && hit.expires > Date.now()) return { tenant, store: hit.store };

  const store = await findStoreForTenant(tenant);
  cache.set(tenant.host, { store, expires: Date.now() + CACHE_TTL_MS });
  return { tenant, store };
}

/** Store ka subdomain/domain badle to purana cache hatao */
function clearStoreHostCache() {
  cache.clear();
}

const notFound = (res, tenant) =>
  res.status(404).json({
    success: false,
    code: "STORE_NOT_FOUND",
    message: "Store not found for this address.",
    host: tenant?.host,
  });

async function resolveStore(req, res, next) {
  let resolved;
  try {
    resolved = await resolveStoreByHost(hostFromRequest(req));
  } catch (error) {
    return next(error);
  }
  const { tenant, store } = resolved;
  req.tenant = tenant;
  req.store = store;
  req.storeMissing = tenant.type !== "platform" && !store;

  if (tenant.type === "platform") {
    if (isPlatformRoute(req.path)) return next();
    return res.status(404).json({
      success: false,
      code: "STORE_REQUIRED",
      message: "This API is only available on a store address.",
    });
  }

  if (req.path === "/super-admin" || req.path.startsWith("/super-admin/")) {
    return res.status(404).json({ success: false, message: "Not found." });
  }

  if (!store) {
    if (ALWAYS_OPEN.has(req.path)) return next();
    return notFound(res, tenant);
  }

  // Soft-deleted stores already excluded in findStoreForTenant. Closed /
  // maintenance: block storefront + customer APIs once here (§3.7) instead of
  // looping employees. Staff (X-Auth-Aud: admin) and public store info stay open.
  const status = String(store.store_status || "open");
  if (status !== "open") {
    const aud = String(req.headers["x-auth-aud"] || "").trim().toLowerCase();
    const path = req.path || "";
    const bypass =
      ALWAYS_OPEN.has(path) ||
      path === "/store/public" ||
      path === "/store" ||
      path.startsWith("/users/admin") ||
      path === "/users/login" ||
      path === "/users/google-login" ||
      path === "/users/refresh-token" ||
      path === "/users/logout" ||
      aud === "admin";
    if (!bypass) {
      const code = status === "maintenance" ? "STORE_MAINTENANCE" : "STORE_CLOSED";
      return res.status(503).json({
        success: false,
        code,
        message:
          status === "maintenance"
            ? (store.maintenance_message || "This store is under maintenance.")
            : "This store is currently closed.",
        store_status: status,
      });
    }
  }

  return runWithStore(store._id, next);
}

/** Route-level guard: sirf store host par chalne wale endpoints ke liye */
function requireStore(req, res, next) {
  if (req.store) return next();
  return notFound(res, req.tenant);
}

module.exports = { resolveStore, requireStore, resolveStoreByHost, clearStoreHostCache, isPlatformRoute };
