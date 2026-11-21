const mongoose = require("mongoose");
const { slugifySubdomain, RESERVED_SUBDOMAINS } = require("../utils/tenantHost");
const tenantScope = require("../utils/tenantScopePlugin");

const storeSchema = new mongoose.Schema({
  store_name: { type: String, default: "My Professional Store" },
  tagline: { type: String, default: "Welcome to our store" },

  // ── Multi-tenant domains ──
  // subdomain:    "alistore" → alistore.<ROOT_DOMAIN>  (dev: alistore.192.168.88.35.nip.io:3000)
  // customDomain: "eastore.com" (sirf host, bina protocol/port) — domainVerified true hone par hi live
  subdomain: { type: String, lowercase: true, trim: true, default: undefined },
  customDomain: { type: String, lowercase: true, trim: true, default: undefined },
  domainVerified: { type: Boolean, default: false },
  domainVerifyToken: { type: String, default: "" },
  email: { type: String, default: "store@example.com" },
  phone: { type: String, default: "" },
  support_email: { type: String, default: "" },
  support_phone: { type: String, default: "" },
  
  // Address
  country: { type: String, default: "PK" },
  state: { type: String, default: "" },
  city: { type: String, default: "" },
  zip_code: { type: String, default: "" },
  address: { type: String, default: "" },
  description: { type: String, default: "" },
  business_category: { type: String, default: "" },
  business_type: { type: String, default: "" },

  // Business
  currency: { type: String, default: "PKR" },
  tax_rate: { type: Number, default: 0 },
  weight_unit: { type: String, default: "kg" },
  store_status: { type: String, default: "open" }, // open, closed, maintenance
  maintenance_message: { type: String, default: "" },

  // Platform subscription plan (super-admin Plans module) — optional
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null, index: true },
  
  // Branding
  logo: { 
    img_url: { type: String, default: "" },
    public_id: { type: String, default: "" } // Cloudinary use kar rahe hain toh
  },
  
  // SEO
  meta_title: { type: String, default: "" },
  meta_description: { type: String, default: "" },
  meta_keywords: { type: String, default: "" },
  
  // Social Links
  social_links: {
    facebook: { type: String, default: "" },
    instagram: { type: String, default: "" },
    twitter: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    youtube: { type: String, default: "" },
    tiktok: { type: String, default: "" },
  },
  
  // Legal
  return_policy: { type: String, default: "" },
  privacy_policy: { type: String, default: "" },
  terms_conditions: { type: String, default: "" },
  quote_terms_conditions: { type: String, default: "" },
  invoice_terms_conditions: { type: String, default: "" },
  quote_terms_translations: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  invoice_terms_translations: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

  activity: [{
    action: { type: String, required: true },
    summary: { type: String, required: true },
    actorType: { type: String, enum: ["superadmin", "employee", "system"], default: "system" },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actorName: { type: String, default: "System" },
    at: { type: Date, default: Date.now },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  }],

}, { timestamps: true });

// Unique sirf un docs par jahan field set hai (purane stores bina subdomain ke chal sakte hain)
storeSchema.index(
  { subdomain: 1 },
  { unique: true, partialFilterExpression: { subdomain: { $type: "string" } } },
);
storeSchema.index(
  { customDomain: 1 },
  { unique: true, partialFilterExpression: { customDomain: { $type: "string" } } },
);

/** store_name se ek free subdomain banata hai: "ali-store", "ali-store-2", ... */
storeSchema.statics.generateUniqueSubdomain = async function (name, excludeId = null) {
  let base = slugifySubdomain(name);
  if (base.length < 3 || RESERVED_SUBDOMAINS.has(base)) base = `store-${base || "new"}`.replace(/-+$/, "");
  base = base.slice(0, 55).replace(/-+$/, "");

  for (let i = 1; i < 1000; i += 1) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const filter = { subdomain: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    // eslint-disable-next-line no-await-in-loop
    const taken = await this.exists(filter).setOptions({ skipTenantScope: true });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
};

// Naya store (Store.create / new Store().save()) → khud subdomain mil jata hai
storeSchema.pre("validate", async function () {
  if (this.isNew && !this.subdomain) {
    this.subdomain = await this.constructor.generateUniqueSubdomain(this.store_name, this._id);
  }
  if (this.customDomain === "") this.customDomain = undefined;
});

// Store host par `Store.findOne()` / `findById()` sirf CURRENT store dete hain
// (purana single-store code jaise storeController / socket bina badle sahi store
// par kaam karta hai). Platform host (super admin) par saare stores.
storeSchema.plugin(tenantScope, { field: "_id", stamp: false });

// Naya store → uske apne default attributes (Attribute ab per-store hai).
// Sirf create par. Update (status, plan, profile) dubara seed nahi karta.
// Background me — signup / approval request iska intezar nahi karti.
storeSchema.pre("save", function () {
  this.$locals.wasNew = this.isNew;
});
storeSchema.post("save", function (doc) {
  const created = Boolean(this.$locals?.wasNew || doc?.$locals?.wasNew);
  const storeId = doc?._id || this._id;
  if (!created || !storeId) return;
  setImmediate(() => {
    const { seedAttributesForStore } = require("../scripts/seedAttributes");
    seedAttributesForStore(storeId)
      .then((result) => {
        console.log(`🌍 Attributes seeded for new store ${storeId} — created ${result?.created ?? 0}, updated ${result?.updated ?? 0}.`);
      })
      .catch((error) => {
        console.error("[store] attribute seed failed:", error.message);
      });
  });
});

module.exports = mongoose.model("Store", storeSchema);
