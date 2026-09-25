const Bundle = require("../models/Bundle");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const path = require("path");
const fs = require("fs-extra");

const IMAGE_FOLDER = path.join(__dirname, "../uploads/bundles");

// ==========================================
// HELPERS
// ==========================================
const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value._id || value.id || value.product || "");
  }
  return String(value);
};

const parseBool = (value) =>
  value === true || value === "true" || value === "1" || value === 1;

// products FormData me JSON string aata hai, JSON body me array — dono handle
const sanitizeProducts = (raw) => {
  let list = raw;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];

  const out = [];
  list.forEach((entry) => {
    const productId = toIdString(
      entry?.product || entry?.productId || entry?._id || entry
    );
    if (!productId || !/^[a-f\d]{24}$/i.test(productId)) return;

    const quantity = Math.max(1, Number(entry?.quantity) || 1);
    // ✅ Same product dobara aaya to quantity merge kar do
    const existing = out.find((p) => p.product === productId);
    if (existing) {
      existing.quantity += quantity;
      return;
    }
    out.push({ product: productId, quantity });
  });
  return out;
};

const validateBundle = ({ name, products, image, bundlePrice }) => {
  if (!String(name || "").trim()) return "Bundle name is required";
  if (!Array.isArray(products) || products.length < 2) {
    return "Please select at least 2 products for this bundle";
  }
  if (products.length > 20) return "A bundle can contain at most 20 products";
  if (!String(image || "").trim()) {
    return "Bundle image is required. Please upload a cover image.";
  }
  if (
    bundlePrice === "" ||
    bundlePrice === null ||
    bundlePrice === undefined ||
    !Number.isFinite(Number(bundlePrice))
  ) {
    return "Please enter a bundle price";
  }
  if (Number(bundlePrice) <= 0) return "Bundle price must be greater than 0";
  return null;
};

const productsExist = async (products) => {
  const ids = products.map((p) => p.product);
  const found = await Product.countDocuments({
    _id: { $in: ids },
    is_deleted: false,
  });
  return found === new Set(ids).size;
};

const removeBundleImageFolder = async (bundleId) => {
  try {
    const dir = path.join(IMAGE_FOLDER, String(bundleId));
    if (await fs.pathExists(dir)) await fs.remove(dir);
  } catch (_) {}
};

// Purani cover files hata do (nayi image save hone ke baad)
const cleanupOldCovers = async (bundleId, keepFileName) => {
  try {
    const dir = path.join(IMAGE_FOLDER, String(bundleId));
    if (!(await fs.pathExists(dir))) return;
    const files = await fs.readdir(dir);
    await Promise.all(
      files
        .filter((f) => f !== keepFileName)
        .map((f) => fs.remove(path.join(dir, f)))
    );
  } catch (_) {}
};

// ==========================================
// ✅ PRICING — individual products ka total (original) + savings
// Is project me product ki price Variant par hoti hai (Product me price nahi hai)
// ==========================================
const attachPricing = async (rawBundles) => {
  const list = (rawBundles || []).map((b) =>
    typeof b?.toObject === "function" ? b.toObject() : b
  );

  const productIds = new Set();
  list.forEach((b) =>
    (b.products || []).forEach((p) => {
      const pid = toIdString(p.product);
      if (pid) productIds.add(pid);
    })
  );

  const priceMap = new Map();
  if (productIds.size) {
    const variants = await Variant.find({ product_id: { $in: [...productIds] } })
      .select("product_id selling_price")
      .lean();

    variants.forEach((v) => {
      const pid = String(v.product_id);
      const price = Number(v.selling_price) || 0;
      const prev = priceMap.get(pid);
      if (prev === undefined) priceMap.set(pid, price);
      else if (prev <= 0 && price > 0) priceMap.set(pid, price);
      else if (price > 0 && price < prev) priceMap.set(pid, price);
    });
  }

  return list.map((b) => {
    const originalPrice = (b.products || []).reduce((sum, p) => {
      const pid = toIdString(p.product);
      const unitPrice = priceMap.get(pid) || 0;
      const quantity = Math.max(1, Number(p.quantity) || 1);
      return sum + unitPrice * quantity;
    }, 0);

    const bundlePrice = Number(b.bundlePrice) || 0;
    const savings = Math.max(0, originalPrice - bundlePrice);

    return {
      ...b,
      imageUrl: b.image ? `/${String(b.image).replace(/^\/+/, "")}` : "",
      originalPrice,
      savings,
      discountPercent:
        originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0,
      itemCount: (b.products || []).reduce(
        (sum, p) => sum + Math.max(1, Number(p.quantity) || 1),
        0
      ),
    };
  });
};

const handleError = (res, error, fallback) => {
  console.error(fallback, error);
  if (error?.name === "ValidationError") {
    const msg = Object.values(error.errors || {})
      .map((e) => e.message)
      .join(", ");
    return res
      .status(400)
      .json({ success: false, message: msg || "Validation failed" });
  }
  return res
    .status(500)
    .json({ success: false, message: error.message || fallback });
};

// ==========================================
// CREATE BUNDLE (admin)
// ==========================================
const createBundle = async (req, res) => {
  try {
    const products = sanitizeProducts(req.body.products);
    const name = String(req.body.name || "").trim();
    const image = req.bundleImage || "";
    const { bundlePrice } = req.body;

    const error = validateBundle({ name, products, image, bundlePrice });
    if (error) return res.status(400).json({ success: false, message: error });

    if (!(await productsExist(products))) {
      return res.status(400).json({
        success: false,
        message: "One or more selected products were not found",
      });
    }

    const bundle = await Bundle.create({
      // Middleware ne folder isi id se banaya hai (product images jaisa pattern)
      ...(req.bundleId ? { _id: req.bundleId } : {}),
      name,
      description: String(req.body.description || "").trim(),
      products,
      image,
      bundlePrice: Number(bundlePrice),
      isActive:
        req.body.isActive === undefined ? true : parseBool(req.body.isActive),
      createdby: req.user?._id || req.user?.id || null,
      updatedby: req.user?._id || req.user?.id || null,
    });

    const [data] = await attachPricing([bundle]);

    res.status(201).json({
      success: true,
      message: "Bundle created successfully",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to create bundle");
  }
};

// ==========================================
// GET ALL BUNDLES (admin)
// ✅ Agar ?limit= nahi bheja to full array (legacy mode)
// ==========================================
const getBundles = async (req, res) => {
  try {
    const { search = "", status = "all", page = 1, limit = 0 } = req.query;

    const filter = {};
    if (String(search).trim()) {
      filter.$or = [
        { name: { $regex: String(search).trim(), $options: "i" } },
        { description: { $regex: String(search).trim(), $options: "i" } },
      ];
    }
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum =
      Number.isFinite(Number(limit)) && Number(limit) > 0
        ? Math.min(Number(limit), 100)
        : 0;

    // ---- LEGACY MODE (no limit) → full array ----
    if (!limitNum) {
      const bundles = await Bundle.find(filter)
        .populate("products.product", "name sku")
        .sort({ createdAt: -1 })
        .lean();

      const data = await attachPricing(bundles);
      return res.status(200).json({ success: true, data, total: data.length });
    }

    // ---- PAGINATED MODE ----
    const total = await Bundle.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limitNum));
    const safePage = Math.min(pageNum, pages);

    const bundles = await Bundle.find(filter)
      .populate("products.product", "name sku")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const data = await attachPricing(bundles);

    res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page: safePage,
        limit: limitNum,
        pages,
        hasNext: safePage < pages,
        hasPrev: safePage > 1,
      },
    });
  } catch (error) {
    handleError(res, error, "Failed to fetch bundles");
  }
};

// ==========================================
// GET SINGLE BUNDLE (admin)
// ==========================================
const getBundleById = async (req, res) => {
  try {
    const bundle = await Bundle.findById(req.params.id).populate(
      "products.product",
      "name sku"
    );

    if (!bundle) {
      return res
        .status(404)
        .json({ success: false, message: "Bundle not found" });
    }

    const [data] = await attachPricing([bundle]);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Failed to fetch bundle");
  }
};

// ==========================================
// UPDATE BUNDLE (admin)
// ==========================================
const updateBundle = async (req, res) => {
  try {
    const { id } = req.params;

    const bundle = await Bundle.findById(id);
    if (!bundle) {
      return res
        .status(404)
        .json({ success: false, message: "Bundle not found" });
    }

    const products =
      req.body.products !== undefined
        ? sanitizeProducts(req.body.products)
        : bundle.products.map((p) => ({
            product: String(p.product),
            quantity: Math.max(1, Number(p.quantity) || 1),
          }));

    const name =
      req.body.name !== undefined ? String(req.body.name).trim() : bundle.name;
    const bundlePrice =
      req.body.bundlePrice !== undefined
        ? req.body.bundlePrice
        : bundle.bundlePrice;
    // Nayi image aayi to wo, warna purani hi rahegi
    const image = req.bundleImage || bundle.image;

    const error = validateBundle({ name, products, image, bundlePrice });
    if (error) return res.status(400).json({ success: false, message: error });

    if (!(await productsExist(products))) {
      return res.status(400).json({
        success: false,
        message: "One or more selected products were not found",
      });
    }

    bundle.name = name;
    if (req.body.description !== undefined) {
      bundle.description = String(req.body.description || "").trim();
    }
    bundle.products = products;
    bundle.bundlePrice = Number(bundlePrice);
    if (req.body.isActive !== undefined) {
      bundle.isActive = parseBool(req.body.isActive);
    }
    if (req.bundleImage) bundle.image = req.bundleImage;
    bundle.updatedby = req.user?._id || req.user?.id || null;

    await bundle.save();

    // Nayi image aayi to purani cover files delete kar do
    if (req.bundleImage) {
      await cleanupOldCovers(id, path.basename(req.bundleImage));
    }

    const [data] = await attachPricing([bundle]);

    res.status(200).json({
      success: true,
      message: "Bundle updated successfully",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to update bundle");
  }
};

// ==========================================
// DELETE BUNDLE (admin)
// ==========================================
const deleteBundle = async (req, res) => {
  try {
    const { id } = req.params;

    const bundle = await Bundle.findById(id);
    if (!bundle) {
      return res
        .status(404)
        .json({ success: false, message: "Bundle not found" });
    }

    await Bundle.findByIdAndDelete(id);
    await removeBundleImageFolder(id);

    res
      .status(200)
      .json({ success: true, message: "Bundle deleted successfully" });
  } catch (error) {
    handleError(res, error, "Failed to delete bundle");
  }
};

// ==========================================
// TOGGLE STATUS (admin)
// ==========================================
const toggleBundleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const bundle = await Bundle.findById(id);
    if (!bundle) {
      return res
        .status(404)
        .json({ success: false, message: "Bundle not found" });
    }

    bundle.isActive = !bundle.isActive;
    bundle.updatedby = req.user?._id || req.user?.id || null;
    await bundle.save();

    const [data] = await attachPricing([bundle]);

    res.status(200).json({
      success: true,
      message: data.isActive ? "Bundle activated" : "Bundle deactivated",
      data,
    });
  } catch (error) {
    handleError(res, error, "Failed to update bundle status");
  }
};

// ==========================================
// GET ACTIVE BUNDLES (PUBLIC — storefront)
// ✅ Agar ?limit= nahi bheja to full array
// ==========================================
const getActiveBundles = async (req, res) => {
  try {
    const limitRaw = parseInt(req.query.limit, 10);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 0;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const filter = { isActive: true };

    if (!limit) {
      const bundles = await Bundle.find(filter)
        .populate("products.product", "name sku")
        .sort({ createdAt: -1 })
        .lean();

      const data = await attachPricing(bundles);
      return res.status(200).json({ success: true, data });
    }

    const total = await Bundle.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);

    const bundles = await Bundle.find(filter)
      .populate("products.product", "name sku")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean();

    const data = await attachPricing(bundles);

    res.status(200).json({
      success: true,
      data,
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
    handleError(res, error, "Failed to fetch active bundles");
  }
};

module.exports = {
  createBundle,
  getBundles,
  getBundleById,
  updateBundle,
  deleteBundle,
  toggleBundleStatus,
  getActiveBundles,
};
