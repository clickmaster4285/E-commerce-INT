const mongoose = require("mongoose");

// Product images ab productImagesUpload (createImageUpload factory) me hi disk par save ho
// chuki hoti hain — yahan sirf controller ke liye req.savedImages banta hai.
// (Controller fail ho to factory ka cleanup files hata deta hai.)
const saveProductImages = async (req, res, next) => {
  try {
    // Agar image nahi hai to skip
    if (!req.files || req.files.length === 0) {
      return next();
    }

    // Update ke case mein params id, Create ke case mein nayi product id (factory set kar chuka hota hai)
    req.productId = req.productId || req.params.id || new mongoose.Types.ObjectId();

    req.savedImages = req.files.map((file) => ({
      img_url: file.img_url,
      img_size: file.img_size,
      mimeType: file.mimeType,
      width: file.width,
      height: file.height,
    }));

    next();
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Product images save failed",
    });
  }
};

module.exports = saveProductImages;

