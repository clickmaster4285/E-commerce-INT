const Brand = require("../models/brand");
const path = require("path");
const fs = require("fs-extra");


// ================================
// ✅ NEW: GET NEXT BRAND CODE
// ================================
const getNextBrandCode = async (req, res) => {
  try {
    const lastBrand = await Brand.findOne(
      { brand_code: { $regex: /^BRD-\d+$/ } }
    )
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


    // ✅ UPDATED: populate createdby/updatedby before sending response
    const updatedBrand = await Brand.findById(brand._id)
      .populate("createdby", "name email")
      .populate("updatedby", "name email");


    res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: updatedBrand,
    });


  } catch (error) {

    console.log("❌ Create error:", error.message);

    res.status(400).json({
      success: false,
      message: error.message,
    });

  }
};



// ================================
// GET ALL BRANDS
// ================================
const getBrands = async (req, res) => {
  try {

    // ✅ UPDATED: populate createdby/updatedby with name & email
    const brands = await Brand.find()
      .sort({ created_at: -1 })
      .populate("createdby", "name email")
      .populate("updatedby", "name email");


    res.status(200).json({
      success: true,
      data: brands,
    });


  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message,
    });

  }
};



// ================================
// GET SINGLE BRAND
// ================================
const getBrandById = async (req, res) => {
  try {

    // ✅ UPDATED: populate createdby/updatedby
    const brand = await Brand.findById(req.params.id)
      .populate("createdby", "name email")
      .populate("updatedby", "name email");


    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }


    res.status(200).json({
      success: true,
      data: brand,
    });


  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message,
    });

  }
};



// ================================
// GET BRAND WITH PRODUCTS
// ================================
const getBrandWithProducts = async (req, res) => {
  try {

    const brand = await Brand.findById(req.params.id)
      .populate("products")
      .populate("createdby", "name email")
      .populate("updatedby", "name email");


    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }


    res.status(200).json({
      success: true,
      data: brand,
    });


  } catch (error) {

    res.status(400).json({
      success: false,
      message: error.message,
    });

  }
};



// ================================
// UPDATE BRAND
// ================================
const updateBrand = async (req, res) => {
  try {

    const existingBrand = await Brand.findById(req.params.id);

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


    const brand = await Brand.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
      }
    )
      .populate("createdby", "name email")    // ✅ UPDATED
      .populate("updatedby", "name email");    // ✅ UPDATED


    res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: brand,
    });


  } catch (error) {

    console.log("❌ Update error:", error.message);

    res.status(400).json({
      success: false,
      message: error.message,
    });

  }
};



// ================================
// DELETE BRAND
// ================================
const deleteBrand = async (req, res) => {
  try {

    const brand = await Brand.findById(req.params.id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    console.log("========== DELETE BRAND ==========");
    console.log("Brand ID:", brand._id);
    console.log("Brand logo:", JSON.stringify(brand.logo));


    const folderPath = path.join(
      __dirname,
      "../uploads/brands",
      brand._id.toString()
    );

    console.log("📁 Folder path to delete:", folderPath);

    if (await fs.pathExists(folderPath)) {
      await fs.remove(folderPath);
      console.log("🗑️ Brand image folder DELETED:", folderPath);
    } else {
      console.log("⚠️ Folder not found at:", folderPath);

      if (brand.logo?.img_url) {
        const parts = brand.logo.img_url.split("/");
        const folderName = parts[2];

        if (folderName) {
          const fallbackPath = path.join(
            __dirname,
            "../uploads/brands",
            folderName
          );

          console.log("📁 Trying fallback path:", fallbackPath);

          if (await fs.pathExists(fallbackPath)) {
            await fs.remove(fallbackPath);
            console.log("🗑️ Brand image folder DELETED (fallback):", fallbackPath);
          }
        }
      }
    }


    await Brand.findByIdAndDelete(req.params.id);
    console.log("🗑️ Brand deleted from DB:", brand._id);


    res.status(200).json({
      success: true,
      message: "Brand deleted successfully",
    });


  } catch (error) {

    console.log("❌ Delete error:", error.message);

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