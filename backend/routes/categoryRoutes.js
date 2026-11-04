const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const log = require("../utils/logger");

const {
  getNextCode,
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryAttributes,
  getCategoryAttributesHierarchical,
  assignCategoryAttributes,
} = require("../controllers/categoryController");

const Category = require("../models/Category");
const { publicCache, invalidate } = require("../utils/publicCache");

const router = express.Router();

// ✅ Admin mutation ke baad public cache drop (foran fresh)
// "products" bhi drop karna zaroori hai — category-tiles (`/api/products/category-tiles`)
// namespace `products` me cache hota hai, aur wahan bhi category list/counts aate hain.
// Bina iske tiles 60s tak purana dikhate rehte the.
const dropCategoriesCache = (req, res, next) => {
  invalidate(["categories", "products"]);
  next();
};

// ==========================================
// ✅ PUBLIC ROUTE — Bina login ke categories (User GUI ke liye)
// Ye route PEHLE declare karna zaroori hai warna "/" wala route pehle match ho jayega
// ✅ 60s memo (output same)
// ==========================================
router.get("/public", publicCache(60 * 1000), async (req, res) => {
  try {
    // ⚠️ `is_active` filter ZAROORI hai — admin me category deactivate karne par
    // wo storefront se gayab honi chahiye. Pehle sirf `is_deleted` filter tha,
    // is liye INACTIVE categories bhi public list me aa jati thi (user ne
    // deactivate karne ke baad bhi category nahi hat rahi thi).
    // Convention: baaki public endpoints bhi `is_active: true` use karte hain.
    const categories = await Category.find({ is_deleted: false, is_active: true })
      .select("name description parent_category_id category_type sort_order created_at translations")
      .sort({ sort_order: 1, name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    log.error("❌ Public categories fetch error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
});

// ==========================================
// ✅ FIX: /admin/all route — global mode (no tenant_id filter)
// ✅ Server-side pagination: only the requested page of category rows is returned.
// Bina param ke purana FULL list response hi milta hai, kyunke products page
// aur categories [id] page isi par depend karte hain.
// ==========================================
const CATEGORY_SORT_FIELDS = {
  code: "category_code",
  name: "name",
  created: "created_at",
};

// ✅ Search string ko safe regex banane ke liye (special chars se crash na ho)
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ⚠️ `translations` / `translation_source` / `translation_status` ZAROORI hain:
// frontend `nameOf()` / `descriptionOf()` inhi se localized value padhte hain.
// Inke bina projection ke category ka Urdu/Arabic text kabhi frontend tak
// pohnchta hi nahi (silent fallback to English).
const CATEGORY_LIST_SELECT =
  "name category_code description parent_category_id category_type is_active sort_order translations";

// Populated attribute ke liye bhi — attribute ka `name` translate hota hai,
// aur options ke labels `values[].label_translations` me hote hain.
const ATTRIBUTE_POPULATE_SELECT =
  "name code description data_type values variant_allowed is_active translations";

const selectedLocale = (value) => {
  const locale = String(value || "en").trim().toLowerCase();
  return /^[a-z]{2}$/.test(locale) ? locale : "en";
};

const categoryListItem = (category, locale) => {
  const translatedName = locale === "en" ? "" : category.translations?.name?.[locale];
  const translatedDescription = locale === "en" ? "" : category.translations?.description?.[locale];
  const parentDoc = category.parent_category_id && typeof category.parent_category_id === "object"
    ? category.parent_category_id
    : null;
  const parent = parentDoc ? {
    _id: parentDoc._id,
    name: parentDoc.name,
    category_code: parentDoc.category_code,
    ...(locale !== "en" && {
      translations: {
        name: parentDoc.translations?.name?.[locale]
          ? { [locale]: parentDoc.translations.name[locale] }
          : {},
      },
    }),
  } : category.parent_category_id;
  return {
    _id: category._id,
    name: category.name,
    category_code: category.category_code,
    description: category.description,
    ...(locale !== "en" && {
      translations: {
        name: translatedName ? { [locale]: translatedName } : {},
        description: translatedDescription ? { [locale]: translatedDescription } : {},
      },
    }),
    parent_category_id: parent,
    category_type: category.category_type,
    is_active: category.is_active,
    sort_order: category.sort_order,
  };
};

// Parent selectors load this compact collection only when needed. It is never
// repeated in every paginated category response.
router.get("/admin/options", authMiddleware, checkPermission("products"), async (req, res) => {
  try {
    const locale = selectedLocale(req.query.locale);
    const categories = await Category.find({ is_deleted: false })
      .select("name category_code parent_category_id translations")
      .sort({ sort_order: 1, name: 1 })
      .lean();
    const data = categories.map((category) => ({
      _id: category._id,
      name: category.name,
      category_code: category.category_code,
      parent_category_id: category.parent_category_id,
      ...(locale !== "en" && {
        translations: {
          name: category.translations?.name?.[locale]
            ? { [locale]: category.translations.name[locale] }
            : {},
        },
      }),
    }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    log.error("Error fetching category options:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch category options" });
  }
});

router.get("/admin/all", authMiddleware, async (req, res) => {
  try {
    const wantsPagination =
      req.query.page !== undefined || req.query.limit !== undefined;

    /* ---------- LEGACY: full list (attributes ke sath) ---------- */
    if (!wantsPagination) {
      const categories = await Category.find({ is_deleted: false })
        .select(CATEGORY_LIST_SELECT)
        .populate("attributes.attribute_id", ATTRIBUTE_POPULATE_SELECT)
        .sort({ created_at: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: categories,
        count: categories.length,
      });
    }

    /* ---------- SERVER SIDE PAGINATION ---------- */
    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const locale = selectedLocale(req.query.locale);

    const search = String(req.query.search || "").trim();
    const parent = String(req.query.parent || "all").trim().toLowerCase();

    const filter = { is_deleted: false };

    // ✅ Search: category name ya category code
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: rx }, { category_code: rx }];
    }

    // ✅ Parent filter — root (koi parent nahi) / child (parent mojood)
    if (parent === "root") filter.parent_category_id = null;
    else if (parent === "child") filter.parent_category_id = { $ne: null };

    // ✅ Sorting bhi server par
    const sortKeyRaw = String(req.query.sort || "").trim();
    const hasSort = Boolean(CATEGORY_SORT_FIELDS[sortKeyRaw]);
    const sortField = hasSort ? CATEGORY_SORT_FIELDS[sortKeyRaw] : "created_at";
    const rawOrder = String(req.query.order || "").trim().toLowerCase();
    const sortOrder = hasSort
      ? (rawOrder === "desc" ? -1 : 1)
      : (rawOrder === "asc" ? 1 : -1);

    const activeFilter = { is_deleted: false };
    const total = await Category.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, pages);

    const [items, totalCategories, rootCategories, withAttributes] = await Promise.all([
      Category.find(filter)
        .select(CATEGORY_LIST_SELECT)
        .populate("parent_category_id", "name category_code translations")
        .sort({ [sortField]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Category.countDocuments(activeFilter),
      Category.countDocuments({ ...activeFilter, parent_category_id: null }),
      Category.countDocuments({ ...activeFilter, "attributes.0": { $exists: true } }),
    ]);
    const pageItems = items.map((item) => categoryListItem(item, locale));

    res.status(200).json({
      success: true,
      data: pageItems,
      counts: {
        total: totalCategories,
        root: rootCategories,
        child: Math.max(0, totalCategories - rootCategories),
        withAttributes,
      },
      pagination: {
        total,
        page,
        limit,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    log.error("Error fetching admin categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category tree",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
});

// ==========================================
// EXISTING ROUTES (Preserved — Admin-only)
// ==========================================
router.get("/next-code", authMiddleware, checkPermission("products"), getNextCode);
router.get("/", authMiddleware, checkPermission("products"), getCategories);
router.get("/:id", authMiddleware, checkPermission("products"), getCategoryById);
router.get("/:id/attributes", authMiddleware, checkPermission("products"), getCategoryAttributes);
router.get("/:id/attributes-hierarchy", authMiddleware, checkPermission("products"), getCategoryAttributesHierarchical);
router.post("/", authMiddleware, checkPermission("products"), dropCategoriesCache, createCategory);
router.put("/:id", authMiddleware, checkPermission("products"), dropCategoriesCache, updateCategory);
router.put("/:id/attributes", authMiddleware, checkPermission("products"), dropCategoriesCache, assignCategoryAttributes);
router.delete("/:id", authMiddleware, checkPermission("products"), dropCategoriesCache, deleteCategory);

module.exports = router;
