// Deal (bundle) image — ab createImageUpload factory se (middleware/imageUpload.js, §5.6):
// memory multer → magic-bytes check → sharp WebP re-encode → uploads/stores/<storeId>/deals/
// Pehle sharp nahi tha: client ki raw bytes (polyglot/EXIF payload) disk par jati thi.
// Field name "image", controller req.file.path use karta hai (factory wahi set karta hai).
const { createImageUpload } = require("./imageUpload");

module.exports = createImageUpload({
  fields: "image",
  kind: "deals",
  resize: { w: 1600, h: 1600, fit: "inside" },
  quality: 85,
  maxBytes: 5 * 1024 * 1024, // 5MB limit
});
