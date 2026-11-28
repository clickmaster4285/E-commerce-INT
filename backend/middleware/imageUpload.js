// ==========================================================
// IMAGE UPLOAD FACTORY (optimizeplan.md §5.6)
// ----------------------------------------------------------
// Pehle har middleware (deal / banner / brand / store logo ...) apna multer +
// sharp + error handling khud likhta tha — kahin SVG pass, kahin sharp hi nahi
// (raw bytes disk par), kahin errors HTML 500. Ye factory ek jagah:
//   1. tenantMulter (memory storage) — strict fileSize limit
//   2. mimetype whitelist (jpeg|png|webp|gif) + MAGIC BYTES check (client ka
//      mimetype/extension jhoota ho sakta hai; SVG/HTML kabhi disk par nahi)
//   3. sharp → WebP re-encode (EXIF rotate, resize, pixel-bomb guard)
//   4. uploads/stores/<storeId>/<kind>/... me unique filename
//   5. multer / validation errors → AppError (errorHandler JSON deta hai)
//   6. controller fail ho (non-2xx) to likhi hui files delete (orphan nahi)
//
// Factory par migrate ho chuke: deal, banner, store logo, product (+variant), bundle, theme,
// review (images + video), brand logo. Socket store logo base64 ab deprecated thin wrapper hai
// (utils/socket.js → processImage); REST: PUT /store ya POST /store/logo (multipart).
// ==========================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const multer = require("../utils/tenantMulter");
const AppError = require("../utils/AppError");
const { uploadDirFor, uploadUrlFor, maybeUploadToObjectStorage } = require("../utils/uploadPaths");

// Sirf raster images — SVG me <script> chal sakta hai (stored XSS)
const IMAGE_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]); // mov ka sniff bhi "ftyp" (mp4 jaisa)

const DEFAULT_MAX_MB = Number.parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 10;
const DEFAULT_MAX_PIXELS = 50_000_000; // decompression-bomb guard

/** Buffer ke pehle bytes dekh kar asli type: "jpeg"|"png"|"webp"|"gif"|"mp4"|"webm"|null */
function sniffType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  const head = buf.subarray(0, 6).toString("latin1");
  if (head === "GIF87a" || head === "GIF89a") return "gif";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") return "mp4";
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  return null;
}

const invalidImage = (message = "Invalid or corrupted image file") =>
  new AppError(message, { status: 400, code: "INVALID_IMAGE" });

/**
 * Buffer → WebP. SVG / non-image / corrupt → AppError(INVALID_IMAGE).
 * @returns {{ buffer, width, height, size, mimeType }}
 */
async function processImage(buffer, opts = {}) {
  const { resize, quality = 85, rotate = true, maxPixels = DEFAULT_MAX_PIXELS } = opts;
  const type = sniffType(buffer);
  if (!type || !["jpeg", "png", "webp", "gif"].includes(type)) {
    throw invalidImage("Only PNG, JPEG, WEBP or GIF images are allowed");
  }
  try {
    let pipeline = sharp(buffer, { limitInputPixels: maxPixels });
    if (rotate) pipeline = pipeline.rotate(); // EXIF orientation pehle
    if (resize && (resize.w || resize.h)) {
      pipeline = pipeline.resize({
        width: resize.w,
        height: resize.h,
        fit: resize.fit || "inside",
        withoutEnlargement: resize.withoutEnlargement !== false, // kabhi upscale nahi (blur)
      });
    }
    const { data, info } = await pipeline
      .webp({ quality, alphaQuality: 100, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height, size: data.length, mimeType: "image/webp" };
  } catch (err) {
    if (/pixel limit/i.test(err?.message || "")) {
      throw invalidImage("Image resolution is too high. Please resize the image and try again.");
    }
    throw invalidImage(); // sharp decode na kar sake → asli image nahi, raw bytes save nahi
  }
}

const uniqueName = (prefix, ext) =>
  `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;

/** Cleanup list — controller fail par ye files delete hongi */
function trackUploadedFile(req, absolutePath) {
  (req._uploadedFiles ||= []).push(absolutePath);
}

/** Controller ne success (2xx/3xx) nahi diya to likhi hui files hata do (orphan nahi bachte) */
function registerUploadCleanup(req, res) {
  if (req._uploadCleanupRegistered) return;
  req._uploadCleanupRegistered = true;
  res.on("finish", () => {
    if (res.statusCode < 400) return;
    const files = req._uploadedFiles || [];
    req._uploadedFiles = [];
    for (const file of files) fs.promises.unlink(file).catch(() => {});
  });
}

/** Multer / validation error → AppError (central errorHandler JSON) */
function mapUploadError(err, { maxBytes }) {
  if (err instanceof AppError) return err;
  if (err?.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      const mb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
      return new AppError(`Image is too large. Maximum allowed size is ${mb}MB.`, { status: 413, code: "LIMIT_FILE_SIZE" });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return new AppError("Unexpected file field.", { status: 400, code: "LIMIT_UNEXPECTED_FILE" });
    }
    return new AppError(err.message || "Upload failed.", { status: 400, code: err.code || "UPLOAD_ERROR" });
  }
  return err;
}

/**
 * @param {object} cfg
 * @param {string|Array<{name,maxCount}>} cfg.fields  "logo" (single) ya [{name,maxCount}]
 * @param {number}   [cfg.maxCount=1]   string fields ke liye
 * @param {string}   cfg.kind           uploads/stores/<storeId>/<kind>/
 * @param {string|function} [cfg.idFrom] sub-folder: req.params key ya (req)=>id
 * @param {object|function} [cfg.resize] {w,h,fit} ya (file)=>{w,h,fit}
 * @param {number}   [cfg.quality=85]
 * @param {boolean}  [cfg.rotate=true]
 * @param {number}   [cfg.maxPixels]
 * @param {number}   [cfg.maxBytes]
 * @param {string}   [cfg.reqKey]       req[reqKey] = processed result(s)
 * @param {boolean}  [cfg.allowVideo]   mp4/webm as-is (sniffed)
 * @param {"memory"|"disk"} [cfg.storage="memory"]  disk — badi video ke liye RAM bachao
 */
function createImageUpload(cfg = {}) {
  const {
    fields, maxCount = 1, kind, idFrom, resize, quality = 85, rotate = true,
    maxPixels = DEFAULT_MAX_PIXELS, maxBytes = DEFAULT_MAX_MB * 1024 * 1024,
    reqKey, allowVideo = false, storage: storageMode = "memory",
  } = cfg;
  if (!fields) throw new Error("createImageUpload: `fields` required");
  if (!kind) throw new Error("createImageUpload: `kind` required");

  const fieldList = typeof fields === "string" ? [{ name: fields, maxCount }] : fields;
  const isSingle = typeof fields === "string" && maxCount === 1;
  const useDisk = storageMode === "disk" || (allowVideo && storageMode !== "memory");

  const storage = useDisk
    ? multer.diskStorage({
        destination: (req, file, cb) => {
          try {
            const sub = (() => {
              if (!idFrom) return [];
              const id = typeof idFrom === "function" ? idFrom(req) : req.params?.[idFrom];
              return id ? [String(id)] : [];
            })();
            const dir = uploadDirFor(req, kind, ...sub, "_tmp");
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
          } catch (err) {
            cb(err);
          }
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname || "").slice(1) || "bin";
          cb(null, uniqueName("up", ext.replace(/[^a-z0-9]/gi, "") || "bin"));
        },
      })
    : multer.memoryStorage();

  const upload = multer({
    storage,
    limits: { fileSize: maxBytes, files: fieldList.reduce((n, f) => n + (f.maxCount || 1), 0) },
    fileFilter: (req, file, cb) => {
      const mime = String(file.mimetype || "").toLowerCase();
      if (IMAGE_MIMES.has(mime) || (allowVideo && VIDEO_MIMES.has(mime))) return cb(null, true);
      return cb(new AppError("Only PNG, JPEG, WEBP or GIF images are allowed", { status: 400, code: "INVALID_FILE_TYPE" }), false);
    },
  });

  const parse = isSingle
    ? upload.single(fieldList[0].name)
    : upload.fields(fieldList.map((f) => ({ name: f.name, maxCount: f.maxCount || 1 })));

  const resolveSub = (req) => {
    if (!idFrom) return [];
    const id = typeof idFrom === "function" ? idFrom(req) : req.params?.[idFrom];
    return id ? [String(id)] : [];
  };

  // Ek file: validate → process → disk
  async function handleFile(req, dir, file) {
    const tmpPath = file.path || null;
    const mime = String(file.mimetype || "").toLowerCase();
    const looksVideo = allowVideo && VIDEO_MIMES.has(mime);

    // Video on disk: sniff header only (12 bytes) — poori file RAM me mat lao
    if (looksVideo && tmpPath) {
      const fd = await fs.promises.open(tmpPath, "r");
      const head = Buffer.alloc(12);
      await fd.read(head, 0, 12, 0);
      await fd.close();
      const sniffed = sniffType(head) || (mime.includes("webm") ? "webm" : "mp4");
      if (sniffed !== "mp4" && sniffed !== "webm") {
        await fs.promises.unlink(tmpPath).catch(() => {});
        throw invalidImage("Only MP4 or WebM videos are allowed");
      }
      const filePath = path.join(dir, uniqueName(kind.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "vid", sniffed));
      await fs.promises.rename(tmpPath, filePath).catch(async () => {
        await fs.promises.copyFile(tmpPath, filePath);
        await fs.promises.unlink(tmpPath).catch(() => {});
      });
      trackUploadedFile(req, filePath);
      const remoteUrl = await maybeUploadToObjectStorage(filePath, `video/${sniffed}`);
      const url = remoteUrl || uploadUrlFor(filePath);
      return {
        img_url: url, img_size: file.size, mimeType: `video/${sniffed}`, width: undefined, height: undefined,
        originalSize: file.size, fieldname: file.fieldname, originalname: file.originalname, path: filePath,
        filename: path.basename(filePath), mimetype: `video/${sniffed}`, size: file.size,
      };
    }

    const buffer = file.buffer || (tmpPath ? await fs.promises.readFile(tmpPath) : null);
    if (!buffer) return null;
    if (tmpPath) await fs.promises.unlink(tmpPath).catch(() => {});
    const sniffed = sniffType(buffer);
    let out;
    let ext = "webp";
    if (allowVideo && (sniffed === "mp4" || sniffed === "webm")) {
      ext = sniffed;
      out = { buffer, size: buffer.length, mimeType: `video/${sniffed}`, width: undefined, height: undefined };
    } else {
      const fieldResize = typeof resize === "function" ? resize(file) : resize;
      if (typeof resize === "function" && !fieldResize) return null;
      out = await processImage(buffer, { resize: fieldResize, quality, rotate, maxPixels });
    }
    const filePath = path.join(dir, uniqueName(kind.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "img", ext));
    await fs.promises.writeFile(filePath, out.buffer);
    trackUploadedFile(req, filePath);
    const remoteUrl = await maybeUploadToObjectStorage(filePath, out.mimeType);
    const url = remoteUrl || uploadUrlFor(filePath);
    return {
      img_url: url, img_size: out.size, mimeType: out.mimeType, width: out.width, height: out.height,
      // multer-compatible fields — purane controllers req.file.path / filename use karte hain
      originalSize: file.size, // upload ke waqt (sharp se pehle) — per-file limit checks ke liye
      fieldname: file.fieldname, originalname: file.originalname, path: filePath,
      filename: path.basename(filePath), mimetype: out.mimeType, size: out.size,
    };
  }

  return async function imageUploadMiddleware(req, res, next) {
    registerUploadCleanup(req, res);
    parse(req, res, async (err) => {
      if (err) return next(mapUploadError(err, { maxBytes }));
      try {
        const files = isSingle ? (req.file ? [req.file] : []) : Object.values(req.files || {}).flat();
        if (!files.length) return next();

        const dir = uploadDirFor(req, kind, ...resolveSub(req));
        await fs.promises.mkdir(dir, { recursive: true });

        const results = new Map();
        for (const file of files) {
          const saved = await handleFile(req, dir, file);
          if (saved) results.set(file, saved);
        }

        if (isSingle) {
          req.file = results.get(req.file) || undefined;
          if (reqKey) req[reqKey] = req.file;
        } else {
          const next_ = {};
          for (const [name, list] of Object.entries(req.files)) {
            const done = list.map((f) => results.get(f)).filter(Boolean);
            if (done.length) next_[name] = done;
          }
          req.files = next_;
          if (reqKey) req[reqKey] = next_;
        }
        return next();
      } catch (e) {
        // Beech me fail → jo files likh chuki unhe foran hata do
        const written = req._uploadedFiles || [];
        req._uploadedFiles = [];
        await Promise.all(written.map((p) => fs.promises.unlink(p).catch(() => {})));
        return next(e instanceof AppError ? e : mapUploadError(e, { maxBytes }));
      }
    });
  };
}

module.exports = {
  createImageUpload, processImage, sniffType, registerUploadCleanup, trackUploadedFile,
  mapUploadError, IMAGE_MIMES,
};
