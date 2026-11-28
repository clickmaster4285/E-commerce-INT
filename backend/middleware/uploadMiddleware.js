// Banner images — createImageUpload factory (middleware/imageUpload.js, §5.6).
// Rules purane wale hi: KABHI crop nahi, KABHI upscale nahi; sirf width cap
// (bandwidth), ratio maintain; EXIF rotate; 50MP decompression-bomb guard.
// Env BANNER_UPLOAD_MAX_MB (default 15MB). Controller req.files[field][0].path use karta hai.
const { createImageUpload } = require("./imageUpload");

const MAX_UPLOAD_MB = parseInt(process.env.BANNER_UPLOAD_MAX_MB, 10) || 15;

const MAX_WIDTH = {
  desktopImage: 3000,
  tabletImage: 1800,
  mobileImage: 1200,
};

module.exports = createImageUpload({
  fields: [
    { name: "desktopImage", maxCount: 1 },
    { name: "tabletImage", maxCount: 1 },
    { name: "mobileImage", maxCount: 1 },
  ],
  kind: "banners",
  resize: (file) => (MAX_WIDTH[file.fieldname] ? { w: MAX_WIDTH[file.fieldname], fit: "inside" } : null),
  quality: 85,
  maxPixels: 50_000_000,
  maxBytes: MAX_UPLOAD_MB * 1024 * 1024,
});
