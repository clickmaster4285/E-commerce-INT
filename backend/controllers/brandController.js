const Brand = require("../models/brand");
const Product = require("../models/Product");
const path = require("path");
const fs = require("fs-extra");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity, getChanges } = require("../utils/activityHelper");

// ================================
// GET NEXT BRAND CODE
// ================================
const getNextBrandCode = async (req, res) => {
  try {
    const lastBrand = await Brand.findOne({
      brand_code: { $regex: /^BRD-\d+$/ },
      is_deleted: false,
    })
      .sort({ brand_code: -1 })
      .select("brand_code");

    let nextNumber = 1;
    if (lastBrand && lastBrand.brand_code) {
      const lastNum = parseInt(lastBrand.brand_code.split("-")[1], 10);
      if (!isNaN(lastNum)) nextNumber = lastNum + 1;
    }

    const nextCode = `BRD-${String(nextNumber).padStart(3, "0")}`;
    res.status(200).json({ success: true, data: { nextCode } });
  } catch (error) {
    console.log("❌ Get next brand code error:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ================================
// CREATE BRAND
// ================================
const createBrand = async (req, res) => {
  try {
    console.log("========== CREATE BRAND ==========");

    if (req.body.brand_code) {
      const existing = await Brand.findOne({
        brand_code: req.body.brand_code,
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
      createdby: req.user?._id || null,
      updatedby: req.user?._id || null,
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
      console.log("⚠️ Socket emit skipped:", socketErr.message);
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
    console.log("❌ Create error:", error.message);
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
    console.log("❌ Get brands error:", error.message);
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
    console.log("❌ Get brand by id error:", error.message);
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
    console.log("❌ Get brand with products error:", error.message);
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

    if (req.brandImage) {
      if (existingBrand.logo?.img_url) {
        const oldFolderPath = path.join(__dirname, "../uploads/brands", existingBrand._id.toString());
        if (await fs.pathExists(oldFolderPath)) {
          await fs.remove(oldFolderPath);
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
      console.log("⚠️ Socket emit skipped:", socketErr.message);
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
    console.log("❌ Update error:", error.message);
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

    console.log("========== SOFT DELETE BRAND ==========");

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
      console.log("⚠️ Socket emit skipped:", socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: "Brand soft deleted successfully",
      data: { _id: brand._id, deleted_at: brand.deleted_at },
    });
  } catch (error) {
    console.log("❌ Soft delete error:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};
// ==========================================
// 🌐 GET BRANDS — PUBLIC (light)
// ==========================================
const getBrandsPublic = async (req, res) => {
  try {
    const brands = await Brand.find({ is_deleted: false })
      .select("brand_code name logo country is_active")
      .sort({ created_at: -1 })
      .lean()
      .exec();
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ==========================================
// 🛡️ GET BRANDS — ADMIN (full with products)
// ==========================================
const getBrandsAdmin = async (req, res) => {
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