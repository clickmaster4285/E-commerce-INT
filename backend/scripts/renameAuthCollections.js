/**
 * Auth collections ke naye naam + super admin activity log hatao.
 *
 *   employees              → admin_users      (store admin panel logins — Employee model)
 *   users                  → customer_users   (platform + storefront accounts — User model)
 *   superadmins            → superadmin_users (Super Admin panel logins — SuperAdmin model)
 *   super_users            → superadmin_users (beech wala naam, agar pehle rename ho chuka ho)
 *   admin_super_users      → superadmin_users (current legacy name)
 *   superadmin_activities  → DROP (activity feature hata diya gaya)
 *
 * Rename me saara data + indexes saath jaate hain. Dry run default hai:
 *   node scripts/renameAuthCollections.js           # sirf batata hai kya hoga
 *   node scripts/renameAuthCollections.js --apply   # rename karta hai
 *   node scripts/renameAuthCollections.js --apply --drop-activity   # activity collection bhi drop
 * Dobara chalana safe hai — jo ho chuka woh skip hota hai.
 */
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");

const RENAMES = [
  ["employees", "admin_users"],
  ["users", "customer_users"],
  ["superadmins", "superadmin_users"],
  ["super_users", "superadmin_users"],
  ["admin_super_users", "superadmin_users"],
];
const DROP = "superadmin_activities";

const apply = process.argv.includes("--apply");
const dropActivity = process.argv.includes("--drop-activity");

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;
  if (!uri) throw new Error("Mongo connection string not found in .env");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const names = new Set((await db.listCollections().toArray()).map((c) => c.name));
  console.log(apply ? "APPLY mode" : "DRY RUN (add --apply to make changes)");

  for (const [from, to] of RENAMES) {
    const hasFrom = names.has(from);
    const hasTo = names.has(to);
    const count = hasFrom ? await db.collection(from).countDocuments() : 0;
    if (!hasFrom && hasTo) { console.log(`✓ ${to} already exists (${from} gone) — skipped`); continue; }
    if (!hasFrom) { console.log(`- ${from} not found — skipped`); continue; }
    if (hasTo) {
      const toCount = await db.collection(to).countDocuments();
      console.log(`✗ ${from} (${count}) AND ${to} (${toCount}) both exist — not touching; resolve manually`);
      continue;
    }
    console.log(`${apply ? "→" : "would rename"} ${from} (${count} docs) → ${to}`);
    if (apply) await db.collection(from).rename(to);
  }

  if (names.has(DROP)) {
    const count = await db.collection(DROP).countDocuments();
    if (apply && dropActivity) { await db.collection(DROP).drop(); console.log(`→ dropped ${DROP} (${count} docs)`); }
    else console.log(`${DROP} (${count} docs) — ${dropActivity ? "would drop" : "kept (pass --drop-activity to drop)"}`);
  } else console.log(`- ${DROP} not found`);

  await mongoose.disconnect();
})().catch((e) => { console.error("Failed:", e.message); process.exit(1); });
