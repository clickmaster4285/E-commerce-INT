// ==========================================================
// TENANT-SAFE MULTER — `require("multer")` ki jagah ye use karo
// ----------------------------------------------------------
// Multer (busboy streams) apna `next()` request-stream ke events se bulata
// hai, jahan AsyncLocalStorage ka store-context kho jata hai. Phir upload
// wale route (product/banner image) ka controller bina store ke chalta aur
// document bina storeId ke save ho jata. Ye wrapper multer ke har middleware
// ka `next` current context se bind kar deta hai.
// ==========================================================

const multer = require("multer");
const { bindToContext } = require("./tenantContext");

const METHODS = ["single", "array", "fields", "none", "any"];

function tenantMulter(options) {
  const instance = multer(options);
  for (const method of METHODS) {
    const original = instance[method].bind(instance);
    instance[method] = (...args) => {
      const middleware = original(...args);
      return (req, res, next) => middleware(req, res, bindToContext(next));
    };
  }
  return instance;
}

// multer.diskStorage / memoryStorage / MulterError waghera as-is
Object.assign(tenantMulter, multer);

module.exports = tenantMulter;
