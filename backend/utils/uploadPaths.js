// ==========================================================
// UPLOAD PATHS — har store ki files apne folder me
// ----------------------------------------------------------
//   store host  → uploads/stores/<storeId>/<kind>/...   URL /uploads/stores/<storeId>/<kind>/...
//   platform    → uploads/<kind>/...                    (seller signup logo, KYC docs)
//
// Store `req.store` se (resolveStore har API request par set karta hai) —
// multer ke destination/filename callbacks AsyncLocalStorage context kho
// sakte hain, req hamesha saath hota hai. Fallback: getStoreId().
//
// Purani files (uploads/<kind>/...) waise hi serve hoti rehti hain — sirf
// NAYI files store folder me jati hain, DB ke URLs badalne ki zaroorat nahi.
// Filenames ab bhi unique (Date.now / random) — kabhi overwrite nahi.
// ==========================================================

// ==========================================================
// OBJECT STORAGE (§6.4) — STORAGE_DRIVER=local|s3
// Local disk pe pehle write, phir s3 pe putLocalFile (utils/objectStorage.js).
// ==========================================================
const path = require("path");
const { getStoreId } = require("./tenantContext");

const STORAGE_DRIVERS = ["local", "s3"];
function storageDriver() {
  const name = String(process.env.STORAGE_DRIVER || "local").trim().toLowerCase();
  const driver = STORAGE_DRIVERS.includes(name) ? name : "local";
  return { name: driver, effective: driver };
}

/** After local write: if S3 driver, upload and return public URL (else null). */
async function maybeUploadToObjectStorage(absolutePath, contentType) {
  if (storageDriver().name !== "s3") return null;
  try {
    return await require("./objectStorage").putLocalFile(absolutePath, contentType);
  } catch (err) {
    try { require("./logger").error("[uploadPaths] S3 put failed:", err?.message || err); } catch { /* ignore */ }
    return null;
  }
}

const UPLOAD_ROOT = path.resolve(__dirname, "..", process.env.UPLOAD_DIR || "uploads");
const STORES_SEGMENT = "stores";

// "<kind>" / sub segments me path traversal nahi ("..", "/", "\")
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const assertSegment = (segment) => {
  const value = String(segment);
  if (!SAFE_SEGMENT.test(value) || value === "." || value === "..") {
    throw new Error(`Invalid upload path segment: ${value}`);
  }
  return value;
};

function storeIdFor(req) {
  const id = req?.store?._id || getStoreId();
  return id ? String(id) : null;
}

/** Absolute folder: uploads/stores/<storeId>/<kind>/<...sub> (platform: uploads/<kind>/<...sub>) */
function uploadDirFor(req, kind, ...sub) {
  const segments = [kind, ...sub].map(assertSegment);
  const storeId = storeIdFor(req);
  return storeId
    ? path.join(UPLOAD_ROOT, STORES_SEGMENT, assertSegment(storeId), ...segments)
    : path.join(UPLOAD_ROOT, ...segments);
}

/** Absolute file path → public URL ("/uploads/..."). UPLOAD_ROOT ke bahar ka path → error. */
function uploadUrlFor(absolutePath) {
  const relative = path.relative(UPLOAD_ROOT, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("File is outside the upload directory");
  }
  return `/uploads/${relative.split(path.sep).join("/")}`;
}

/**
 * Public URL → absolute path, sirf agar ye isi store ki (ya legacy shared) file ho.
 * Delete/cleanup ke liye: store A kabhi store B ki file nahi mita sakta.
 */
function localPathForUrl(req, url) {
  const clean = String(url || "").replace(/^\/+/, "").split(/[?#]/)[0];
  if (!clean.startsWith("uploads/")) return null;
  const absolute = path.resolve(UPLOAD_ROOT, clean.slice("uploads/".length));
  if (!absolute.startsWith(UPLOAD_ROOT + path.sep)) return null;
  const parts = path.relative(UPLOAD_ROOT, absolute).split(path.sep);
  if (parts[0] === STORES_SEGMENT && parts[1] !== storeIdFor(req)) return null;
  return absolute;
}

module.exports = {
  storageDriver,
  UPLOAD_ROOT,
  uploadDirFor,
  uploadUrlFor,
  localPathForUrl,
  storeIdFor,
  maybeUploadToObjectStorage,
};
