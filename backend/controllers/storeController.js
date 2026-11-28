const Store = require("../models/Store");
const { OWNER_ROLE, ADMIN_ROLES, STAFF_ROLES, ASSIGNABLE_ROLES, isOwnerRole, isAdminRole, isStaffRole } = require("../utils/roles");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity, pushStoreActivity, getChanges } = require("../utils/activityHelper");
const { validatePhone } = require("../utils/phoneValidator");
const { normalizeCountryCode, countryDisplayName } = require("../utils/geo");
const log = require("../utils/logger");
const { hasPermission } = require("../middleware/checkPermission");

// @desc    Get Store Info
const getStoreInfo = async (req, res) => {
  try {
    let store = await Store.findOne();
    // Store host par ye hamesha current store hai; blank store khud se nahi banta
    if (!store) return res.status(404).json({ success: false, code: "STORE_NOT_FOUND", message: "Store not found." });
    res.status(200).json({ success: true, data: store.toObject() });
  } catch (error) {
    log.error("Get Store Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Store Info
const updateStoreInfo = async (req, res) => {
  try {
    // ✅ CHECK STORE PERMISSION
    // Shared helper: admin always, baqi ko `store === true` (requireTrue)
    if (!hasPermission(req.user, "store", "requireTrue")) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You don't have permission to edit store settings. Please contact an administrator or another staff member to grant you store access.",
      });
    }

    let store = await Store.findOne();
    // Store host par ye hamesha current store hai; blank store khud se nahi banta
    if (!store) return res.status(404).json({ success: false, code: "STORE_NOT_FOUND", message: "Store not found." });

    const oldData = store.toObject();

    const {
      store_name, tagline, email, phone,
      support_email, support_phone,
      country, state, city, zip_code, address,
      currency, tax_rate, weight_unit,
      business_type, total_employees, year_established,
      maintenance_message,
      meta_title, meta_description, meta_keywords,
      return_policy, privacy_policy, terms_conditions,
      quote_terms_conditions, invoice_terms_conditions,
      quote_terms_translations, invoice_terms_translations,
      social_links,
    } = req.body;

    if (store_name !== undefined) store.store_name = store_name;
    if (tagline !== undefined) store.tagline = tagline;
    if (email !== undefined) store.email = email;
    if (phone !== undefined) {
      const phoneResult = validatePhone(phone);
      if (!phoneResult.valid) {
        return res.status(400).json({ success: false, message: `Phone: ${phoneResult.message}` });
      }
      store.phone = phoneResult.sanitized;
    }
    if (support_email !== undefined) store.support_email = support_email;
    if (support_phone !== undefined) {
      const supportPhoneResult = validatePhone(support_phone);
      if (!supportPhoneResult.valid) {
        return res.status(400).json({ success: false, message: `Support phone: ${supportPhoneResult.message}` });
      }
      store.support_phone = supportPhoneResult.sanitized;
    }
    if (country !== undefined) {
      const code = normalizeCountryCode(country);
      store.country = code ? countryDisplayName(code) || String(country).trim() : "";
    }
    if (state !== undefined) store.state = state;
    if (city !== undefined) store.city = city;
    if (zip_code !== undefined) store.zip_code = zip_code;
    if (address !== undefined) store.address = address;
    if (currency !== undefined) store.currency = currency;
    if (tax_rate !== undefined) store.tax_rate = Number(tax_rate) || 0;
    if (weight_unit !== undefined) store.weight_unit = weight_unit;
    if (business_type !== undefined) store.business_type = business_type;
    if (total_employees !== undefined) store.total_employees = total_employees;
    if (year_established !== undefined) store.year_established = year_established;
    // store_status is super-admin only (optimizeplan.md §2.2) — ignored here even if sent
    if (maintenance_message !== undefined) store.maintenance_message = maintenance_message;
    if (meta_title !== undefined) store.meta_title = meta_title;
    if (meta_description !== undefined) store.meta_description = meta_description;
    if (meta_keywords !== undefined) store.meta_keywords = meta_keywords;
    if (return_policy !== undefined) store.return_policy = return_policy;
    if (privacy_policy !== undefined) store.privacy_policy = privacy_policy;
    if (terms_conditions !== undefined) store.terms_conditions = terms_conditions;
    if (quote_terms_conditions !== undefined) store.quote_terms_conditions = quote_terms_conditions;
    if (invoice_terms_conditions !== undefined) store.invoice_terms_conditions = invoice_terms_conditions;
    if (quote_terms_translations !== undefined) store.quote_terms_translations = quote_terms_translations;
    if (invoice_terms_translations !== undefined) store.invoice_terms_translations = invoice_terms_translations;

    if (social_links) {
      store.social_links = typeof social_links === "string" ? JSON.parse(social_links) : social_links;
    }

    let logoChanged = false;
    if (req.file) {
      // Socket upload relativePath deta hai; REST (multer) ka asal saved path
      const relativePath = req.file.relativePath || require("../utils/uploadPaths").uploadUrlFor(req.file.path).slice(1);
      const cleanPath = relativePath.includes("/uploads/")
        ? relativePath.substring(relativePath.indexOf("uploads/"))
        : relativePath;

      store.logo = { img_url: cleanPath, public_id: req.file.filename };
      logoChanged = true;
    }

    const updatedStore = await store.save();

    // ✅ LOG ACTIVITY
    const trackedFields = ["store_name", "tagline", "email", "phone", "address", "currency", "store_status"];
    const changes = getChanges(oldData, updatedStore.toObject(), trackedFields);
    if (logoChanged) changes.push({ field: "logo", oldValue: "(old)", newValue: "(new)" });

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    let io = req.io || null;
    try { if (!io) io = getIO(); } catch { /* tests / socket not booted */ }

    if (changes.length > 0) {
        const changedFields = changes.map((c) => c.field).join(", ");
        if (io) {
          await pushGlobalActivity(io, {
              action: `${performerName} updated ${changedFields} for Store`,
              category: "Store Management",
              performedBy: performerId,
              performedByName: performerName,
              details: { changes },
          }, performerId);
        }
        await pushStoreActivity(updatedStore._id, req, "updated", `${performerName} updated store settings`, { changes });
    }

    try {
      if (io) io.emit("storeUpdated", updatedStore.toObject());
    } catch (_) {}

    res.status(200).json({
      success: true,
      data: updatedStore.toObject(),
      message: "Store updated successfully",
    });
  } catch (error) {
    log.error("Update Store Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================================
// MULTI-TENANT DOMAINS
// ==========================================================
const crypto = require("crypto");
const {
  ROOT_DOMAIN, slugifySubdomain, validateSubdomain, normalizeHost, isPlatformFamilyHost,
} = require("../utils/tenantHost");
const { clearStoreHostCache } = require("../middleware/resolveStore");

const STORE_PROTOCOL = process.env.PUBLIC_STORE_PROTOCOL || (process.env.NODE_ENV === "production" ? "https" : "http");
const STORE_PORT = String(process.env.PUBLIC_STORE_PORT || "").trim();

/** Store ke public URLs (dev: http://alistore.192.168.88.35.nip.io:3000) */
const buildStoreUrls = (store) => {
  const port = STORE_PORT ? `:${STORE_PORT}` : "";
  return {
    subdomainUrl: store?.subdomain && ROOT_DOMAIN ? `${STORE_PROTOCOL}://${store.subdomain}.${ROOT_DOMAIN}${port}` : null,
    customDomainUrl: store?.customDomain ? `${STORE_PROTOCOL}://${store.customDomain}${port}` : null,
  };
};

const STORE_PUBLIC_SELECT = [
  "store_name", "tagline", "logo.img_url", "phone", "email",
  "support_email", "support_phone", "address", "city", "state", "country", "zip_code",
  "social_links", "currency", "tax_rate", "store_status", "maintenance_message",
  "subdomain", "customDomain", "business_category",
].join(" ");

const publicStorePayload = (store) => {
  const logoUrl = store?.logo?.img_url || "";
  return {
    _id: store._id,
    store_name: store.store_name,
    tagline: store.tagline || "",
    logo: logoUrl ? { img_url: logoUrl } : null,
    phone: store.phone || "",
    email: store.email || "",
    support_email: store.support_email || "",
    support_phone: store.support_phone || "",
    address: store.address || "",
    city: store.city || "",
    state: store.state || "",
    country: store.country || "",
    zip_code: store.zip_code || "",
    social_links: store.social_links || {},
    currency: store.currency || "PKR",
    tax_rate: store.tax_rate ?? 0,
    store_status: store.store_status || "open",
    maintenance_message: store.maintenance_message || "",
    subdomain: store.subdomain || "",
    customDomain: store.customDomain || null,
    business_category: store.business_category || "",
    ...buildStoreUrls(store),
  };
};

// @desc  Storefront store info — jis host par page khula hai usi store ki info
// @route GET /api/store/public
const getPublicStoreInfo = async (req, res) => {
  try {
    if (req.storeMissing) {
      return res.status(404).json({ success: false, code: "STORE_NOT_FOUND", message: "Store not found for this address." });
    }
    // Whitelist only (optimizeplan.md §9.2 StorePublic) — no activity/plan/terms/public_id
    const store = await Store.findOne().select(STORE_PUBLIC_SELECT).lean();
    if (!store) return res.status(404).json({ success: false, code: "STORE_NOT_FOUND", message: "Store not found." });
    return res.status(200).json({ success: true, data: publicStorePayload(store) });
  } catch (error) {
    log.error("Get Public Store Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Ye host kis tenant ka hai? (frontend debugging / routing ke liye)
// @route GET /api/store/resolve
const resolveTenant = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      rootDomain: ROOT_DOMAIN || null,
      tenant: req.tenant,
      found: Boolean(req.store),
      store: req.store
        ? { _id: req.store._id, store_name: req.store.store_name, subdomain: req.store.subdomain,
            customDomain: req.store.customDomain || null, ...buildStoreUrls(req.store) }
        : null,
    },
  });
};

// @desc  Subdomain available hai?
// @route GET /api/store/check-subdomain?name=alistore
const checkSubdomain = async (req, res) => {
  try {
    const subdomain = slugifySubdomain(req.query.name);
    const error = validateSubdomain(subdomain);
    if (error) return res.status(200).json({ success: true, data: { subdomain, available: false, reason: error } });

    const filter = { subdomain };
    if (req.user?.storeId) filter._id = { $ne: req.user.storeId };
    const taken = await Store.exists(filter).setOptions({ skipTenantScope: true }); // saare stores me check
    res.status(200).json({
      success: true,
      data: {
        subdomain,
        available: !taken,
        reason: taken ? "This subdomain is already taken." : null,
        ...buildStoreUrls({ subdomain }),
      },
    });
  } catch (error) {
    log.error("Check Subdomain Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Apne store ka subdomain / custom domain set karo
// @route PUT /api/store/domain   body: { subdomain?, customDomain? }
const updateStoreDomain = async (req, res) => {
  try {
    const storeId = req.user?.storeId || req.store?._id;
    const store = storeId ? await Store.findById(storeId) : await Store.findOne();
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });

    const { subdomain, customDomain } = req.body || {};

    if (subdomain !== undefined) {
      const clean = slugifySubdomain(subdomain);
      const error = validateSubdomain(clean);
      if (error) return res.status(400).json({ success: false, message: error });
      if (await Store.exists({ subdomain: clean, _id: { $ne: store._id } }).setOptions({ skipTenantScope: true })) { // subdomain/domain uniqueness saare stores me check (cross-store)
        return res.status(409).json({ success: false, message: "This subdomain is already taken." });
      }
      store.subdomain = clean;
    }

    if (customDomain !== undefined) {
      const domain = normalizeHost(String(customDomain).replace(/^https?:\/\//i, "").split("/")[0]);
      if (!domain) {
        store.customDomain = undefined;
        store.domainVerified = false;
        store.domainVerifyToken = "";
      } else {
        if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
          return res.status(400).json({ success: false, message: "Enter a valid domain, e.g. mystore.com" });
        }
        if (isPlatformFamilyHost(domain)) {
          return res.status(400).json({ success: false, message: "Use the subdomain field for platform addresses." });
        }
        if (await Store.exists({ customDomain: domain, _id: { $ne: store._id } }).setOptions({ skipTenantScope: true })) { // subdomain/domain uniqueness saare stores me check (cross-store)
          return res.status(409).json({ success: false, message: "This domain is already connected to another store." });
        }
        if (store.customDomain !== domain) {
          store.customDomain = domain;
          store.domainVerified = false;
          store.domainVerifyToken = crypto.randomBytes(16).toString("hex");
        }
      }
    }

    await store.save();
    clearStoreHostCache();

    const data = store.toObject();
    res.status(200).json({
      success: true,
      message: "Store domain updated.",
      data: {
        subdomain: data.subdomain,
        customDomain: data.customDomain || null,
        domainVerified: data.domainVerified,
        // Production DNS instructions (dev me hosts file kaafi hai)
        dnsRecords: data.customDomain
          ? [
              { type: "CNAME", name: data.customDomain, value: ROOT_DOMAIN ? `stores.${ROOT_DOMAIN}` : "<your server>" },
              { type: "TXT", name: `_store-verify.${data.customDomain}`, value: data.domainVerifyToken },
            ]
          : [],
        ...buildStoreUrls(data),
      },
    });
  } catch (error) {
    log.error("Update Store Domain Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getStoreInfo, updateStoreInfo,
  getPublicStoreInfo, resolveTenant, checkSubdomain, updateStoreDomain,
};
