const Brand = require("../models/brand");
const Product = require("../models/Product");
const path = require("path");
const fs = require("fs-extra");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity, getChanges } = require("../utils/activityHelper");

// ================================
// GET NEXT BRAND CODE
// ================================
// ✅ Always finds the HIGHEST existing numeric Brand Code (BRD-###) in the
// database (active + soft deleted) and adds +1. Numeric comparison is used,
// so BRD-009 -> BRD-010, BRD-099 -> BRD-100, BRD-999 -> BRD-1000 etc.
const generateNextBrandCode = async () => {
  const brands = await Brand.find({ brand_code: { $regex: /^BRD-\d+$/ } })
    .select("brand_code")
    .lean();

  let maxNum = 0;
  for (const brand of brands) {
    const num = parseInt(String(brand.brand_code).split("-")[1], 10);
    if (Number.isFinite(num) && num > maxNum) maxNum = num;
  }

  return `BRD-${String(maxNum + 1).padStart(3, "0")}`;
};

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
    const nextCode = await generateNextBrandCode();
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
      ...req.body,
      brand_code,
      createdby: req.user?._id || null,
      updatedby: null,
    };

    if (req.brandImage) brandData.logo = req.brandImage;

    const brand = await Brand.create(brandData);

    if (req.tempBrandFolder && req.tempBrandFolder.startsWith("temp_")) {
      const oldFolderPath = path.join(__dirname, "../uploads/brands", req.tempBrandFolder);
      const newFolderPath = path.join(__dirname, "../uploads/brands", brand._id.toString());

      if (await fs.pathExists(oldFolderPath)) {
        await fs.rename(oldFolderPath, newFolderPath);
        const oldImgUrl = brand.logo?.img_url || "";
        const newImgUrl = oldImgUrl.replace(req.tempBrandFolder, brand._id.toString());
        await Brand.findByIdAndUpdate(brand._id, { "logo.img_url": newImgUrl });
      }
    }

    const updatedBrand = await Brand.findById(brand._id)
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    // ✅ LOG ACTIVITY
    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    await pushGlobalActivity(io, {
      action: `${performerName} created brand "${updatedBrand.brand_name || updatedBrand.name}"`,
      category: "Brand Management",
      performedBy: performerId,
      performedByName: performerName,
      details: {
        brandCode: updatedBrand.brand_code,
        brandName: updatedBrand.brand_name || updatedBrand.name,
      },
    }, performerId);

    try {
      io.emit("brandCreated", updatedBrand.toObject());
    } catch (socketErr) {
    }

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
// GET ALL BRANDS
// ================================
const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ is_deleted: false })
      .sort({ created_at: -1 })
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    const brandsWithProducts = await Promise.all(
      brands.map(async (brand) => {
        const products = await Product.find({ brand_id: brand._id })
          .populate("category_id", "name")
          .select("name brand_id category_id status created_at");
        return { ...brand.toObject(), products };
      })
    );

    res.status(200).json({ success: true, data: brandsWithProducts });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ================================
// GET SINGLE BRAND
// ================================
const getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findOne({ _id: req.params.id, is_deleted: false })
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    const products = await Product.find({ brand_id: brand._id })
      .populate("category_id", "name")
      .select("name brand_id category_id status created_at");

    res.status(200).json({
      success: true,
      data: { ...brand.toObject(), products },
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
    const brand = await Brand.findOne({ _id: req.params.id, is_deleted: false })
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    const products = await Product.find({ brand_id: brand._id })
      .populate("category_id", "name")
      .select("name brand_id category_id status created_at");

    res.status(200).json({
      success: true,
      data: { ...brand.toObject(), products },
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
      ...req.body,
      updatedby: req.user?._id || null,
    };

    // ✅ Never overwrite a brand_code with junk ("[object Object]", etc.)
    const normalizedCode = normalizeBrandCode(req.body?.brand_code);
    if (!normalizedCode) {
      updateData.brand_code = existingBrand.brand_code;
    } else {
      updateData.brand_code = normalizedCode;
    }

    if (req.brandImage) {
      // ⚠️ Purana FOLDER delete mat karo — middleware (imageMiddleware.js:21) ne nayi
      // image isi brand folder me hi likhi hai (brandId = req.params.id). Folder delete
      // karne se nayi image bhi mit jati thi aur logo 404 ho jata tha.
      // Sirf purani FILE delete karo (tabhi jab wo local upload ho).
      const oldImgUrl = existingBrand.logo?.img_url || "";
      if (oldImgUrl && oldImgUrl.startsWith("uploads/")) {
        const oldFilePath = path.join(__dirname, "..", oldImgUrl);
        if (await fs.pathExists(oldFilePath)) {
          await fs.remove(oldFilePath);
        }
      }
      updateData.logo = req.brandImage;
      if (updateData.logo.img_url) {
        updateData.logo.img_url = updateData.logo.img_url.replace(
          /uploads\/brands\/[^/]+\//,
          `uploads/brands/${existingBrand._id}/`
        );
      }
    }

    // Track changes
    const trackedFields = ["brand_name", "name", "brand_code", "description", "country", "status"];
    const changes = getChanges(existingBrand.toObject(), updateData, trackedFields);

    const brand = await Brand.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    const products = await Product.find({ brand_id: brand._id })
      .populate("category_id", "name")
      .select("name brand_id category_id status created_at");

    // ✅ LOG ACTIVITY
    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    const changedFields = changes.map((c) => c.field).join(", ");
    const actionMsg = changes.length > 0
      ? `${performerName} updated ${changedFields} for brand "${brand.brand_name || brand.name}"`
      : `${performerName} updated brand "${brand.brand_name || brand.name}"`;

    await pushGlobalActivity(io, {
      action: actionMsg,
      category: "Brand Management",
      performedBy: performerId,
      performedByName: performerName,
      details: { changes, brandId: brand._id },
    }, performerId);

    try {
      io.emit("brandUpdated", brand.toObject());
    } catch (socketErr) {
    }

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


    await brand.softDelete(req.user._id);

    // ✅ LOG ACTIVITY
    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    await pushGlobalActivity(io, {
      action: `${performerName} deleted brand "${brand.brand_name || brand.name}"`,
      category: "Brand Management",
      performedBy: performerId,
      performedByName: performerName,
      details: { brandId: brand._id, brandCode: brand.brand_code },
    }, performerId);

    try {
      io.emit("brandDeleted", { _id: brand._id.toString() });
    } catch (socketErr) {
    }

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
    // ✅ slim=1 (opt-in, storefront): _id/name/logo hi chahiye hota hai
    // (brand_code/country/is_active sirf admin padhta hai). Default same.
    const slim = req.query.slim === "1";
    const brands = await Brand.find({ is_deleted: false })
      .select(slim ? "_id name logo.img_url" : "brand_code name logo country is_active")
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
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getBrandsAdmin = async (req, res) => {
  try {
    const wantsPagination =
      req.query.page !== undefined || req.query.limit !== undefined;

    /* ---------- LEGACY: full list (with products) ---------- */
    if (!wantsPagination) {
      const brands = await Brand.find({ is_deleted: false })
        .sort({ created_at: -1 })
        .populate("createdby", "name email")
        .populate("updatedby", "name email");

      const brandsWithProducts = await Promise.all(
        brands.map(async (brand) => {
          const products = await Product.find({ brand_id: brand._id })
            .populate("category_id", "name")
            .select("name brand_id category_id status created_at");
          return { ...brand.toObject(), products };
        })
      );
      return res.status(200).json({ success: true, data: brandsWithProducts });
    }

    /* ---------- SERVER SIDE PAGINATION ---------- */
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all").trim().toLowerCase();
    const country = String(req.query.country || "").trim();

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

    const [total, brands, totalBrands, activeBrands, withLogo, countryList] =
      await Promise.all([
        Brand.countDocuments(filter),
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

    const pages = Math.max(1, Math.ceil(total / limit));

    res.status(200).json({
      success: true,
      data: brands,
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
module.exports = {
  getNextBrandCode,
  createBrand,
  getBrands,
  getBrandsPublic,
  getBrandsAdmin,
  getBrandById,
  getBrandWithProducts,
  updateBrand,
  deleteBrand,
};  