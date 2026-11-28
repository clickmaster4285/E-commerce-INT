const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const { createImageUpload, processImage, sniffType } = require("../middleware/imageUpload");

const pngFixture = () =>
  sharp({ create: { width: 8, height: 4, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();

test("processImage rejects svg", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
  await assert.rejects(() => processImage(svg), { code: "INVALID_IMAGE" });
});

test("processImage rejects non-image bytes and corrupt image", async () => {
  await assert.rejects(() => processImage(Buffer.from("<html><script>alert(1)</script></html>")), { code: "INVALID_IMAGE" });
  const png = await pngFixture();
  await assert.rejects(() => processImage(Buffer.concat([png.subarray(0, 20), Buffer.alloc(30, 1)])), { code: "INVALID_IMAGE" });
});

test("processImage accepts png and returns webp", async () => {
  const out = await processImage(await pngFixture(), { resize: { w: 4, fit: "inside" } });
  assert.equal(sniffType(out.buffer), "webp");
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(out.mimeType, "image/webp");
  assert.equal(out.width, 4);
  assert.equal(out.height, 2);
});

test("createImageUpload returns middleware and validates config", () => {
  assert.equal(typeof createImageUpload, "function");
  const mw = createImageUpload({ fields: "image", kind: "deals" });
  assert.equal(typeof mw, "function");
  assert.equal(mw.length, 3);
  assert.throws(() => createImageUpload({ kind: "x" }));
  assert.throws(() => createImageUpload({ fields: "image" }));
});

test("migrated pilots use the factory", () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
  assert.match(read("middleware/dealImageMiddleware.js"), /createImageUpload/);
  assert.match(read("middleware/uploadMiddleware.js"), /createImageUpload/);
  assert.match(read("routes/storeRoutes.js"), /createImageUpload/);
});
