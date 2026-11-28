// ==========================================================
// PURGE STORE — soft-deleted store ka data hard-delete
// ----------------------------------------------------------
// Pehle SA soft-delete: Store.is_deleted = true.
// Phir offline:
//   node scripts/purgeStore.js --storeId <ObjectId>           → dry run
//   node scripts/purgeStore.js --storeId <ObjectId> --apply   → delete docs + uploads
//   ... --apply --hard-store                                 → Store doc bhi hatao
//
// APPLY deletes run inside withTx (§3.1) so a mid-purge failure rolls back
// document deletes. Uploads folder is removed only after the transaction commits.
// ==========================================================
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { withTx } = require("../utils/tx");
const { UPLOAD_ROOT } = require("../utils/uploadPaths");

const APPLY = process.argv.includes("--apply");
const HARD_STORE = process.argv.includes("--hard-store");
const idIdx = process.argv.indexOf("--storeId");
const STORE_ID_RAW = idIdx > -1 ? process.argv[idIdx + 1] : null;

(async () => {
  if (!STORE_ID_RAW || !mongoose.isValidObjectId(STORE_ID_RAW)) {
    console.error("Usage: node scripts/purgeStore.js --storeId <ObjectId> [--apply] [--hard-store]");
    process.exit(1);
  }
  const storeId = new mongoose.Types.ObjectId(STORE_ID_RAW);

  await connectDB();
  const modelsDir = path.join(__dirname, "..", "models");
  for (const file of fs.readdirSync(modelsDir)) {
    if (file.endsWith(".js")) require(path.join(modelsDir, file));
  }

  const Store = mongoose.model("Store");
  const store = await Store.findById(storeId).setOptions({ skipTenantScope: true }).lean();
  if (!store) {
    console.error(`Store ${storeId} not found.`);
    process.exit(1);
  }
  if (!store.is_deleted) {
    console.error(`Store ${storeId} is not soft-deleted (is_deleted=false). Soft-delete first.`);
    process.exit(1);
  }

  console.log(APPLY ? "APPLY mode" : "DRY RUN (add --apply to delete)");
  console.log(`Store: ${store.store_name || "(unnamed)"}  subdomain=${store.subdomain || "-"}`);

  const filter = { storeId };
  const summary = [];

  for (const name of mongoose.modelNames().sort()) {
    if (name === "Store") continue;
    const Model = mongoose.model(name);
    if (Model.schema.$tenantScopeField !== "storeId") continue;
    const count = await Model.countDocuments(filter).setOptions({ skipTenantScope: true });
    if (!count) continue;
    summary.push({ name, collection: Model.collection.name, count, Model });
  }

  if (mongoose.modelNames().includes("RefreshSession")) {
    const RefreshSession = mongoose.model("RefreshSession");
    const count = await RefreshSession.countDocuments(filter);
    if (count) {
      summary.push({ name: "RefreshSession", collection: RefreshSession.collection.name, count, Model: RefreshSession, skipTenant: true });
    }
  }

  if (APPLY) {
    await withTx(async () => {
      for (const row of summary) {
        const result = row.skipTenant
          ? await row.Model.deleteMany(filter)
          : await row.Model.deleteMany(filter).setOptions({ skipTenantScope: true });
        console.log(`  deleted ${result.deletedCount} from ${row.name} (${row.collection})`);
      }
      if (HARD_STORE) {
        await Store.deleteOne({ _id: storeId }).setOptions({ skipTenantScope: true });
        console.log("  hard-deleted Store document");
      }
    });
  } else {
    for (const row of summary) {
      console.log(`  would delete ${row.count} from ${row.name} (${row.collection})`);
    }
    if (HARD_STORE) console.log("  would hard-delete Store document");
  }

  const uploadDir = path.join(UPLOAD_ROOT, "stores", String(storeId));
  if (fs.existsSync(uploadDir)) {
    if (APPLY) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
      console.log(`  removed uploads folder ${uploadDir}`);
    } else {
      console.log(`  would remove uploads folder ${uploadDir}`);
    }
  } else {
    console.log(`  no uploads folder at ${uploadDir}`);
  }

  const total = summary.reduce((n, row) => n + row.count, 0);
  console.log(`\n${summary.length} collections, ${total} documents${APPLY ? " deleted" : " would be deleted"}.`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
