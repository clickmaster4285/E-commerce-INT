// ==========================================================
// MIGRATE AVATARS (§3.6) — User/Employee.avatar data URL → file URL
//   node scripts/migrateAvatars.js          → dry run (sirf list)
//   node scripts/migrateAvatars.js --apply  → files likho + DB me URL set
// ==========================================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Employee = require("../models/Employee");
const { persistAvatar } = require("../utils/avatarFiles");

const APPLY = process.argv.includes("--apply");

(async () => {
  await connectDB();
  console.log(APPLY ? "APPLY mode" : "DRY RUN (add --apply to change the DB)");
  let total = 0;
  let bytes = 0;
  for (const [name, Model] of [["Employee", Employee], ["User", User]]) {
    const docs = await Model.find({ avatar: { $regex: /^data:image\//i } })
      .setOptions({ skipTenantScope: true })
      .select("_id storeId avatar")
      .lean();
    console.log(`${name}: ${docs.length} doc(s) with data:image avatar`);
    for (const doc of docs) {
      total += 1;
      bytes += doc.avatar.length;
      console.log(`  ${name} ${doc._id} store=${doc.storeId || "-"} ~${Math.round(doc.avatar.length / 1024)}KB`);
      if (!APPLY) continue;
      try {
        const url = await persistAvatar({ store: doc.storeId ? { _id: doc.storeId } : null }, doc.avatar);
        await Model.collection.updateOne({ _id: doc._id }, { $set: { avatar: url } });
      } catch (err) {
        console.error(`  ! ${doc._id}: ${err.message}`);
      }
    }
  }
  console.log(`Total ${total} doc(s), ~${Math.round(bytes / 1024)}KB inline`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
