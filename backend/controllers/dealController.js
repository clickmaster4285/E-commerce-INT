const Deal = require("../models/Deal");
const { getIO } = require("../utils/socket");

const emitSocketEvent = (event, data) => {
  try {
    const io = getIO();
    if (io) io.emit(event, data);
  } catch (_) {}
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

    const query = {};

    // ==========================================
    // SEARCH
    // ==========================================

    if (search.trim()) {
      query.$or = [
        {
          name: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          description: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    // ==========================================
    // TYPE FILTER
    // ==========================================

    if (type !== "all") {
      query.type = type;
    }

    // ==========================================
    // APPLY TO FILTER
    // ==========================================

    if (applyTo !== "all") {
      query.applyTo = applyTo;
    }

    // ==========================================
    // STATUS FILTER
    // ==========================================

    const now = new Date();

    if (status === "active") {
      query.isActive = true;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    }

    if (status === "upcoming") {
      query.startDate = { $gt: now };
    }

    if (status === "expired") {
      query.endDate = { $lt: now };
    }

    if (status === "disabled") {
      query.isActive = false;
    }

    // ==========================================
    // PAGINATION
    // ==========================================

    const currentPage = Math.max(Number(page) || 1, 1);
    const perPage = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const skip = (currentPage - 1) * perPage;

    // ==========================================
    // GET DATA
    // ==========================================

    const [deals, total] = await Promise.all([
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
    ]);

    res.status(200).json({
      success: true,
      data: deals,
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

    res.status(200).json({
      success: true,
      data: deal,
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

    emitSocketEvent("deal:updated", { success: true, data: updatedDeal });
    emitSocketEvent("dealUpdated", { success: true, data: updatedDeal });

    res.status(200).json({
      success: true,
      message: "Deal updated successfully",
      data: updatedDeal,
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
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 0; // 0 = legacy mode
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

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
    const { page = 1, limit = 20 } = req.query;
    const Product = require("../models/Product");

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

    let productsQuery = { is_deleted: false, status: "active" };
    
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

    const skip = (Number(page) - 1) * Number(limit);
    
    // ✅ NO .populate('variants') - kyunki schema mein nahi hai
    const [productsToShow, totalProducts] = await Promise.all([
      Product.find(productsQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Product.countDocuments(productsQuery)
    ]);

    console.log("📦 Products found:", productsToShow.length, "out of total", totalProducts);

    const dealObj = deal.toObject();
    dealObj.resolvedProducts = productsToShow;
    dealObj.totalProducts = totalProducts;
    dealObj.currentPage = Number(page);
    dealObj.totalPages = Math.ceil(totalProducts / Number(limit));

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