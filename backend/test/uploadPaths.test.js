// Per-store upload folders + safe delete paths (utils/uploadPaths.js)
process.env.UPLOAD_DIR = "uploads";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { UPLOAD_ROOT, uploadDirFor, uploadUrlFor, localPathForUrl } = require("../utils/uploadPaths");
const { runWithStore } = require("../utils/tenantContext");

const A = "6affcafd86c732e1c90f74ec";
const B = "6afef2c9c05e45bb516dcd32";
const reqA = { store: { _id: A } };

test("store host: files go to uploads/stores/<storeId>/<kind>/...", () => {
  assert.equal(uploadDirFor(reqA, "products", "p1"), path.join(UPLOAD_ROOT, "stores", A, "products", "p1"));
  assert.equal(uploadDirFor(reqA, "banners"), path.join(UPLOAD_ROOT, "stores", A, "banners"));
});

test("store comes from tenant context when req has none (socket / controller)", () => {
  runWithStore(B, () => {
    assert.equal(uploadDirFor(null, "store"), path.join(UPLOAD_ROOT, "stores", B, "store"));
  });
});

test("platform (no store): shared legacy folder", () => {
  assert.equal(uploadDirFor({}, "store-logos"), path.join(UPLOAD_ROOT, "store-logos"));
});

test("path traversal in kind / sub segments is rejected", () => {
  for (const bad of ["..", "../x", "a/b", "a\\b", "", "."]) {
    assert.throws(() => uploadDirFor(reqA, "products", bad), /Invalid upload path segment/, bad);
  }
  assert.throws(() => uploadDirFor({ store: { _id: "../" } }, "products"), /Invalid upload path segment/);
});

test("public URL is built from the saved file path", () => {
  const file = path.join(uploadDirFor(reqA, "deals"), "deal-1.webp");
  assert.equal(uploadUrlFor(file), `/uploads/stores/${A}/deals/deal-1.webp`);
  assert.throws(() => uploadUrlFor(path.join(UPLOAD_ROOT, "..", "server.js")), /outside the upload directory/);
});

test("delete path: own store file allowed (with or without leading slash)", () => {
  const own = `/uploads/stores/${A}/banners/b.webp`;
  assert.equal(localPathForUrl(reqA, own), path.join(UPLOAD_ROOT, "stores", A, "banners", "b.webp"));
  assert.equal(localPathForUrl(reqA, own.slice(1)), path.join(UPLOAD_ROOT, "stores", A, "banners", "b.webp"));
});

test("delete path: another store's file is refused", () => {
  assert.equal(localPathForUrl(reqA, `uploads/stores/${B}/banners/b.webp`), null);
  // Platform (koi store nahi) bhi kisi store ki file nahi mita sakta
  assert.equal(localPathForUrl({}, `uploads/stores/${B}/banners/b.webp`), null);
});

test("delete path: legacy shared files still resolve (old DB URLs)", () => {
  assert.equal(localPathForUrl(reqA, "/uploads/products/p1/x.jpg"), path.join(UPLOAD_ROOT, "products", "p1", "x.jpg"));
});

test("delete path: traversal / non-upload / absolute paths are refused", () => {
  for (const bad of [
    "uploads/../server.js",
    "/uploads/../../.env",
    `uploads/stores/${A}/../${B}/x.webp`,
    "/etc/passwd",
    "C:\\Windows\\win.ini",
    "uploads",
    "",
    null,
  ]) {
    assert.equal(localPathForUrl(reqA, bad), null, String(bad));
  }
});
