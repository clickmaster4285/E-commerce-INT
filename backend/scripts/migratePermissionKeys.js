// ==========================================================
// MIGRATE PERMISSION KEYS — purani Employee.permissions keys ko canonical keys me map karo
//   cd backend && node scripts/migratePermissionKeys.js           → sirf dikhata hai (dry run)
//   cd backend && node scripts/migratePermissionKeys.js --apply   → DB me likhta hai
// Mapping: newsletter → customers, categories → products, chat → orders
// Rule: deny jeetta hai — purani key false thi to canonical key false ho jati hai;
// warna canonical value jaisi thi waisi rehti hai (missing ho to purani value copy). Purani key $unset.
// ==========================================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const KEY_MAP = {
  newsletter: "customers",
  categories: "products",
  chat: "orders",
};

/**
 * Pure helper (test-friendly): ek permissions object ke liye $set / $unset nikalo.
 * @returns {{ set: object, unset: object } | null}  null = kuch badalna nahi
 */
function planPermissionMigration(permissions) {
  if (!permissions || typeof permissions !== "object") return null;
  const set = {};
  const unset = {};
  for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
    if (!Object.prototype.hasOwnProperty.call(permissions, oldKey)) continue;
    const oldVal = permissions[oldKey];
    const hasNew = Object.prototype.hasOwnProperty.call(permissions, newKey);
    const current = hasNew ? permissions[newKey] : undefined;
    const merged = hasNew && typeof current === "boolean" && typeof oldVal === "boolean"
      ? current && oldVal // deny wins
      : hasNew && typeof current === "boolean" ? current : oldVal;
    set[`permissions.${newKey}`] = merged;
    unset[`permissions.${oldKey}`] = "";
  }
  return Object.keys(unset).length ? { set, unset } : null;
}

async function run({ apply = false } = {}) {
  const mongoose = require("mongoose");
  const connectDB = require("../config/db");
  const Employee = require("../models/Employee");

  await connectDB();
  const oldKeys = Object.keys(KEY_MAP);
  // Cross-store (script platform-level hai) — raw collection se, tenantScope bypass
  const filter = { $or: oldKeys.map((k) => ({ [`permissions.${k}`]: { $exists: true } })) };
  const docs = await Employee.collection.find(filter, { projection: { permissions: 1, email: 1 } }).toArray();

  console.log(`${docs.length} employee(s) with legacy permission keys${apply ? "" : " (dry run — add --apply to save)"}`);
  const ops = [];
  for (const doc of docs) {
    const plan = planPermissionMigration(doc.permissions);
    if (!plan) continue;
    console.log(`- ${doc.email || doc._id}: set ${JSON.stringify(plan.set)} unset ${Object.keys(plan.unset).join(",")}`);
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: plan.set, $unset: plan.unset } } });
  }

  if (apply && ops.length) {
    const res = await Employee.collection.bulkWrite(ops, { ordered: false });
    console.log(`Updated ${res.modifiedCount} employee(s).`);
  }
  await mongoose.disconnect();
}

module.exports = { KEY_MAP, planPermissionMigration, run };

if (require.main === module) {
  run({ apply: process.argv.includes("--apply") }).catch((err) => {
    console.error("migratePermissionKeys failed:", err);
    process.exit(1);
  });
}
