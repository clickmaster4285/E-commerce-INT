const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

// Aapke existing server.js ke UPLOAD_DIR ke andar 'banners' folder banayega
const uploadDir = path.join(__dirname, "../uploads/banners");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `banner-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("Only image files are allowed"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// ✅ Professional banner shapes — upload ke baad har image ko fixed
// banner width/height par resize karke WebP mein compress kar diya jata hai
const BANNER_SHAPES = {
  desktopImage: { width: 1920, height: 600 },
  tabletImage: { width: 1200, height: 600 },
  mobileImage: { width: 768, height: 400 },
};

const processBannerImage = async (file) => {
  const shape = BANNER_SHAPES[file.fieldname];
  if (!shape) return;

  const processedName = `${path.basename(file.filename, path.extname(file.filename))}.webp`;
  const processedPath = path.join(uploadDir, processedName);

  // Buffer ke through process karo taaki same-name (pehle se .webp) par overwrite safe rahe
  const buffer = await sharp(file.path)
    .rotate() // EXIF orientation respect karo
    .resize({
      width: shape.width,
      height: shape.height,
      fit: "cover", // exact banner shape (center/attention crop, koi letterbox nahi)
      position: sharp.strategy.attention, // important part crop mein aaye
    })
    .webp({ quality: 85 })
    .toBuffer();

  await fs.promises.writeFile(processedPath, buffer);

  // Purani uncompressed file hatao (agar naam alag hai)
  if (file.path !== processedPath && fs.existsSync(file.path)) {
    await fs.promises.unlink(file.path);
  }

  // Controller sirf file.filename / file.path use karta hai — update kar do
  file.filename = processedName;
  file.path = processedPath;
  file.mimetype = "image/webp";
  file.size = buffer.length;
};

const uploadBanners = (req, res, next) => {
  upload.fields([
    { name: "desktopImage", maxCount: 1 },
    { name: "tabletImage", maxCount: 1 },
    { name: "mobileImage", maxCount: 1 },
  ])(req, res, async (err) => {
    if (err) return next(err);

    try {
      for (const files of Object.values(req.files || {})) {
        for (const file of files || []) {
          await processBannerImage(file);
        }
      }
      next();
    } catch (error) {
      // Processing fail → uploaded files delete taaki orphan na bache
      for (const files of Object.values(req.files || {})) {
        for (const file of files || []) {
          try {
            if (file.path && fs.existsSync(file.path)) {
              await fs.promises.unlink(file.path);
            }
          } catch (_) {}
        }
      }
      res.status(400).json({
        success: false,
        message: error.message || "Banner image processing failed",
      });
    }
  });
};

module.exports = uploadBanners;