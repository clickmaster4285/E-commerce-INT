// ==========================================================
// AVATAR FILES (§3.6) — data URL DB me nahi, file disk par
// ----------------------------------------------------------
//   const url = await persistAvatar(req, dataUrlOrUrl);
//   • data:image/... → sharp 320x320 webp → uploads/stores/<id>/avatars/<unique>.webp → "/uploads/..." URL
//   • pehle se URL / empty → waisa hi wapas (no-op)
// Filename unique (Date.now + random) — kabhi overwrite nahi.
// ==========================================================
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { uploadDirFor, uploadUrlFor } = require("./uploadPaths");

const DATA_URL = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/s;
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif", "image/gif"];
const MAX_BYTES = (Number(process.env.MAX_UPLOAD_SIZE_MB) || 5) * 1024 * 1024;

const isDataUrl = (value) => typeof value === "string" && value.startsWith("data:image/");

/** @param {object} req  req ya `{ store: { _id } }` (socket/script) — store folder isi se */
async function persistAvatar(req, value) {
  if (!isDataUrl(value)) return value;
  const match = value.match(DATA_URL);
  if (!match) throw new Error("invalid image format");
  if (!ALLOWED.includes(match[1].toLowerCase())) throw new Error("unsupported type (use PNG, JPG or WEBP)");

  const raw = Buffer.from(match[2], "base64");
  if (!raw.length) throw new Error("empty image data");
  if (raw.length > MAX_BYTES) throw new Error("image too large");

  const sharp = require("sharp");
  const out = await sharp(raw)
    .rotate()
    .resize(320, 320, { fit: "cover", position: "centre" })
    .webp({ quality: 82, alphaQuality: 100, effort: 4 })
    .toBuffer();

  const dir = uploadDirFor(req, "avatars");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `avatar-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`);
  await fs.writeFile(file, out);
  return uploadUrlFor(file);
}

module.exports = { persistAvatar, isDataUrl };
