const { ROOT_DOMAIN } = require("./tenantHost");

// Store ka public base URL (subdomain par) — e.g. http://alistore.192.168.88.35.nip.io:3000
// Store handoff aur emails (admin panel link) dono yahi use karte hain.
const storeAdminBaseUrl = (store) => {
  const protocol = process.env.PUBLIC_STORE_PROTOCOL || (process.env.NODE_ENV === "production" ? "https" : "http");
  const port = String(process.env.PUBLIC_STORE_PORT || "").trim();
  if (!store?.subdomain || !ROOT_DOMAIN) return null;
  return `${protocol}://${store.subdomain}.${ROOT_DOMAIN}${port ? `:${port}` : ""}`;
};

module.exports = { storeAdminBaseUrl };
