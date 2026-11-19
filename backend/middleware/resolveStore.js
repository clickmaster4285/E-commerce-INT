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
// PLATFORM host par koi scope nahi (signup, store-setup, super admin).
// ==========================================================

const Store = require("../models/Store");
const { parseTenantHost } = require("../utils/tenantHost");
const { runWithStore } = require("../utils/tenantContext");

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // host → { store, expires }

const ALWAYS_OPEN = new Set(["/health", "/store/resolve"]);

function hostFromRequest(req) {
  const host = req.headers.host || "";
  // Next.js server (SSR / middleware) backend ko platform address (IP) par call karta
  // hai aur asli store host `x-store-host` me bhejta hai. Ye header sirf tab maana
  // jata hai jab request khud platform host par aayi ho — browser store host se
  // aa kar kisi aur store ka header nahi laga sakta.
  const forwarded = req.headers["x-store-host"];
  if (forwarded && parseTenantHost(host).type === "platform") return String(forwarded);
  return host;
}

async function findStoreForTenant(tenant) {
  if (tenant.type === "subdomain") {
    return Store.findOne({ subdomain: tenant.subdomain }).lean();
  }
  if (tenant.type === "custom") {
    const filter = { customDomain: { $in: [tenant.domain, tenant.domain.replace(/^www\./, "")] } };
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

  if (tenant.type === "platform") return next();

  if (req.path === "/super-admin" || req.path.startsWith("/super-admin/")) {
    return res.status(404).json({ success: false, message: "Not found." });
  }

  if (!store) {
    if (ALWAYS_OPEN.has(req.path)) return next();
    return notFound(res, tenant);
  }

  return runWithStore(store._id, next);
}

/** Route-level guard: sirf store host par chalne wale endpoints ke liye */
function requireStore(req, res, next) {
  if (req.store) return next();
  return notFound(res, req.tenant);
}

module.exports = { resolveStore, requireStore, resolveStoreByHost, clearStoreHostCache };
