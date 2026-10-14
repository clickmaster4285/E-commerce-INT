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

// ✅ Sirf wahi formats jo frontend notice me likhe hain (JPG/PNG/WEBP).
// Pehle `image/*` koi bhi type le leti thi — GIF/SVG/BMP silently accept ho
// jate the aur sharp ke baad admin ko pata hi nahi chalta tha ki GIF ka
// animation toot gaya ya SVG rasterize ho gaya.
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
  cb(
    new Error("Unsupported file type — only JPG, PNG and WEBP images are allowed"),
    false
  );
};

// ✅ Banner images badi hoti hain — 5MB parakash me high-res PNG reject ho jata tha.
// Env se override kar sakte hain (BANNER_UPLOAD_MAX_MB), default 15MB.
const MAX_UPLOAD_MB = parseInt(process.env.BANNER_UPLOAD_MAX_MB, 10) || 15;

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

// ==========================================
// ✅ ORIGINAL IMAGE SIZE PRESERVE KARO
// Pehle har image ko fixed shape par resize + CROP kar deta tha
// (`fit: "cover"`, 1920x600). Is se:
//   - badi image kat (crop) jati thi — content loss
//   - choti image upscale ho jati thi — blur
//   - admin apni high-res banner daal hi nahi paata tha
// Ab: KABHI crop nahi, KABHI upscale nahi. Resize sirf tab jab width
// MAX_WIDTH se zyada ho (sirf bandwidth bachane ke liye), aur ratio bhi maintain.
// ==========================================
const MAX_WIDTH = {
  desktopImage: 3000,
  tabletImage: 1800,
  mobileImage: 1200,
};

// ✅ Decompression-bomb guard — chhoti file (2MB PNG) RAM me GB bhar sakti hai
// jab sharp use decode karta hai. Banner ke liye 50 megapixel kaafi se zyada
// hai (3000px wide), aur isse ek crafted image server memory nahi kha sakti.
const MAX_INPUT_PIXELS = 50_000_000;

const processBannerImage = async (file) => {
  const maxWidth = MAX_WIDTH[file.fieldname];
  if (!maxWidth) return;

  const processedName = `${path.basename(file.filename, path.extname(file.filename))}.webp`;
  const processedPath = path.join(uploadDir, processedName);

  // Buffer ke through process karo taaki same-name (pehle se .webp) par overwrite safe rahe
  const buffer = await sharp(file.path, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate() // EXIF orientation respect karo
    .resize({
      width: maxWidth,
      fit: "inside", // ✅ poora image rehta hai — koi crop nahi
      withoutEnlargement: true, // ✅ choti image upscale mat karo (blur hote hue)
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
    // ✅ Pehle `next(err)` pe jaata tha. Is project me global error handler nahi hai,
    //    to Express ka default handler HTML/500 bhejta tha — frontend ko JSON nahi
    //    milta tha aur toast me sirf "Request failed with status code 500" dikhta tha.
    //    Ab proper message bhejte hain.
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message: `Image is too large. Maximum allowed size is ${MAX_UPLOAD_MB}MB.`,
        });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          success: false,
          message: "Unexpected file field — only desktop, tablet and mobile images are allowed.",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || "Image upload failed",
      });
    }

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
        // sharp ka raw error cryptic hota hai — pixel-limit wala clearly batao
        message: /pixel limit/i.test(error?.message || "")
          ? "Image resolution is too high. Please resize the image below 50 megapixels and try again."
          : error?.message || "Banner image processing failed",
      });
    }
  });
};

module.exports = uploadBanners;