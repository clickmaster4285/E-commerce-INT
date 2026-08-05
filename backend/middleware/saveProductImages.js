const path = require("path");
const fs = require("fs-extra");
const mongoose = require("mongoose");

const saveProductImages = async (req, res, next) => {
  try {
    // Agar image nahi hai to skip
    if (!req.files || req.files.length === 0) {
      return next();
    }

    // Update ke case mein params id,
    // Create ke case mein nayi product id
   const productId =
  req.productId ||
  req.params.id ||
  new mongoose.Types.ObjectId();
    // Controller bhi isi ID ko use karega
    req.productId = productId;

    const uploadDirectory = path.join(
      process.cwd(),
      "uploads",
      "products",
      productId.toString()
    );

    // Folder create karo agar exist nahi karta
    await fs.ensureDir(uploadDirectory);

    const savedImages = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const metadata = req.imageMetadata[i];

      const extension = path.extname(file.originalname).toLowerCase();

      const originalName = path
        .basename(file.originalname, extension)
        .replace(/[^a-zA-Z0-9-_]/g, "-");

      const fileName = `${Date.now()}-${i}-${originalName}${extension}`;

      const filePath = path.join(
        uploadDirectory,
        fileName
      );

      // Image physically save
      await fs.writeFile(filePath, file.buffer);

      savedImages.push({
        img_url: `/uploads/products/${productId}/${fileName}`,
        img_size: file.size,
        mimeType: file.mimetype,
        width: metadata.width,
        height: metadata.height,
      });
    }

    // Controller mein use hoga
    req.savedImages = savedImages;

    next();
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Product images save failed",
    });
  }
};

module.exports = saveProductImages;