// ==========================================================
// TENANT HOST — Host header se store pehchanna (multi-tenant)
// ----------------------------------------------------------
// ROOT_DOMAIN (.env) platform ka domain hai, port ke BAGHAIR:
//   development → 192.168.88.35.nip.io   (nip.io: *.192.168.88.35.nip.io → 192.168.88.35)
//   production  → eccomerce.com
//
//   192.168.88.35.nip.io          → platform  (landing, signup, super-admin)
//   alistore.192.168.88.35.nip.io → store jiska subdomain "alistore" hai
//   eastore.test / eastore.com    → store jiska customDomain match kare
//   localhost / 192.168.88.35     → platform (purana single-store dev flow)
// ==========================================================

const ROOT_DOMAIN = String(process.env.ROOT_DOMAIN || "")
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, "")
  .replace(/:\d+$/, "")
  .replace(/\/+$/, "");

// Ye naam kabhi kisi store ko subdomain ke taur par nahi milenge.
const RESERVED_SUBDOMAINS = new Set([
  "www", "api", "app", "admin", "super-admin", "superadmin", "dashboard",
  "mail", "email", "smtp", "ftp", "cdn", "static", "assets", "media", "uploads",
  "socket", "ws", "help", "support", "docs", "blog", "status", "billing",
  "login", "signup", "register", "auth", "account", "store", "stores", "shop",
  "landing", "seller", "sellers", "test", "dev", "staging",
]);

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** "Alistore.192.168.88.35.nip.io:3000" → "alistore.192.168.88.35.nip.io" */
function normalizeHost(rawHost) {
  return String(rawHost || "")
    .split(",")[0] // x-forwarded-host me comma-separated list aa sakti hai
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

/**
 * Host ko classify karta hai.
 * @returns {{ type: "platform" } | { type: "subdomain", subdomain: string, host: string } | { type: "custom", domain: string, host: string }}
 */
function parseTenantHost(rawHost) {
  const host = normalizeHost(rawHost);

  // Dot ke baghair host (localhost, PC ka naam) ya IP → platform
  if (!host || !host.includes(".") || IPV4_RE.test(host)) {
    return { type: "platform", host };
  }
  if (!ROOT_DOMAIN) return { type: "platform", host };
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return { type: "platform", host };

  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = host.slice(0, -(ROOT_DOMAIN.length + 1));
    // Sirf ek level: "a.b.root" store nahi hai
    if (sub && !sub.includes(".")) return { type: "subdomain", subdomain: sub, host };
    return { type: "unknown", host };
  }

  return { type: "custom", domain: host, host };
}

/** "Ali's Store!" → "alis-store" */
function slugifySubdomain(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents hatao (é → e)
    .replace(/['’]/g, "")       // apostrophe hatao (ali's → alis)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
}

/** @returns {string|null} error message, ya null agar theek hai */
function validateSubdomain(sub) {
  if (!sub) return "Subdomain is required.";
  if (sub.length < 3) return "Subdomain must be at least 3 characters.";
  if (!SUBDOMAIN_RE.test(sub)) return "Use only lowercase letters, numbers and hyphens (not at the start or end).";
  if (RESERVED_SUBDOMAINS.has(sub)) return "This subdomain is reserved.";
  return null;
}

/** Root domain ya uska koi subdomain? (CORS ke liye, sync check) */
function isPlatformFamilyHost(hostname) {
  const host = normalizeHost(hostname);
  if (!ROOT_DOMAIN || !host) return false;
  return host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`);
}

module.exports = {
  ROOT_DOMAIN,
  RESERVED_SUBDOMAINS,
  normalizeHost,
  parseTenantHost,
  slugifySubdomain,
  validateSubdomain,
  isPlatformFamilyHost,
};
