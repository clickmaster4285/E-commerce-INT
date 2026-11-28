/** Public store payload — whitelist only (§9.2 StorePublic) */
function toStorePublic(doc) {
  if (!doc) return null;
  const logoUrl = typeof doc.logo === "string"
    ? doc.logo
    : doc.logo?.url || doc.logo?.img_url || "";
  return {
    store_name: doc.store_name || "",
    tagline: doc.tagline || "",
    logo: logoUrl ? { url: logoUrl } : null,
    phone: doc.phone || "",
    support_email: doc.support_email || doc.email || "",
    support_phone: doc.support_phone || doc.phone || "",
    address: doc.address || "",
    city: doc.city || "",
    country: doc.country || doc.country_code || "",
    social_links: doc.social_links || {},
    currency: doc.currency || "PKR",
    store_status: doc.store_status || "open",
    maintenance_message: doc.maintenance_message || "",
  };
}

module.exports = { toStorePublic };
