const Brand = require("../models/Brand");
const Product = require("../models/Product");
const fs = require("fs-extra");
const { getIO } = require("../utils/socket");
const { emitSocketEvent } = require("../utils/emitSocketEvent");
const { escapeRegex } = require("../utils/escapeRegex");
const log = require("../utils/logger");
const { countProductsUsingBrand } = require("../services/referentialCleanup");
const { withoutProtected } = require("../utils/sanitizeBody"); // mass assignment guard
const { pushGlobalActivity, getChanges } = require("../utils/activityHelper");
const { queueTranslationSync } = require("../utils/translationService");
const { nextSeq, peekSeq, formatNumber, maxNumericSuffix } = require("../utils/counter");

// ==========================================
// SOCKET — shared emitSocketEvent util (optimizeplan §8.2)
// ==========================================

// ================================
// GET NEXT BRAND CODE
// ================================
const brandSeed = () => maxNumericSuffix(Brand, "brand_code", /^BRD-\d+$/);

// Atomic per-store brand codes (optimizeplan §3.2) — BRD-009 → BRD-010, no race.
const generateNextBrandCode = async () =>
  formatNumber("BRD-", await nextSeq("brand", { seed: brandSeed }), 3);

const previewNextBrandCode = async () =>
  formatNumber("BRD-", await peekSeq("brand", { seed: brandSeed }), 3);

// ✅ Ensures the stored value is always a clean "BRD-###"-style string.
// Never allows objects / "[object Object]" / undefined / null through.
const normalizeBrandCode = (value) => {
  if (typeof value !== "string") return "";
  const cleaned = value.trim();
  if (
    !cleaned ||
    cleaned === "[object Object]" ||
    cleaned.toLowerCase() === "undefined" ||
    cleaned.toLowerCase() === "null"
  ) {
    return "";
  }
  return cleaned;
};

const getNextBrandCode = async (req, res) => {
  try {
    const nextCode = await previewNextBrandCode();
    res.status(200).json({ success: true, data: { nextCode } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ================================
// CREATE BRAND
// ================================
const createBrand = async (req, res) => {
  try {

    // ✅ Sanitize incoming brand_code; auto-generate when missing/invalid
    const incomingCode = normalizeBrandCode(req.body?.brand_code);
    const brand_code = incomingCode || (await generateNextBrandCode());

    if (incomingCode) {
      const existing = await Brand.findOne({
        brand_code,
        is_deleted: false,
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Active brand with this code already exists",
        });
      }
    }

    const brandData = {
      ...withoutProtected(req.body),
      brand_code,
      createdby: req.user?._id || null,
      updatedby: null,
    };

    if (req.brandId) brandData._id = req.brandId;
    if (req.brandImage) brandData.logo = req.brandImage;

    const brand = await Brand.create(brandData);

    // 🌍 Urdu + Arabic translation background me generate (response block nahi hota)
    queueTranslationSync(Brand, brand._id);

    const updatedBrand = await Brand.findById(brand._id)
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    // ✅ LOG ACTIVITY (fire-and-forget — response iska wait nahi karta,
    // warna har create par saare staff users ki activity arrays rewrite hone
    // tak "Saving..." atka rehta tha)
    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    void pushGlobalActivity(io, {
      action: `${performerName} created brand "${updatedBrand.brand_name || updatedBrand.name}"`,
      category: "Brand Management",
      performedBy: performerId,
      performedByName: performerName,
      details: {
        brandId: updatedBrand._id,
        brandCode: updatedBrand.brand_code,
        brandName: updatedBrand.brand_name || updatedBrand.name,
      },
    }, performerId).catch(() => {});

    emitSocketEvent("brandCreated", updatedBrand.toObject());

    res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: { ...updatedBrand.toObject(), products: [] },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This Brand Code already exists. Please use a different code.",
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// ================================
// GET SINGLE BRAND
// ================================
const getBrandById = async (req, res) => {
  try {
    const requestedLocale = String(req.query.locale || "en").trim().toLowerCase();
    const locale = /^[a-z]{2}$/.test(requestedLocale) ? requestedLocale : "en";
    // Public route — no creator/updater emails (optimizeplan.md §2.1)
    const brand = await Brand.findOne({ _id: req.params.id, is_deleted: false })
      .select("brand_code name description translations logo country is_active created_at updated_at")
      .lean();

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    const nameTranslation = locale === "en" ? "" : brand.translations?.name?.[locale];
    const descriptionTranslation = locale === "en" ? "" : brand.translations?.description?.[locale];
    const responseBrand = {
      _id: brand._id,
      brand_code: brand.brand_code,
      name: brand.name,
      description: brand.description,
      ...(locale !== "en" && {
        translations: {
          name: nameTranslation ? { [locale]: nameTranslation } : {},
          description: descriptionTranslation ? { [locale]: descriptionTranslation } : {},
        },
      }),
      logo: brand.logo?.img_url ? { img_url: brand.logo.img_url, img_size: brand.logo.img_size } : null,
      country: brand.country,
      is_active: brand.is_active,
      created_at: brand.created_at,
      updated_at: brand.updated_at,
    };

    res.status(200).json({
      success: true,
      data: responseBrand,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ================================
// GET BRAND WITH PRODUCTS
// ================================
const getBrandWithProducts = async (req, res) => {
  try {
    const requestedLocale = String(req.query.locale || "en").trim().toLowerCase();
    const locale = /^[a-z]{2}$/.test(requestedLocale) ? requestedLocale : "en";
    // Public route — no creator/updater emails (optimizeplan.md §2.1)
    const brand = await Brand.findOne({ _id: req.params.id, is_deleted: false })
      .select("brand_code name description translations logo country is_active created_at updated_at")
      .lean();

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    const products = await Product.find({ brand_id: brand._id, is_deleted: { $ne: true }, status: "active" })
      .select("name description status category_id translations")
      .populate("category_id", "name translations")
      .lean();

    const nameTranslation = locale === "en" ? "" : brand.translations?.name?.[locale];
    const descriptionTranslation = locale === "en" ? "" : brand.translations?.description?.[locale];
    const responseBrand = {
      _id: brand._id,
      brand_code: brand.brand_code,
      name: brand.name,
      description: brand.description,
      ...(locale !== "en" && {
        translations: {
          name: nameTranslation ? { [locale]: nameTranslation } : {},
          description: descriptionTranslation ? { [locale]: descriptionTranslation } : {},
        },
      }),
      logo: brand.logo?.img_url ? { img_url: brand.logo.img_url, img_size: brand.logo.img_size } : null,
      country: brand.country,
      is_active: brand.is_active,
      created_at: brand.created_at,
      updated_at: brand.updated_at,
    };

    res.status(200).json({
      success: true,
      data: { ...responseBrand, products },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ================================
// UPDATE BRAND
// ================================
const updateBrand = async (req, res) => {
  try {
    const existingBrand = await Brand.findOne({ _id: req.params.id, is_deleted: false });

    if (!existingBrand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    const updateData = {
      ...withoutProtected(req.body),
      updatedby: req.user?._id || null,
    };

    // ✅ Never overwrite a brand_code with junk ("[object Object]", etc.)
    const normalizedCode = normalizeBrandCode(req.body?.brand_code);
    if (!normalizedCode) {
      updateData.brand_code = existingBrand.brand_code;
    } else {
      updateData.brand_code = normalizedCode;
    }

    let oldImgUrlToRemove = "";
    if (req.brandImage) {
      // ⚠️ Purana FOLDER delete mat karo — middleware (imageMiddleware.js:21) ne nayi
      // image isi brand folder me hi likhi hai. Purani FILE ab DB save ke BAAD delete hogi
      // (§5.6 delete-after-write) — save fail ho to purani image bachi rehti hai.
      oldImgUrlToRemove = existingBrand.logo?.img_url || "";
      updateData.logo = req.brandImage;
      if (updateData.logo.img_url) {
        // Purana (uploads/brands/<id>/) aur naya (uploads/stores/<storeId>/brands/<id>/) dono
        updateData.logo.img_url = updateData.logo.img_url.replace(
          /(uploads\/(?:stores\/[^/]+\/)?brands\/)[^/]+\//,
          `$1${existingBrand._id}/`
        );
      }
    }

    // Track changes
    const trackedFields = ["brand_name", "name", "brand_code", "description", "country", "status"];
    const changes = getChanges(existingBrand.toObject(), updateData, trackedFields);

    const brand = await Brand.findByIdAndUpdate(req.params.id, updateData, { returnDocument: "after" })
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    // ✅ DB save kamyab — ab purani logo file hatao (best-effort, sirf isi store ki)
    if (oldImgUrlToRemove && oldImgUrlToRemove.startsWith("uploads/")) {
      try {
        const oldFilePath = require("../utils/uploadPaths").localPathForUrl(req, oldImgUrlToRemove);
        if (oldFilePath && (await fs.pathExists(oldFilePath))) await fs.remove(oldFilePath);
      } catch (_) { /* orphan file reh jana delete fail se behtar */ }
    }

    // 🌍 English change → hash badla → translation dobara generate hogi.
    // Translation wahi rakhi jayegi jo abhi tak valid thi, is liye user ko
    // turant fallback dikhta hai aur koi data loss nahi hota.
    queueTranslationSync(Brand, brand._id);

    const products = await Product.find({ brand_id: brand._id })
      .populate("category_id", "name translations")
      .select("name brand_id category_id status created_at");

    // ✅ LOG ACTIVITY (fire-and-forget — response wait nahi karta)
    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    const changedFields = changes.map((c) => c.field).join(", ");
    const actionMsg = changes.length > 0
      ? `${performerName} updated ${changedFields} for brand "${brand.brand_name || brand.name}"`
      : `${performerName} updated brand "${brand.brand_name || brand.name}"`;

    void pushGlobalActivity(io, {
      action: actionMsg,
      category: "Brand Management",
      performedBy: performerId,
      performedByName: performerName,
      details: { changes, brandId: brand._id },
    }, performerId).catch(() => {});

    emitSocketEvent("brandUpdated", brand.toObject());

    res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: { ...brand.toObject(), products },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This Brand Code already exists. Please use a different code.",
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// ================================
// SOFT DELETE BRAND
// ================================
const deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findOne({ _id: req.params.id, is_deleted: false });

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found or already deleted" });
    }

    // ✅ Products abhi is brand ko use kar rahe hon to delete block (§3.7)
    const inUse = await countProductsUsingBrand(brand._id);
    if (inUse > 0) {
      return res.status(409).json({
        success: false,
        message: `Brand is used by ${inUse} product(s). Reassign them first.`,
      });
    }

    await brand.softDelete(req.user._id);

    // ✅ LOG ACTIVITY (fire-and-forget — response wait nahi karta)
    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    void pushGlobalActivity(io, {
      action: `${performerName} deleted brand "${brand.brand_name || brand.name}"`,
      category: "Brand Management",
      performedBy: performerId,
      performedByName: performerName,
      details: { brandId: brand._id, brandCode: brand.brand_code },
    }, performerId).catch(() => {});

    emitSocketEvent("brandDeleted", { _id: brand._id.toString() });

    res.status(200).json({
      success: true,
      message: "Brand soft deleted successfully",
      data: { _id: brand._id, deleted_at: brand.deleted_at },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
// ==========================================
// 🌐 GET BRANDS — PUBLIC (light)
// ==========================================
const getBrandsPublic = async (req, res) => {
  try {
    // Storefront needs translations alongside the brand name so the active
    // locale can be rendered without a second request.
    const slim = req.query.slim === "1";
    // ⚠️ is_active filter zaroori — admin me brand deactivate karne par
    // wo storefront se gayab hona chahiye
    const brands = await Brand.find({ is_deleted: false, is_active: true })
      .select(slim ? "_id name translations logo.img_url" : "brand_code name translations logo country is_active")
      .sort({ created_at: -1 })
      .lean()
      .exec();
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ==========================================
// 🛡️ GET BRANDS — ADMIN
// ==========================================
// ✅ Server-side pagination: jab `page` ya `limit` query param bheja jata hai
// to sirf usi page ke brands return hote hain (+ counts / countries /
// pagination meta). Bina param ke purana FULL list response hi milta hai,
// kyunke products / deals / banners / discounts pages aur user GUI isi
// `brandApi.getAll` par depend karte hain.
const BRAND_SORT_FIELDS = {
  code: "brand_code",
  name: "name",
  country: "country",
  status: "is_active",
  created: "created_at",
};

// ✅ Search string ko safe regex banane ke liye (special chars se crash na ho)

const getBrandsAdmin = async (req, res) => {
  try {
    const wantsPagination =
      req.query.page !== undefined || req.query.limit !== undefined;

    /* ---------- LEGACY: full list (with products) ---------- */
    if (!wantsPagination) {
      // Legacy full list — hard-capped; prefer /brands/admin/options for dropdowns (§9.3)
      const { legacyCap } = require("../utils/legacyListCap");
      const brands = await Brand.find({ is_deleted: false })
        .sort({ created_at: -1 })
        .limit(legacyCap(0, 50))
        .lean();

      const brandIds = brands.map((b) => b._id);
      const countRows = brandIds.length
        ? await Product.aggregate([
          { $match: { brand_id: { $in: brandIds }, is_deleted: { $ne: true } } },
          { $group: { _id: "$brand_id", productCount: { $sum: 1 } } },
        ])
        : [];
      const countMap = new Map(countRows.map((r) => [String(r._id), Number(r.productCount) || 0]));
      const brandsWithCounts = brands.map((brand) => ({
        ...brand,
        productCount: countMap.get(String(brand._id)) || 0,
        products: [],
      }));
      return res.status(200).json({ success: true, data: brandsWithCounts });
    }

    /* ---------- SERVER SIDE PAGINATION ---------- */
    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all").trim().toLowerCase();
    const country = String(req.query.country || "").trim();
    const requestedLocale = String(req.query.locale || "en").trim().toLowerCase();
    const locale = /^[a-z]{2}$/.test(requestedLocale) ? requestedLocale : "en";

    const filter = { is_deleted: false };

    // ✅ Search: brand name ya brand code
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: rx }, { brand_code: rx }];
    }

    if (status === "active") filter.is_active = true;
    else if (status === "inactive") filter.is_active = false;

    if (country && country.toLowerCase() !== "all") filter.country = country;

    // ✅ Sorting bhi server par hoti hai
    const sortKeyRaw = String(req.query.sort || "").trim();
    const hasSort = Boolean(BRAND_SORT_FIELDS[sortKeyRaw]);
    const sortField = hasSort ? BRAND_SORT_FIELDS[sortKeyRaw] : "created_at";
    const rawOrder = String(req.query.order || "").trim().toLowerCase();
    const sortOrder = hasSort
      ? (rawOrder === "desc" ? -1 : 1)
      : (rawOrder === "asc" ? 1 : -1);

    const activeFilter = { is_deleted: false };

    const total = await Brand.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, pages);

    const [brands, totalBrands, activeBrands, withLogo, countryList] =
      await Promise.all([
        Brand.find(filter)
          .sort({ [sortField]: sortOrder, _id: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate("createdby", "name email")
          .populate("updatedby", "name email")
          .lean(),
        Brand.countDocuments(activeFilter),
        Brand.countDocuments({ ...activeFilter, is_active: true }),
        Brand.countDocuments({ ...activeFilter, "logo.img_url": { $nin: ["", null] } }),
        Brand.distinct("country", activeFilter),
      ]);

    // Return only the currently selected translation to the paginated admin
    // screen. This keeps the page payload language-specific and avoids exposing
    // mixed locale values in its row data.
    const pageIds = brands.map((b) => b._id);
    const countRows = pageIds.length
      ? await Product.aggregate([
        { $match: { brand_id: { $in: pageIds }, is_deleted: { $ne: true } } },
        { $group: { _id: "$brand_id", productCount: { $sum: 1 } } },
      ])
      : [];
    const countMap = new Map(countRows.map((r) => [String(r._id), Number(r.productCount) || 0]));

    const pageBrands = brands.map((brand) => {
      const nameTranslation = locale === "en" ? "" : brand.translations?.name?.[locale];
      const descriptionTranslation = locale === "en" ? "" : brand.translations?.description?.[locale];
      return {
        _id: brand._id,
        brand_code: brand.brand_code,
        name: brand.name,
        description: brand.description,
        productCount: countMap.get(String(brand._id)) || 0,
        ...(locale !== "en" && {
          translations: {
            name: nameTranslation ? { [locale]: nameTranslation } : {},
            description: descriptionTranslation ? { [locale]: descriptionTranslation } : {},
          },
        }),
        logo: brand.logo?.img_url ? { img_url: brand.logo.img_url } : null,
        country: brand.country,
        is_active: brand.is_active,
      };
    });

    res.status(200).json({
      success: true,
      data: pageBrands,
      counts: {
        total: totalBrands,
        active: activeBrands,
        inactive: Math.max(0, totalBrands - activeBrands),
        withLogo,
      },
      countries: (countryList || [])
        .filter(Boolean)
        .map((c) => String(c))
        .sort((a, b) => a.localeCompare(b)),
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
    res.status(400).json({ success: false, message: error.message });
  }
};
// Dropdown / picker — no N+1 product load (§9.3)
const getBrandOptions = async (req, res) => {
  try {
    const requestedLocale = String(req.query.locale || "en").trim().toLowerCase();
    const locale = /^[a-z]{2}$/.test(requestedLocale) ? requestedLocale : "en";
    const search = String(req.query.search || "").trim();
    const { legacyCap } = require("../utils/legacyListCap");
    const limit = legacyCap(req.query.limit, 50);
    const filter = { is_deleted: false, is_active: { $ne: false } };
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: rx }, { brand_code: rx }];
    }
    const brands = await Brand.find(filter)
      .select("name brand_code translations.name")
      .sort({ name: 1 })
      .limit(limit)
      .lean();
    const data = brands.map((brand) => ({
      _id: brand._id,
      name: brand.name,
      brand_code: brand.brand_code,
      ...(locale !== "en" && {
        translations: {
          name: brand.translations?.name?.[locale] ? { [locale]: brand.translations.name[locale] } : {},
        },
      }),
    }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch brand options" });
  }
};

module.exports = {
  getNextBrandCode,
  createBrand,
  getBrandsPublic,
  getBrandsAdmin,
  getBrandOptions,
  getBrandById,
  getBrandWithProducts,
  updateBrand,
  deleteBrand,
};

