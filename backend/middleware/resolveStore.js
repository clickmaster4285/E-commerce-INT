// ==========================================================
// RESOLVE STORE — har API request par Host se tenant pehchano
// ----------------------------------------------------------
// Frontend API ko PAGE ke hostname par hi call karta hai (sirf port 5000),
// e.g. page alistore.192.168.88.35.nip.io:3000 → API alistore.192.168.88.35.nip.io:5000
// Is liye yahan Host header hi batata hai ke kaun sa store hai.
//
// Ye middleware request BLOCK nahi karta — sirf attach karta hai:
//   req.tenant       → { type: "platform" | "subdomain" | "custom" | "unknown", host, ... }
//   req.store        → Store (lean) ya null
//   req.storeMissing → true agar store host tha lekin store nahi mila
// Jin routes ko store zaroori hai wo `requireStore` use karein.
// ==========================================================

const Store = require("../models/Store");
const { parseTenantHost } = require("../utils/tenantHost");

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // host → { store, expires }

function hostFromRequest(req) {
  // Agar kabhi Next.js proxy/rewrite se aaye to asli host x-forwarded-host / x-store-host me hota hai
  return req.headers["x-store-host"] || req.headers["x-forwarded-host"] || req.headers.host || "";
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

async function resolveStore(req, res, next) {
  try {
    const { tenant, store } = await resolveStoreByHost(hostFromRequest(req));
    req.tenant = tenant;
    req.store = store;
    req.storeMissing = tenant.type !== "platform" && !store;
    next();
  } catch (error) {
    next(error);
  }
}

/** Route-level guard: sirf store host par chalne wale endpoints ke liye */
function requireStore(req, res, next) {
  if (req.store) return next();
  return res.status(404).json({
    success: false,
    code: "STORE_NOT_FOUND",
    message: "Store not found for this address.",
    host: req.tenant?.host,
  });
}

module.exports = { resolveStore, requireStore, resolveStoreByHost, clearStoreHostCache };
