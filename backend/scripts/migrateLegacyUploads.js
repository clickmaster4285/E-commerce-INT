// ==========================================================
// MIGRATE LEGACY UPLOADS — uploads/<kind>/<id>/* → uploads/stores/<storeId>/<kind>/<id>/* (§6.4)
// ----------------------------------------------------------
//   node scripts/migrateLegacyUploads.js              → dry run (plan print)
//   node scripts/migrateLegacyUploads.js --apply      → files COPY karo (legacy files ABHI delete nahi)
//   node scripts/migrateLegacyUploads.js --apply --move   → copy ke baad legacy file hata do
//   --map=<file.json>   → old URL → new URL mapping likho (default: uploads-migration-map.json, sirf --apply)
//
// Sirf wahi folders migrate hote hain jinka owner id folder-naam me hai (<kind>/<docId>/...):
//   bundles → Bundle, products → Product, reviews → Product, brands → Brand
// Flat folders (store, banners, deals, store-logos ...) ka owner folder se pata nahi chalta →
// "unresolved" list me aate hain (manual / DB url se match karna padega).
//
// ⚠️ DB me files ke URLs (/uploads/bundles/<id>/x.webp) abhi RAAT-KE-RAAT nahi badalte:
// isliye default COPY hai (purane URLs chalte rehte hain). --move tabhi use karo jab mapping
// file se DB URLs rewrite kar chuke ho. Server startup ab legacy folders banata nahi.
// ==========================================================
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const APPLY = process.argv.includes("--apply");
const MOVE = process.argv.includes("--move");
const mapArg = process.argv.find((a) => a.startsWith("--map="));

// kind → model file (owner doc se storeId)
const OWNERS = {
  bundles: "Bundle",
  products: "Product",
  reviews: "Product", // legacy reviews/<productId>/
  brands: "Brand",
};

/** Pure planner (tests): legacy root scan → [{ kind, id, from, to? , reason? }] — DB lookup `resolveStoreId` se */
async function planMigration({ uploadRoot, resolveStoreId }) {
  const plan = [];
  const unresolved = [];
  for (const kind of fs.existsSync(uploadRoot) ? fs.readdirSync(uploadRoot) : []) {
    if (kind === "stores" || kind === "documents") continue;
    const kindDir = path.join(uploadRoot, kind);
    if (!fs.statSync(kindDir).isDirectory()) continue;
    const owner = OWNERS[kind];
    for (const entry of fs.readdirSync(kindDir, { withFileTypes: true })) {
      if (!owner || !entry.isDirectory()) {
        unresolved.push({ path: path.join(kind, entry.name), reason: owner ? "not a folder" : "flat/unknown kind" });
        continue;
      }
      const storeId = await resolveStoreId(owner, entry.name);
      if (!storeId) {
        unresolved.push({ path: path.join(kind, entry.name), reason: "owner not found" });
        continue;
      }
      const idDir = path.join(kindDir, entry.name);
      for (const file of fs.readdirSync(idDir, { withFileTypes: true })) {
        if (!file.isFile()) continue;
        plan.push({
          kind, id: entry.name,
          from: path.join(idDir, file.name),
          to: path.join(uploadRoot, "stores", String(storeId), kind, entry.name, file.name),
        });
      }
    }
  }
  return { plan, unresolved };
}

async function main() {
  const mongoose = require("mongoose");
  const connectDB = require("../config/db");
  const { UPLOAD_ROOT } = require("../utils/uploadPaths");
  await connectDB();
  const modelsDir = path.join(__dirname, "..", "models");
  for (const file of fs.readdirSync(modelsDir)) require(path.join(modelsDir, file));
  const { runUnscoped } = require("../utils/tenantContext");

  const resolveStoreId = (owner, id) =>
    mongoose.Types.ObjectId.isValid(id)
      ? runUnscoped(() =>
          mongoose.model(owner).findById(id).select("storeId").setOptions({ skipTenantScope: true }).lean(),
        ).then((doc) => doc?.storeId || null)
      : null;

  console.log(APPLY ? `APPLY mode${MOVE ? " (move)" : " (copy)"}` : "DRY RUN (add --apply to copy files)");
  const { plan, unresolved } = await planMigration({ uploadRoot: UPLOAD_ROOT, resolveStoreId });

  const urlOf = (abs) => `/uploads/${path.relative(UPLOAD_ROOT, abs).split(path.sep).join("/")}`;
  const mapping = {};
  for (const item of plan) {
    console.log(`  ${urlOf(item.from)}  →  ${urlOf(item.to)}`);
    mapping[urlOf(item.from)] = urlOf(item.to);
    if (!APPLY) continue;
    fs.mkdirSync(path.dirname(item.to), { recursive: true });
    if (!fs.existsSync(item.to)) fs.copyFileSync(item.from, item.to);
    if (MOVE) fs.unlinkSync(item.from);
  }
  console.log(`\n${plan.length} file(s) planned, ${unresolved.length} unresolved`);
  for (const u of unresolved) console.log(`  ? ${u.path} (${u.reason})`);

  if (APPLY) {
    const out = path.resolve(mapArg ? mapArg.slice(6) : path.join(__dirname, "..", "uploads-migration-map.json"));
    fs.writeFileSync(out, JSON.stringify(mapping, null, 2));
    console.log(`URL mapping: ${out}`);
  }
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { planMigration, OWNERS };
