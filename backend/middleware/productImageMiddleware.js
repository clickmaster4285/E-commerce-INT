const sharp = require("sharp");
const upload = require("../config/uploadConfig");

const productImagesUpload = upload.array("images", 10);

const validateProductImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next();
    }

    const imageMetadata = [];

    for (const file of req.files) {
      const processedBuffer = await sharp(file.buffer)
        .rotate()
        .webp({
          quality: 82,
        })
        .toBuffer();

      const metadata = await sharp(processedBuffer).metadata();

      file.buffer = processedBuffer;
      file.size = processedBuffer.length;
      file.mimetype = "image/webp";

      imageMetadata.push({
        originalName: file.originalname,
        img_size: processedBuffer.length,
        mimeType: "image/webp",
        width: metadata.width,
        height: metadata.height,
      });
    }

    req.imageMetadata = imageMetadata;

    next();
  } catch (error) {
    return res.status(400).json({
      message: "Image processing failed",
    });
  }
};

module.exports = {
  productImagesUpload,
  validateProductImages,
};