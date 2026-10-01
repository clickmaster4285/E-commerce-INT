const Deal = require("../models/Deal");
const User = require("../models/User");
const Employee = require("../models/Employee");
const { getIO } = require("../utils/socket");

const emitSocketEvent = (event, data) => {
  try {
    const io = getIO();
    if (io) io.emit(event, data);
  } catch (_) {}
};

// ==========================================
// ✅ CREATEDBY / UPDATEDBY RESOLUTION
// ==========================================
// Deal model mein createdBy/updatedBy ka ref sirf "User" hai, lekin admin panel
// se login karne wale accounts Employee collection mein hote hain. Aise case
// mein .populate(...) null return karta hai — is wajah se detail page par
// "Updated by" (aur history table ka editor) hamesha blank reh jata tha,
// page refresh karne ke baad bhi. RAW id ko User -> Employee fallback ke sath
// resolve karo (Discount/Product controllers ka wahi pattern).
const ACTOR_FIELDS = "name email role";

// ✅ SEARCH SAFETY — user ka text seedha $regex me chala jata tha, is liye "." ya "["
//    jaise special characters query bigaad (ya slow) kar dete thay.
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveActor = async (rawId) => {
  if (!rawId) return null;
  // Pehle se populated (User/Employee document) → waisa hi return karo
  if (typeof rawId === "object" && (rawId.name || rawId.email)) return rawId;
  // ObjectId / string id → DB lookup (ObjectId ka toString() hex id deta hai)
  const id = String(rawId?._id || rawId);
  try {
    const user = await User.findById(id).select(ACTOR_FIELDS).lean();
    if (user) return user;
    return await Employee.findById(id).select(ACTOR_FIELDS).lean();
  } catch (_) {
    return null;
  }
};

// Populated document par original (raw) id doc.populated(path) se milti hai —
// populate fail hone par wahi id bachati hai, isliye fallback usi par chalta hai.
const rawPopulatedId = (doc, path) => {
  try {
    const v = typeof doc?.populated === "function" ? doc.populated(path) : null;
    return Array.isArray(v) ? v[0] : v;
  } catch (_) {
    return null;
  }
};

const resolveDealActors = async (deal) => {
  if (!deal) return deal;
  const obj = typeof deal.toObject === "function" ? deal.toObject() : { ...deal };
  if (!obj.createdBy) obj.createdBy = await resolveActor(rawPopulatedId(deal, "createdBy"));
  if (!obj.updatedBy) obj.updatedBy = await resolveActor(rawPopulatedId(deal, "updatedBy"));
  return obj;
};

// ==========================================
// BUNDLE OFFER CONDITION — SANITIZE / VALIDATE
// ==========================================
// A bundle deal stores exactly ONE rule. Invalid input is dropped so a broken
// rule can never half-apply at checkout.
const BUNDLE_REWARD_TYPES = ["percentage", "fixed_amount", "free_product"];

const sanitizeBundleRule = (raw) => {
  let input = raw;

  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch (_) {
      return null;
    }
  }

  // Legacy payload: array of rules (only the first one is kept now)
  if (Array.isArray(input)) input = input[0];
  if (!input || typeof input !== "object") return null;

  const mode = input.mode === "limit" || input.limit === true ? "limit" : "all";
  const buyQuantity = Math.max(0, Math.floor(Number(input.buyQuantity ?? input.buy_quantity) || 0));

  const rewardType = BUNDLE_REWARD_TYPES.includes(input.rewardType)
    ? input.rewardType
    : BUNDLE_REWARD_TYPES.includes(input.reward_type)
    ? input.reward_type
    : "percentage";

  let value = Math.max(0, Number(input.value) || 0);
  if (rewardType === "percentage") value = Math.min(100, value);
  if (rewardType === "free_product") value = 0;

  const freeProduct =
    input.freeProduct && typeof input.freeProduct === "object"
      ? input.freeProduct._id || input.freeProduct.id || null
      : input.freeProduct || input.free_product || input.freeProductId || null;

  if (rewardType === "free_product" && !freeProduct) return null;
  if (rewardType !== "free_product" && value <= 0) return null;
  if (mode === "limit" && buyQuantity <= 0) return null;

  return {
    mode,
    buyQuantity,
    rewardType,
    value,
    freeProduct: freeProduct || null,
    freeQuantity: Math.max(1, Math.floor(Number(input.freeQuantity ?? input.free_quantity) || 1)),
  };
};

// Non-bundle deals never keep a rule; legacy `bundleRules` key is migrated.
const applyBundleRule = (payload) => {
  if (!payload || typeof payload !== "object") return payload;

  if (!Object.prototype.hasOwnProperty.call(payload, "bundleRule")) {
    if (!Object.prototype.hasOwnProperty.call(payload, "bundleRules")) return payload;
    payload.bundleRule = payload.bundleRules;
  }

  delete payload.bundleRules;

  payload.bundleRule =
    payload.type === "bundle" ? sanitizeBundleRule(payload.bundleRule) : null;

  return payload;
};

const BUNDLE_FREE_PRODUCT_FIELDS = "name sku images selling_price price variants";

// ==========================================
// CREATE DEAL
// ==========================================

const createDeal = async (req, res) => {
  try {
    const payload = applyBundleRule({ ...req.body });

    const deal = await Deal.create({
      ...payload,
      createdBy: req.user?._id || req.user?.id || null,
      updatedBy: req.user?._id || req.user?.id || null,
    });

    emitSocketEvent("deal:created", { success: true, data: deal });
    emitSocketEvent("dealCreated", { success: true, data: deal });

    res.status(201).json({
      success: true,
      message: "Deal created successfully",
      data: deal,
    });
  } catch (error) {
    console.error("Create Deal Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create deal",
    });
  }
};

// ==========================================
// GET ALL DEALS
// ==========================================

const getDeals = async (req, res) => {
  try {
    const {
      search = "",
      status = "all",
      type = "all",
      applyTo = "all",
      page = 1,
      limit = 20,
    } = req.query;

    const now = new Date();
    const searchTerm = String(search).trim();
    const safeSearch = searchTerm ? escapeRegExp(searchTerm) : "";

    // ==========================================
    // BASE CLAUSES (search + type + applyTo)
    // ==========================================
    // ⚠️ Ye sirf LIST query par lagte hain. Dashboard cards (stats) inhi par bante hain
    //    taake "Active / Expired" counts poore dataset ko reflect karein, current page ko nahi.

    const baseClauses = [];

    if (safeSearch) {
      baseClauses.push({
        $or: [
          { name: { $regex: safeSearch, $options: "i" } },
          { code: { $regex: safeSearch, $options: "i" } },
          { description: { $regex: safeSearch, $options: "i" } },
        ],
      });
    }

    if (type && type !== "all") {
      baseClauses.push({ type });
    }

    if (applyTo && applyTo !== "all") {
      baseClauses.push({ applyTo });
    }

    // ✅ $and array use kar rahe hain — isse search ka $or aur status ke $or
    //    ek saath merge ho sakte hain (do top-level $or allowed nahi hote).
    const buildQuery = (extraClauses = []) => {
      const clauses = [...baseClauses, ...extraClauses];
      return clauses.length ? { $and: clauses } : {};
    };

    // ✅ STATUS SEMANTICS frontend ke getDealStatus() ke exactly match:
    //    disabled = isActive false, baaki sab isActive true + date checks.
    const statusClauses = {
      active: [{ isActive: true }, { startDate: { $lte: now } }, { endDate: { $gte: now } }],
      upcoming: [{ isActive: true }, { startDate: { $gt: now } }],
      expired: [{ isActive: true }, { endDate: { $lt: now } }],
      disabled: [{ isActive: false }],
    };

    // Frontend dropdown "scheduled" label use karta hai — dono aliases handle hain
    const requestedStatus = String(status).trim();
    const statusKey = requestedStatus === "scheduled" ? "upcoming" : requestedStatus;
    const query = buildQuery(statusClauses[statusKey] || []);

    // ==========================================
    // PAGINATION
    // ==========================================

    const currentPage = Math.max(Number(page) || 1, 1);
    const perPage = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const skip = (currentPage - 1) * perPage;

    // ==========================================
    // GET DATA (+ server-side stats)
    // ==========================================

    const [deals, total, baseTotal, activeCount, scheduledCount, expiredCount, disabledCount] =
      await Promise.all([
        Deal.find(query)
          .populate("productIds", "name sku images selling_price")
          .populate("bundleRule.freeProduct", BUNDLE_FREE_PRODUCT_FIELDS)
          .populate("categoryIds", "name code")
          .populate("brandIds", "name logo")
          .populate("createdBy", "name email role")
          .populate("updatedBy", "name email role")
          .sort({
            priority: -1,
            createdAt: -1,
          })
          .skip(skip)
          .limit(perPage)
          .lean(),

        Deal.countDocuments(query),
        Deal.countDocuments(buildQuery()),
        Deal.countDocuments(buildQuery(statusClauses.active)),
        Deal.countDocuments(buildQuery(statusClauses.upcoming)),
        Deal.countDocuments(buildQuery(statusClauses.expired)),
        Deal.countDocuments(buildQuery(statusClauses.disabled)),
      ]);

    res.status(200).json({
      success: true,
      data: deals,
      // ✅ Frontend ke stat cards ab inhi numbers par hain (page-size independent)
      stats: {
        total: baseTotal,
        active: activeCount,
        scheduled: scheduledCount,
        expired: expiredCount,
        disabled: disabledCount,
      },
      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        totalPages: Math.ceil(total / perPage),
        hasNextPage: currentPage < Math.ceil(total / perPage),
        hasPreviousPage: currentPage > 1,
      },
    });
  } catch (error) {
    console.error("Get Deals Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch deals",
    });
  }
};

// ==========================================
// GET SINGLE DEAL
// ==========================================

const getDealById = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await Deal.findById(id)
      .populate("productIds", "name sku images selling_price cost_price")
      .populate("categoryIds", "name code")
      .populate("brandIds", "name logo")
      .populate("bundleProducts.product", "name sku images selling_price")
      .populate("bundleRule.freeProduct", BUNDLE_FREE_PRODUCT_FIELDS)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role");

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    const data = await resolveDealActors(deal);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get Deal By ID Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch deal",
    });
  }
};

// ==========================================
// UPDATE DEAL
// ==========================================

const updateDeal = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await Deal.findById(id);

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    Object.assign(deal, applyBundleRule({ ...req.body }));

    deal.updatedBy =
      req.user?._id ||
      req.user?.id ||
      deal.updatedBy ||
      null;

    await deal.save();

    const updatedDeal = await Deal.findById(id)
      .populate("productIds", "name sku images selling_price")
      .populate("categoryIds", "name code")
      .populate("brandIds", "name logo")
      .populate("bundleProducts.product", "name sku images selling_price")
      .populate("bundleRule.freeProduct", BUNDLE_FREE_PRODUCT_FIELDS)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role");

    // ✅ Save ke baad wahi resolved payload emit/return karo jo GET deta hai —
    // warna frontend ko "Updated by" dikhane ke liye page refresh karna padta tha.
    const dealPayload = await resolveDealActors(updatedDeal);

    emitSocketEvent("deal:updated", { success: true, data: dealPayload });
    emitSocketEvent("dealUpdated", { success: true, data: dealPayload });

    res.status(200).json({
      success: true,
      message: "Deal updated successfully",
      data: dealPayload,
    });
  } catch (error) {
    console.error("Update Deal Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to update deal",
    });
  }
};

// ==========================================
// DELETE DEAL
// ==========================================

const deleteDeal = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await Deal.findById(id);

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    await Deal.findByIdAndDelete(id);

    emitSocketEvent("deal:deleted", { success: true, data: { id } });
    emitSocketEvent("dealDeleted", { success: true, data: { id } });

    res.status(200).json({
      success: true,
      message: "Deal deleted successfully",
    });
  } catch (error) {
    console.error("Delete Deal Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete deal",
    });
  }
};

// ==========================================
// TOGGLE DEAL STATUS
// ==========================================

const toggleDealStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await Deal.findById(id);

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    deal.isActive = !deal.isActive;

    deal.updatedBy =
      req.user?._id ||
      req.user?.id ||
      deal.updatedBy ||
      null;

    await deal.save();

    emitSocketEvent("deal:updated", { success: true, data: deal });
    emitSocketEvent("dealUpdated", { success: true, data: deal });

    res.status(200).json({
      success: true,
      message: deal.isActive
        ? "Deal activated successfully"
        : "Deal disabled successfully",
      data: deal,
    });
  } catch (error) {
    console.error("Toggle Deal Status Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to update deal status",
    });
  }
};
// ==========================================
// GET ACTIVE DEALS (PUBLIC — User GUI)
// ✅ Non-breaking: agar ?limit= nahi bheja to purana full-array response
// ==========================================

const getActiveDeals = async (req, res) => {
  try {
    const now = new Date();
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 0; // 0 = legacy mode (cap 50)

    const query = {
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    };

    // ---- LEGACY MODE (no limit) → exact old behavior ----
    if (!limit) {
      const deals = await Deal.find(query)
        .populate("productIds", "name sku images selling_price variants")
        .populate("categoryIds", "name code")
        .populate("brandIds", "name")
        .populate("bundleProducts.product", "name sku images selling_price")
        .populate("bundleRule.freeProduct", BUNDLE_FREE_PRODUCT_FIELDS)
        .sort({ priority: -1, createdAt: -1 })
        .lean();

      return res.status(200).json({ success: true, data: deals });
    }

    // ---- PAGINATED MODE ----
    const total = await Deal.countDocuments(query);
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages || 1);
    const skip = (safePage - 1) * limit;

    const deals = await Deal.find(query)
      .populate("productIds", "name sku images selling_price variants")
      .populate("categoryIds", "name code")
      .populate("brandIds", "name")
      .populate("bundleProducts.product", "name sku images selling_price")
      .populate("bundleRule.freeProduct", BUNDLE_FREE_PRODUCT_FIELDS)
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: deals,
      pagination: {
        total,
        page: safePage,
        limit,
        pages,
        hasNext: safePage < pages,
        hasPrev: safePage > 1,
      },
    });
  } catch (error) {
    console.error("Get Active Deals Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch active deals",
    });
  }
};
const getActiveDealById = async (req, res) => {
  try {
    const { id } = req.params;
    // ✅ Sanitized pagination — user cap 50, safe page clamp, deterministic order
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;
    const pageRaw = parseInt(req.query.page, 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const Product = require("../models/Product");
    const Variant = require("../models/Variant");

    console.log("🔍 Fetching deal with ID:", id);

    const deal = await Deal.findById(id)
      .populate("productIds", "name sku images selling_price variants brand_id category_id price discount")
      .populate("categoryIds", "name code")
      .populate("brandIds", "name")
      .populate("bundleRule.freeProduct", BUNDLE_FREE_PRODUCT_FIELDS);

    if (!deal) {
      console.log("❌ Deal not found in database");
      return res.status(404).json({ success: false, message: "Deal not found" });
    }

    console.log("✅ Deal found:", deal.name, "| applyTo:", deal.applyTo);

    let productsQuery = { is_deleted: { $ne: true }, status: "active" };

    if (deal.applyTo === "category" && deal.categoryIds && deal.categoryIds.length > 0) {
      const categoryIds = deal.categoryIds.map(c => c._id || c);
      productsQuery.category_id = { $in: categoryIds };
    }
    else if (deal.applyTo === "brand" && deal.brandIds && deal.brandIds.length > 0) {
      const brandIds = deal.brandIds.map(b => b._id || b);
      productsQuery.brand_id = { $in: brandIds };
    }
    else if (deal.applyTo === "product" && deal.productIds && deal.productIds.length > 0) {
      const productIds = deal.productIds.map(p => p._id || p);
      productsQuery._id = { $in: productIds };
    }

    const totalProducts = await Product.countDocuments(productsQuery);
    const totalPages = Math.max(1, Math.ceil(totalProducts / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    // ✅ Deterministic order (_id tie-break) taake pages overlap na hon
    const [productsToShow] = await Promise.all([
      Product.find(productsQuery)
        .populate("category_id", "name")
        .populate("brand_id", "name")
        .sort({ created_at: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // ✅ Variants + price attach (getProducts legacy item shape jaisa) —
    // storefront ko full catalog fetch ki zaroorat nahi rehti
    const pageIds = productsToShow.map((p) => p._id);
    const comboIds = (deal.productIds || []).map((p) => p?._id || p).filter(Boolean);
    const variantProductIds = [...new Set([...pageIds, ...comboIds].map(String))];
    const dealVariants = await Variant.find({
      product_id: { $in: variantProductIds },
      is_deleted: { $ne: true },
    })
      .sort({ created_at: 1, _id: 1 })
      .lean();
    const variantsMap = {};
    dealVariants.forEach((v) => {
      const pid = String(v.product_id);
      (variantsMap[pid] = variantsMap[pid] || []).push(v);
    });
    const withVariants = (p) => {
      const vs = variantsMap[String(p._id || p.id)] || p.variants || [];
      return {
        ...p,
        variants: vs,
        price: Number(vs[0]?.selling_price) || Number(p.price) || 0,
      };
    };

    console.log("📦 Products found:", productsToShow.length, "out of total", totalProducts);

    const dealObj = deal.toObject();
    dealObj.productIds = (dealObj.productIds || []).map(withVariants);
    dealObj.resolvedProducts = productsToShow.map(withVariants);
    dealObj.totalProducts = totalProducts;
    dealObj.currentPage = safePage;
    dealObj.totalPages = totalPages;
    dealObj.hasNext = safePage < totalPages;

    res.status(200).json({ success: true, data: dealObj });
  } catch (error) {
    console.error("❌ Get Active Deal By ID Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch deal" });
  }
};

// ==========================================
// UPLOAD DEAL IMAGE (BUNDLE DEAL IMAGE)
// ==========================================

const uploadDealImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    const url = `/uploads/deals/${req.file.filename}`;

    res.status(201).json({
      success: true,
      message: "Deal image uploaded successfully",
      data: { url },
    });
  } catch (error) {
    console.error("Upload Deal Image Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload deal image",
    });
  }
};

// ... (exports mein add karna mat bhoolna)
module.exports = {
  createDeal,
  getDeals,
  getActiveDeals,
  getDealById,
  getActiveDealById, // ✅ Yeh add karo
  updateDeal,
  deleteDeal,
  toggleDealStatus,
  uploadDealImage, // ✅ Bundle deal image upload
};