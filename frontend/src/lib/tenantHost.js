// ==========================================================
// TENANT HOST (frontend) — page ka host kis store ka hai + backend URL
// ----------------------------------------------------------
// NEXT_PUBLIC_ROOT_DOMAIN = platform domain (port ke saath ya baghair)
//   dev  → 192.168.88.35.nip.io:3000
//   prod → eccomerce.com
//
//   192.168.88.35.nip.io:3000          → platform (landing, signup, super-admin)
//   alistore.192.168.88.35.nip.io:3000 → store "alistore"
//   eastore.test:3000                  → custom domain store
//   localhost / 192.168.88.35          → platform (purana flow, kuch nahi tootta)
//
// Edge middleware + browser + server, teeno jagah chalta hai (koi Node API nahi).
// ==========================================================

const RAW_ROOT = String(process.env.NEXT_PUBLIC_ROOT_DOMAIN || "")
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");

/** "192.168.88.35.nip.io" (bina port) */
export const ROOT_DOMAIN = RAW_ROOT.replace(/:\d+$/, "");
/** ":3000" ya "" */
export const ROOT_PORT_SUFFIX = (RAW_ROOT.match(/:\d+$/) || [""])[0];

const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export const normalizeHost = (rawHost) =>
  String(rawHost || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");

const isLocalNetworkHost = (hostname) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
  /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname);

/**
 * @returns {{type:"platform",host:string} | {type:"subdomain",subdomain:string,host:string} | {type:"custom",domain:string,host:string} | {type:"unknown",host:string}}
 */
export function parseTenantHost(rawHost) {
  const host = normalizeHost(rawHost);
  // Dot ke baghair host (localhost, PC ka naam) ya IP → platform
  if (!host || !host.includes(".") || IPV4_RE.test(host)) return { type: "platform", host };
  if (!ROOT_DOMAIN) return { type: "platform", host };
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return { type: "platform", host };
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = host.slice(0, -(ROOT_DOMAIN.length + 1));
    if (sub && !sub.includes(".")) return { type: "subdomain", subdomain: sub, host };
    return { type: "unknown", host };
  }
  return { type: "custom", domain: host, host };
}

export const isStoreHost = (rawHost) => {
  const { type } = parseTenantHost(rawHost);
  return type === "subdomain" || type === "custom";
};

/** Browser me current tenant */
export const getCurrentTenant = () =>
  typeof window === "undefined" ? { type: "platform", host: "" } : parseTenantHost(window.location.host);

/** Platform (root) ka URL, e.g. platformUrl("/landing") → http://192.168.88.35.nip.io:3000/landing */
export function platformUrl(path = "/", protocol) {
  const proto = protocol || (typeof window !== "undefined" ? window.location.protocol : "http:");
  if (!ROOT_DOMAIN) return path;
  return `${proto}//${ROOT_DOMAIN}${ROOT_PORT_SUFFIX}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Store ka URL, e.g. storeUrl("alistore", "/admin") → http://alistore.192.168.88.35.nip.io:3000/admin */
export function storeUrl(subdomain, path = "/", protocol) {
  const proto = protocol || (typeof window !== "undefined" ? window.location.protocol : "http:");
  if (!ROOT_DOMAIN || !subdomain) return path;
  return `${proto}//${subdomain}.${ROOT_DOMAIN}${ROOT_PORT_SUFFIX}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Backend origin/URL ko PAGE ke hostname par le aao (sirf jab env me local IP/localhost ho).
 *
 * Kyun: auth cookies httpOnly + sameSite=lax + host-only hain. Page
 * alistore.192.168.88.35.nip.io:3000 par ho aur API 192.168.88.35:5000 par, to
 * browser ke liye ye alag "site" hai → cookie nahi jaati. Same hostname
 * (alistore.192.168.88.35.nip.io:5000) par cookie jaati hai, kyunke cookies port
 * nahi dekhti. Backend bhi isi Host se store pehchanta hai.
 *
 * Production (env me api.eccomerce.com jaisa public host) par kuch nahi badalta.
 */
export function alignBackendUrl(url) {
  if (!url || typeof window === "undefined") return url || null;
  try {
    const parsed = new URL(url);
    if (isLocalNetworkHost(parsed.hostname)) {
      parsed.hostname = window.location.hostname;
      if (window.location.protocol === "https:") parsed.protocol = "https:";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return url;
  }
}

/** Socket.io origin (bina /api), page host ke saath aligned */
export function getBackendOrigin() {
  const explicit = (process.env.NEXT_PUBLIC_SOCKET_URL || "").trim();
  const serverUrl = (process.env.NEXT_PUBLIC_SERVERURL || "").trim();
  const origin = explicit
    ? explicit.replace(/^ws(s?):\/\//, "http$1://").replace(/\/+$/, "")
    : serverUrl.replace(/\/+$/, "").replace(/\/api\/?$/, "");
  if (!origin) return null;
  return alignBackendUrl(origin);
}
