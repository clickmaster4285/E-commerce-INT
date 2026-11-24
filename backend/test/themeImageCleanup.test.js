// Theme image cleanup — sirf unreferenced + purani files delete hon (temp folder, DB stub)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "theme-gc-"));
process.env.UPLOAD_DIR = path.relative(path.resolve(__dirname, ".."), tmpRoot);

const StoreTheme = require("../models/StoreTheme");
const StoreThemeVersion = require("../models/StoreThemeVersion");
const { cleanupStore, collectThemeFiles, GRACE_MS } = require("../utils/themeImageCleanup");

const STORE = String(new mongoose.Types.ObjectId());
const url = (name) => `/uploads/stores/${STORE}/theme/${name}`;
const chain = (value) => {
  const q = { select: () => q, setOptions: () => q, lean: async () => value };
  return q;
};

test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

test("collectThemeFiles finds nested image references for this store only", () => {
  const other = String(new mongoose.Types.ObjectId());
  const set = collectThemeFiles(
    { sections: { a: { settings: { image: url("theme_1_a.webp") } } }, list: [url("theme_2_b.webp"), `/uploads/stores/${other}/theme/theme_3_c.webp`] },
    STORE,
  );
  assert.deepEqual([...set].sort(), ["theme_1_a.webp", "theme_2_b.webp"]);
});

test("cleanupStore deletes only old, unreferenced theme files", async (t) => {
  const dir = path.join(tmpRoot, "stores", STORE, "theme");
  fs.mkdirSync(dir, { recursive: true });
  const old = Date.now() - GRACE_MS - 60_000;
  for (const name of ["theme_1_used.webp", "theme_2_version.webp", "theme_3_orphan.webp", "theme_4_fresh.webp", "notes.txt"]) {
    fs.writeFileSync(path.join(dir, name), "x");
    if (name !== "theme_4_fresh.webp") fs.utimesSync(path.join(dir, name), old / 1000, old / 1000);
  }

  const origFindOne = StoreTheme.findOne;
  const origFind = StoreThemeVersion.find;
  StoreTheme.findOne = () => chain({ draft: { a: url("theme_1_used.webp") }, published: null });
  StoreThemeVersion.find = () => chain([{ data: { b: url("theme_2_version.webp") } }]);
  t.after(() => {
    StoreTheme.findOne = origFindOne;
    StoreThemeVersion.find = origFind;
  });

  const { deleted } = await cleanupStore(STORE);
  assert.deepEqual(deleted, ["theme_3_orphan.webp"]);
  assert.deepEqual(fs.readdirSync(dir).sort(), ["notes.txt", "theme_1_used.webp", "theme_2_version.webp", "theme_4_fresh.webp"]);
});
