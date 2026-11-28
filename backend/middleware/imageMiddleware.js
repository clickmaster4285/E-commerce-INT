const crypto = require("crypto");
const { createImageUpload } = require("./imageUpload");

// Brand logo — createImageUpload factory (§5.6): field "logo", contain-fit 300x300,
// uploads/stores/<storeId>/brands/<brandId>/. Route: `processBrandLogo.upload, processBrandLogo`.
const brandLogoUpload = createImageUpload({
  fields: "logo",
  kind: "brands",
  idFrom: (req) => {
    // Update → route id | Create → naya id (controller req.brandId ko _id banata hai)
    if (req.params?.id) return req.params.id;
    if (!req.brandId) req.brandId = crypto.randomBytes(12).toString("hex");
    return req.brandId;
  },
  resize: { w: 300, h: 300, fit: "contain", withoutEnlargement: false },
  quality: 85,
});

// Factory ke baad: req.file → req.brandImage (DB format: leading slash ke bina)
const processBrandLogo = (req, res, next) => {
  if (!req.file) return next();
  req.brandImage = {
    img_url: req.file.img_url.slice(1),
    img_size: req.file.img_size,
    mimeType: "image/webp",
    width: req.file.width,
    height: req.file.height,
  };
  return next();
};

processBrandLogo.upload = brandLogoUpload;
module.exports = processBrandLogo;

