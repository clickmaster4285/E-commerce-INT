const sharp = require("sharp");
const fs = require("fs-extra");
const path = require("path");
const mongoose = require("mongoose");

// ✅ Same shared multer config jo product images ke liye use hota hai (memory storage)
const upload = require("../config/uploadConfig");

// Single manual cover image — field name: "image"
const bundleImageUpload = upload.single("image");

// ==========================================
// 🖼️ PROCESS BUNDLE COVER IMAGE
// Product images ki tarah: sharp se resize + webp compress,
// file uploads/bundles/<bundleId>/ me save hoti hai.
// ==========================================
const processBundleImage = async (req, res, next) => {
  try {
    // Image nahi aayi (update par purani image rakhne ke liye) to skip —
    // "required" validation controller me hoti hai.
    if (!req.file) return next();

    // Update → route id | Create → naya ObjectId (folder naam = bundle._id, product jaisa)
    const bundleId =
      req.params.id || req.bundleId || new mongoose.Types.ObjectId();

    req.bundleId = bundleId;

    const uploadFolder = path.join(
      __dirname,
      "../uploads/bundles",
      bundleId.toString()
    );

    await fs.ensureDir(uploadFolder);

    const fileName = `cover_${Date.now()}.webp`;
    const filePath = path.join(uploadFolder, fileName);

    await sharp(req.file.buffer)
      .resize({
        width: 1000,
        height: 1000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toFile(filePath);

    const metadata = await sharp(filePath).metadata();
    const stats = await fs.stat(filePath);

    // ✅ Store hone wala path (DB me string ke roop me jata hai)
    req.bundleImage = `uploads/bundles/${bundleId}/${fileName}`;

    // Metadata (agar kabhi zarurat pade)
    req.bundleImageMeta = {
      img_url: `/${req.bundleImage}`,
      img_size: stats.size,
      mimeType: "image/webp",
      width: metadata.width,
      height: metadata.height,
    };

    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Bundle image processing failed",
    });
  }
};

module.exports = { bundleImageUpload, processBundleImage };
