// ==========================================================
// FIX SELLER OWNER ROLE — store owner employees ko "storehandler" banao
// ----------------------------------------------------------
// Pehle seller signup par owner ka Employee record role: "staff" se banta tha
// aur approval par bhi role change nahi hota tha. Ab signup/approval dono
// "storehandler" set karte hain; ye script purane records theek karti hai.
//
// Owner = wo Employee jiska email + storeId kisi SellerApplication se match ho.
//
//   node scripts/fixSellerOwnerRole.js           → dry run (sirf report)
//   node scripts/fixSellerOwnerRole.js --apply   → role: "storehandler" set karo
// ==========================================================
const path = require("path");
const { OWNER_ROLE, ADMIN_ROLES, STAFF_ROLES, ASSIGNABLE_ROLES, isOwnerRole, isAdminRole, isStaffRole } = require("../utils/roles");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Employee = require("../models/Employee");
const SellerApplication = require("../models/SellerApplication");

const APPLY = process.argv.includes("--apply");
const CROSS_STORE = { skipTenantScope: true }; // one-off fix script: cross-store

(async () => {
  await connectDB();

  const apps = await SellerApplication.find({ store_id: { $ne: null } })
    .select("email store_id store_name status")
    .setOptions(CROSS_STORE)
    .lean();

  const fixes = [];
  for (const app of apps) {
    const owner = await Employee.findOne({ email: app.email, storeId: app.store_id, is_deleted: { $ne: true } })
      .select("name email role storeId")
      .setOptions(CROSS_STORE)
      .lean();
    if (owner && owner.role !== OWNER_ROLE) fixes.push({ owner, app });
  }

  if (!fixes.length) {
    console.log(`All store owners already have role "${OWNER_ROLE}". Nothing to do.`);
  } else {
    for (const { owner, app } of fixes) {
      console.log(`${APPLY ? "FIX " : "WOULD FIX "}${owner.email}  (${app.store_name}, application ${app.status})  role: ${owner.role} → ${OWNER_ROLE}`);
      if (APPLY) {
        await Employee.updateOne({ _id: owner._id }, { $set: { role: OWNER_ROLE } }).setOptions(CROSS_STORE);
      }
    }
    console.log(`\n${fixes.length} owner${fixes.length === 1 ? "" : "s"} ${APPLY ? "updated" : "need updating — re-run with --apply"}.`);
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error("fixSellerOwnerRole failed:", err.message);
  process.exit(1);
});
