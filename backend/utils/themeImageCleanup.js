// ==========================================================
// THEME IMAGE CLEANUP — store editor ki bekaar images (nightly)
// ----------------------------------------------------------
// Theme save par purani image kabhi delete NAHI hoti (published theme ya
// koi version abhi bhi use kar sakta hai). Ye job har store ke
// uploads/stores/<storeId>/theme/ folder me se sirf woh files hatata hai jo:
//   • draft, published, ya kisi saved version (aakhri 20) me referenced NAHI, aur
//   • GRACE_MS se purani hain (abhi upload hui, abhi save nahi hui → safe)
// runUnscoped: saare stores ek sweep me; har store ka data apne storeId se.
// ==========================================================

const fs = require("fs/promises");
const path = require("path");
const cron = require("node-cron");
const StoreTheme = require("../models/StoreTheme");
const StoreThemeVersion = require("../models/StoreThemeVersion");
const { runUnscoped } = require("./tenantContext");
const { withLeaderLock } = require("./leaderLock");
const { UPLOAD_ROOT } = require("./uploadPaths");

const GRACE_MS = 24 * 60 * 60 * 1000;
// theme_<ts>_<hex>.webp (purana) + theme-<ts>-<hex>.webp (createImageUpload factory)
const SAFE_FILE = /^theme[_-][A-Za-z0-9_-]+\.webp$/;

/** Theme JSON me jitni bhi "/uploads/stores/<id>/theme/<file>" strings hain */
function collectThemeFiles(value, storeId, out = new Set()) {
  if (typeof value === "string") {
    const prefix = `/uploads/stores/${storeId}/theme/`;
    if (value.startsWith(prefix)) out.add(value.slice(prefix.length));
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectThemeFiles(v, storeId, out));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collectThemeFiles(v, storeId, out));
  }
  return out;
}

/** Ek store ki unused theme files — { deleted, kept } */
async function cleanupStore(storeId, { now = Date.now(), dryRun = false } = {}) {
  const id = String(storeId);
  const dir = path.join(UPLOAD_ROOT, "stores", id, "theme");
  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    return { deleted: [], kept: 0 }; // folder hi nahi
  }

  const theme = await StoreTheme.findOne({ storeId }).select("draft published").setOptions({ skipTenantScope: true }).lean(); // cleanup job: explicit storeId, saare stores sweep
  const versions = await StoreThemeVersion.find({ storeId }).select("data").setOptions({ skipTenantScope: true }).lean(); // cleanup job: explicit storeId, saare stores sweep
  const used = collectThemeFiles([theme?.draft, theme?.published, ...versions.map((v) => v.data)], id);

  const deleted = [];
  let kept = 0;
  for (const name of files) {
    if (!SAFE_FILE.test(name) || used.has(name)) {
      kept += 1;
      continue;
    }
    const full = path.join(dir, name);
    const stat = await fs.stat(full).catch(() => null);
    if (!stat?.isFile() || now - stat.mtimeMs < GRACE_MS) {
      kept += 1;
      continue;
    }
    if (!dryRun) await fs.unlink(full).catch(() => {});
    deleted.push(name);
  }
  return { deleted, kept };
}

let running = false;
async function runOnce(opts = {}) {
  if (running) return null;
  running = true;
  try {
    return await runUnscoped(async () => {
      const storeIds = await StoreTheme.distinct("storeId").setOptions({ skipTenantScope: true }); // cleanup job: explicit storeId, saare stores sweep
      let total = 0;
      for (const storeId of storeIds) {
        // eslint-disable-next-line no-await-in-loop
        const { deleted } = await cleanupStore(storeId, opts);
        total += deleted.length;
      }
      return total;
    });
  } catch (error) {
    console.error("[themeImageCleanup] failed:", error.message);
    return null;
  } finally {
    running = false;
  }
}

let task = null;
function start() {
  if (task) return task;
  // Roz raat 03:30 (server time)
  task = cron.schedule("30 3 * * *", () => withLeaderLock("themeImageCleanup", () => runOnce()));
  return task;
}

module.exports = { start, runOnce, cleanupStore, collectThemeFiles, GRACE_MS };
