// ==========================================================
// BACKFILL Address.storeId from User (§3.6 / §3.3)
// ----------------------------------------------------------
// Purane Address rows jinke paas storeId nahi — user_id se User.storeId copy.
//
//   node scripts/backfillAddressStoreId.js              → dry run
//   node scripts/backfillAddressStoreId.js --apply      → write
// ==========================================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
require("../models/Address");
require("../models/User");

const APPLY = process.argv.includes("--apply");

(async () => {
  await connectDB();
  const Address = mongoose.model("Address");
  const User = mongoose.model("User");

  console.log(APPLY ? "APPLY mode" : "DRY RUN (add --apply to write)");

  const orphans = await Address.find({
    $or: [{ storeId: null }, { storeId: { $exists: false } }],
  })
    .select("_id user_id")
    .lean();

  if (!orphans.length) {
    console.log("No Address rows without storeId.");
    await mongoose.disconnect();
    return;
  }

  const userIds = [...new Set(orphans.map((a) => String(a.user_id)).filter(Boolean))];
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id storeId")
    .setOptions({ skipTenantScope: true })
    .lean();
  const storeByUser = new Map(users.map((u) => [String(u._id), u.storeId]));

  let assignable = 0;
  let missingUser = 0;
  const byStore = new Map();

  for (const addr of orphans) {
    const storeId = storeByUser.get(String(addr.user_id));
    if (!storeId) {
      missingUser += 1;
      continue;
    }
    assignable += 1;
    const key = String(storeId);
    if (!byStore.has(key)) byStore.set(key, []);
    byStore.get(key).push(addr._id);
  }

  console.log(`  orphans: ${orphans.length}`);
  console.log(`  assignable from User.storeId: ${assignable}`);
  if (missingUser) console.log(`  no User.storeId (skipped): ${missingUser}`);

  if (APPLY) {
    let modified = 0;
    for (const [storeId, ids] of byStore) {
      const res = await Address.updateMany(
        { _id: { $in: ids } },
        { $set: { storeId } },
      ).setOptions({ skipTenantScope: true });
      modified += res.modifiedCount;
    }
    console.log(`  modified: ${modified}`);
  }

  await mongoose.disconnect();
  console.log(APPLY ? "Done." : "\nNothing changed.");
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
