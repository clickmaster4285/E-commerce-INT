// S3-compatible object storage (§6.4) — used when STORAGE_DRIVER=s3
const path = require("path");
const fs = require("fs");

const UPLOAD_ROOT = path.resolve(__dirname, "..", process.env.UPLOAD_DIR || "uploads");

let client = null;
let warned = false;

function s3Config() {
  return {
    region: process.env.S3_REGION || process.env.AWS_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || "true") === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
    },
    bucket: process.env.S3_BUCKET || "",
    publicBaseUrl: (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/+$/, ""),
  };
}

function getClient() {
  if (client) return client;
  const cfg = s3Config();
  if (!cfg.bucket || !cfg.credentials.accessKeyId) {
    if (!warned) {
      warned = true;
      try {
        require("./logger").warn("[objectStorage] S3_BUCKET / credentials missing — uploads stay local");
      } catch { /* ignore */ }
    }
    return null;
  }
  const { S3Client } = require("@aws-sdk/client-s3");
  client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle,
    credentials: cfg.credentials,
  });
  return client;
}

function keyFromAbsolute(absolutePath) {
  const relative = path.relative(UPLOAD_ROOT, absolutePath);
  return relative.split(path.sep).join("/");
}

async function putLocalFile(absolutePath, contentType) {
  const s3 = getClient();
  const cfg = s3Config();
  if (!s3 || !cfg.bucket) return null;

  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  const Key = keyFromAbsolute(absolutePath);
  const Body = fs.createReadStream(absolutePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key,
      Body,
      ContentType: contentType || "application/octet-stream",
    }),
  );

  if (cfg.publicBaseUrl) return `${cfg.publicBaseUrl}/${Key}`;
  if (cfg.endpoint) return `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}/${Key}`;
  return `https://${cfg.bucket}.s3.amazonaws.com/${Key}`;
}

async function removeKey(keyOrUrl) {
  const s3 = getClient();
  const cfg = s3Config();
  if (!s3 || !cfg.bucket) return false;
  let Key = String(keyOrUrl || "");
  if (Key.includes("://")) {
    try {
      const u = new URL(Key);
      Key = u.pathname.replace(/^\/+/, "").replace(new RegExp(`^${cfg.bucket}/`), "");
    } catch {
      return false;
    }
  }
  const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
  await s3.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key }));
  return true;
}

module.exports = { putLocalFile, removeKey, getClient, s3Config, keyFromAbsolute };
