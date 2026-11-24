const mongoose = require("mongoose");

const FEATURE_TIERS = ["none", "basic", "advanced"];
const BILLING_INTERVALS = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semiannual",
  "yearly",
  "biennial",
  "lifetime",
  "one_time",
  "custom",
];

// null = unlimited — shared shape for publicPlan / parsePlanBody
const LIMIT_KEYS = [
  "maxProducts",
  "maxStaffAccounts",
  "maxOrders",
  "maxChats",
  "maxLeads",
  "maxQuotes",
  "maxInvoices",
];

const limitField = () => ({ type: Number, default: null, min: 0 });

const slugifyPlan = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "plan";

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    description: { type: String, default: "", trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    sortOrder: { type: Number, default: 0 },

    price: { type: Number, default: 0, min: 0 },
    billingInterval: { type: String, enum: BILLING_INTERVALS, default: "monthly" },
    currency: { type: String, default: "PKR", trim: true, uppercase: true },

    limits: {
      maxProducts: limitField(),
      maxStaffAccounts: limitField(),
      maxOrders: limitField(),
      maxChats: limitField(),
      maxLeads: limitField(),
      maxQuotes: limitField(),
      maxInvoices: limitField(),
    },

    features: {
      orderManagement: { type: String, enum: FEATURE_TIERS, default: "basic" },
      analytics: { type: String, enum: FEATURE_TIERS, default: "basic" },
      pos: { type: Boolean, default: false },
      customDomain: { type: Boolean, default: false },
      // Store editor (theme / homepage sections / menus / pages). Default ON taake
      // purane plans par sellers ka access na toote; super admin plan se band kar sakta hai.
      storeEditor: { type: Boolean, default: true },
    },

    // Kis super admin ne plan create kiya
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "SuperAdmin", default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "plans",
  },
);

planSchema.statics.slugify = slugifyPlan;
planSchema.statics.FEATURE_TIERS = FEATURE_TIERS;
planSchema.statics.BILLING_INTERVALS = BILLING_INTERVALS;
planSchema.statics.LIMIT_KEYS = LIMIT_KEYS;

/** Name se unique slug — excludeId update par current plan skip karta hai */
planSchema.statics.uniqueSlug = async function (name, excludeId = null) {
  const base = slugifyPlan(name);
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const filter = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    // eslint-disable-next-line no-await-in-loop
    const taken = await this.exists(filter);
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
};

module.exports = mongoose.model("Plan", planSchema);
