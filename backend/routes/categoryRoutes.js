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

const router = express.Router();

// ==========================================
// ✅ PUBLIC ROUTE — Bina login ke categories (User GUI ke liye)
// Ye route PEHLE declare karna zaroori hai warna "/" wala route pehle match ho jayega
// ==========================================
router.get("/public", async (req, res) => {
  try {
    const categories = await Category.find({ is_deleted: false })
      .select("name description parent_category_id category_type sort_order created_at")
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
// ✅ Server-side pagination: jab `page` / `limit` query param bheja jata hai to
// sirf us page ke categories return hote hain (+ counts / options / pagination).
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

const CATEGORY_LIST_SELECT =
  "name category_code description parent_category_id category_type is_active attributes sort_order created_at";

router.get("/admin/all", authMiddleware, async (req, res) => {
  try {
    const wantsPagination =
      req.query.page !== undefined || req.query.limit !== undefined;

    /* ---------- LEGACY: full list (attributes ke sath) ---------- */
    if (!wantsPagination) {
      const categories = await Category.find({ is_deleted: false })
        .select(CATEGORY_LIST_SELECT)
        .populate("attributes.attribute_id", "name code data_type values variant_allowed is_active")
        .sort({ created_at: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: categories,
        count: categories.length,
      });
    }

    /* ---------- SERVER SIDE PAGINATION ---------- */
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

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

    const [total, items, totalCategories, rootCategories, withAttributes, options] =
      await Promise.all([
        Category.countDocuments(filter),
        Category.find(filter)
          .select(CATEGORY_LIST_SELECT)
          .populate("attributes.attribute_id", "name code data_type values variant_allowed is_active")
          .sort({ [sortField]: sortOrder, _id: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Category.countDocuments(activeFilter),
        Category.countDocuments({ ...activeFilter, parent_category_id: null }),
        Category.countDocuments({ ...activeFilter, "attributes.0": { $exists: true } }),
        // ✅ Parent dropdown / parent name resolution ke liye lightweight full list
        Category.find(activeFilter)
          .select("name category_code parent_category_id")
          .sort({ sort_order: 1, name: 1 })
          .lean(),
      ]);

    const pages = Math.max(1, Math.ceil(total / limit));

    res.status(200).json({
      success: true,
      data: items,
      counts: {
        total: totalCategories,
        root: rootCategories,
        child: Math.max(0, totalCategories - rootCategories),
        withAttributes,
      },
      options,
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
router.post("/", authMiddleware, checkPermission("products"), createCategory);
router.put("/:id", authMiddleware, checkPermission("products"), updateCategory);
router.put("/:id/attributes", authMiddleware, checkPermission("products"), assignCategoryAttributes);
router.delete("/:id", authMiddleware, checkPermission("products"), deleteCategory);

module.exports = router;