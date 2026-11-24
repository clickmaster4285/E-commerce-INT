const sharp = require("sharp");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const { uploadDirFor, uploadUrlFor } = require("../utils/uploadPaths");

// ✅ Shared memory-storage multer (tenantMulter — store context safe)
const upload = require("../config/uploadConfig");

// Store editor image — single file, field name: "image"
const themeImageUpload = upload.single("image");

// ==========================================
// 🖼️ PROCESS THEME IMAGE
// sharp resize + webp → uploads/stores/<storeId>/theme/<unique>.webp
// Filename hamesha unique (kabhi overwrite nahi). Purani images save par
// delete NAHI hoti — published versions abhi bhi unhe use kar sakte hain.
// ==========================================
const processThemeImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image file is required (field: image)" });
    }

    const folder = uploadDirFor(req, "theme");
    await fs.ensureDir(folder);

    const fileName = `theme_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.webp`;
    const filePath = path.join(folder, fileName);

    await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(filePath);

    const metadata = await sharp(filePath).metadata();
    const stats = await fs.stat(filePath);

    req.themeImage = {
      url: uploadUrlFor(filePath),
      size: stats.size,
      width: metadata.width,
      height: metadata.height,
      mimeType: "image/webp",
    };
    return next();
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Image processing failed" });
  }
};

module.exports = { themeImageUpload, processThemeImage };
