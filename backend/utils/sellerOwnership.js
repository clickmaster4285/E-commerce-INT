// ==========================================================
// SELLER OWNERSHIP — "ek seller email, ek store" (Option A)
// ----------------------------------------------------------
// Employee email/username ab sirf store ke andar unique hain ({storeId, email}),
// yaani wahi email do stores me staff ho sakti hai. Lekin SELLER OWNER sirf ek
// store ka ho sakta hai — is se platform login (jahan store nahi hota) hamesha
// ek hi account par pahunchta hai.
//
// Owner kaun? SellerApplication (email globally unique) → uska store_id.
// Approved seller ka role "staff" hi rehta hai, is liye role se pehchan nahi.
// Purane / seeded admin (bina application) → role "admin" fallback.
// ==========================================================

const LIVE_APPLICATION = { $in: ["pending", "approved"] };
const normalize = (email) => String(email || "").toLowerCase().trim();

/** Ye email kisi store ka seller owner (live application ya admin) hai? */
async function sellerEmailTaken(email) {
  const SellerApplication = require("../models/SellerApplication");
  const Employee = require("../models/Employee");
  const e = normalize(email);
  if (await SellerApplication.exists({ email: e, status: LIVE_APPLICATION })) return true;
  const admin = await Employee.exists({ email: e, role: "admin", is_deleted: { $ne: true } })
    .setOptions({ skipTenantScope: true });
  return Boolean(admin);
}

/**
 * Platform login ke liye employee (koi store context nahi).
 * @returns {Promise<{ employee: object|null, ambiguous?: boolean }>}
 */
async function findPlatformEmployee(email) {
  const SellerApplication = require("../models/SellerApplication");
  const Employee = require("../models/Employee");
  const e = normalize(email);

  const app = await SellerApplication.findOne({ email: e, status: LIVE_APPLICATION, store_id: { $ne: null } })
    .select("store_id")
    .lean();
  if (app) {
    const employee = await Employee.findOne({ email: e, storeId: app.store_id })
      .select("+password -activities")
      .setOptions({ skipTenantScope: true });
    return { employee };
  }

  const admins = await Employee.find({ email: e, role: "admin", is_deleted: { $ne: true } })
    .select("+password -activities")
    .setOptions({ skipTenantScope: true })
    .limit(2);
  if (admins.length > 1) return { employee: null, ambiguous: true };
  return { employee: admins[0] || null };
}

const SELLER_EMAIL_TAKEN_MESSAGE =
  "This email already owns a store. Please sign in to your store or use a different email.";

module.exports = { sellerEmailTaken, findPlatformEmployee, SELLER_EMAIL_TAKEN_MESSAGE };
