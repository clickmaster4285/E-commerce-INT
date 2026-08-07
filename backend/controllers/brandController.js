const Brand = require("../models/brand");
const Product = require("../models/Product"); // ✅ Capital P
const path = require("path");
const fs = require("fs-extra");
const { getIO } = require("../utils/socket"); // ✅ SOCKET IMPORT ADDED

// ================================
// GET NEXT BRAND CODE
// ================================
const getNextBrandCode = async (req, res) => {
  try {
    // ✅ Sirf active brands mein se last code nikalein
    const lastBrand = await Brand.findOne({
      brand_code: { $regex: /^BRD-\d+$/ },
      is_deleted: false,
    })
      .sort({ brand_code: -1 })
      .select("brand_code");

    let nextNumber = 1;

    if (lastBrand && lastBrand.brand_code) {
      const lastNum = parseInt(lastBrand.brand_code.split("-")[1], 10);
      if (!isNaN(lastNum)) {
        nextNumber = lastNum + 1;
      }
    }

    const nextCode = `BRD-${String(nextNumber).padStart(3, "0")}`;

    res.status(200).json({
      success: true,
      data: { nextCode },
    });
  } catch (error) {
    console.log("❌ Get next brand code error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ================================
// CREATE BRAND
// ================================
const createBrand = async (req, res) => {
  try {
    console.log("========== CREATE BRAND ==========");

    // ✅ Check: same brand_code active brand pehle se na ho
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

    if (req.brandImage) {
      brandData.logo = req.brandImage;
    }

    const brand = await Brand.create(brandData);

    if (req.tempBrandFolder && req.tempBrandFolder.startsWith("temp_")) {
      const oldFolderPath = path.join(
        __dirname,
        "../uploads/brands",
        req.tempBrandFolder
      );

      const newFolderPath = path.join(
        __dirname,
        "../uploads/brands",
        brand._id.toString()
      );

      if (await fs.pathExists(oldFolderPath)) {
        await fs.rename(oldFolderPath, newFolderPath);
        console.log(`📁 Folder renamed: ${req.tempBrandFolder} → ${brand._id}`);

        const oldImgUrl = brand.logo?.img_url || "";
        const newImgUrl = oldImgUrl.replace(req.tempBrandFolder, brand._id.toString());

        await Brand.findByIdAndUpdate(brand._id, {
          "logo.img_url": newImgUrl,
        });

        console.log(`🔄 Logo URL updated: ${newImgUrl}`);
      }
    }

    const updatedBrand = await Brand.findById(brand._id)
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    // ✅ SOCKET EMIT - Brand Created
    try {
      const io = getIO();
      io.emit("brandCreated", updatedBrand.toObject());
    } catch (socketErr) {
      console.log("⚠️ Socket emit skipped:", socketErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: {
        ...updatedBrand.toObject(),
        products: [],
      },
    });
  } catch (error) {
    // ✅ Duplicate Key Error (11000) ko handle karna
    if (error.code === 11000) {
      console.log("❌ Create error: Duplicate Brand Code");
      return res.status(400).json({
        success: false,
        message: "This Brand Code already exists. Please use a different code.",
      });
    }

    console.log("❌ Create error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ================================
// GET ALL BRANDS (✅ Only Active + Products via brand_id)
// ================================
const getBrands = async (req, res) => {
  try {
    // ✅ Sirf non-deleted brands fetch karein
    const brands = await Brand.find({ is_deleted: false })
      .sort({ created_at: -1 })
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    const brandsWithProducts = await Promise.all(
      brands.map(async (brand) => {
        const products = await Product.find({ brand_id: brand._id })
          .populate("category_id", "name")
          .select("name brand_id category_id status created_at");

        return {
          ...brand.toObject(),
          products: products,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: brandsWithProducts,
    });
  } catch (error) {
    console.log("❌ Get brands error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ================================
// GET SINGLE BRAND (✅ Only Active + Products via brand_id)
// ================================
const getBrandById = async (req, res) => {
  try {
    // ✅ Deleted brand access block karein
    const brand = await Brand.findOne({ _id: req.params.id, is_deleted: false })
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    const products = await Product.find({ brand_id: brand._id })
      .populate("category_id", "name")
      .select("name brand_id category_id status created_at");

    res.status(200).json({
      success: true,
      data: {
        ...brand.toObject(),
        products: products,
      },
    });
  } catch (error) {
    console.log("❌ Get brand by id error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ================================
// GET BRAND WITH PRODUCTS (✅ Only Active)
// ================================
const getBrandWithProducts = async (req, res) => {
  try {
    // ✅ Deleted brand access block karein
    const brand = await Brand.findOne({ _id: req.params.id, is_deleted: false })
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    const products = await Product.find({ brand_id: brand._id })
      .populate("category_id", "name")
      .select("name brand_id category_id status created_at");

    res.status(200).json({
      success: true,
      data: {
        ...brand.toObject(),
        products: products,
      },
    });
  } catch (error) {
    console.log("❌ Get brand with products error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ================================
// UPDATE BRAND (✅ Only Active Brands)
// ================================
const updateBrand = async (req, res) => {
  try {
    // ✅ Deleted brand update block karein
    const existingBrand = await Brand.findOne({ _id: req.params.id, is_deleted: false });

    if (!existingBrand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    const updateData = {
      ...req.body,
      updatedby: req.user?._id || null,
    };

    if (req.brandImage) {
      if (existingBrand.logo?.img_url) {
        const oldFolderPath = path.join(
          __dirname,
          "../uploads/brands",
          existingBrand._id.toString()
        );

        if (await fs.pathExists(oldFolderPath)) {
          await fs.remove(oldFolderPath);
          console.log(`🗑️ Old brand folder deleted: ${oldFolderPath}`);
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

    const brand = await Brand.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    })
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    const products = await Product.find({ brand_id: brand._id })
      .populate("category_id", "name")
      .select("name brand_id category_id status created_at");

    // ✅ SOCKET EMIT - Brand Updated
    try {
      const io = getIO();
      io.emit("brandUpdated", brand.toObject());
    } catch (socketErr) {
      console.log("⚠️ Socket emit skipped:", socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: {
        ...brand.toObject(),
        products: products,
      },
    });
  } catch (error) {
    // ✅ Duplicate Key Error (11000) ko handle karna (Update ke waqt)
    if (error.code === 11000) {
      console.log("❌ Update error: Duplicate Brand Code");
      return res.status(400).json({
        success: false,
        message: "This Brand Code already exists. Please use a different code.",
      });
    }

    console.log("❌ Update error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ================================
// ✅ SOFT DELETE BRAND (Hard Delete NAHI, Images Bhi Safe)
// ================================
const deleteBrand = async (req, res) => {
  try {
    // ✅ Sirf active brand dhundhein
    const brand = await Brand.findOne({ _id: req.params.id, is_deleted: false });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found or already deleted",
      });
    }

    console.log("========== SOFT DELETE BRAND ==========");
    console.log("Brand ID:", brand._id);

    // ⚠️ Soft delete mein images DELETE NAHI hoti
    // Restore karne par images wapas chahiye hongi
    console.log("📁 Brand images preserved for possible restore");

    // ✅ Model method se soft delete karein
    await brand.softDelete(req.user._id);

    console.log("✅ Brand soft deleted from DB:", brand._id);
    console.log("   deleted_at:", brand.deleted_at);
    console.log("   deletedby:", brand.deletedby);

    // ✅ SOCKET EMIT - Brand Deleted
    try {
      const io = getIO();
      io.emit("brandDeleted", { _id: brand._id.toString() });
    } catch (socketErr) {
      console.log("⚠️ Socket emit skipped:", socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: "Brand soft deleted successfully",
      data: {
        _id: brand._id,
        deleted_at: brand.deleted_at,
      },
    });
  } catch (error) {
    console.log("❌ Soft delete error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ================================
// EXPORT
// ================================
module.exports = {
  getNextBrandCode,
  createBrand,
  getBrands,
  getBrandById,
  getBrandWithProducts,
  updateBrand,
  deleteBrand,
};