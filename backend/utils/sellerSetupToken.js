// ==========================================================
// SELLER SETUP TOKEN — /store-setup link ki pehchan
// ----------------------------------------------------------
// Pehle /store-setup?email=... aur complete-setup sirf EMAIL se application
// dhoondte the → koi bhi kisi applicant ki email daal kar uski details (naam,
// address, documents) dekh / badal sakta tha. Ab email me signed link jata hai:
//   /store-setup?token=<jwt { type: "seller_setup", appId, email }>
// Token JWT_SECRET se sign (handoff jaisa purpose-token), SELLER_SETUP_LINK_DAYS
// (default 7) din valid. Application ka email token se match hona zaroori.
// ==========================================================

const jwt = require("jsonwebtoken");

const TYPE = "seller_setup";
const normalize = (email) => String(email || "").toLowerCase().trim();

function linkDays() {
  const days = Number(process.env.SELLER_SETUP_LINK_DAYS);
  return Number.isFinite(days) && days > 0 ? days : 7;
}

function signSetupToken(application) {
  return jwt.sign(
    { type: TYPE, appId: String(application._id), email: normalize(application.email) },
    process.env.JWT_SECRET,
    { expiresIn: `${linkDays()}d` },
  );
}

/**
 * Token → SellerApplication (ya null). Galat / expire / dusre purpose ka token,
 * application na mile, ya email badal gayi ho → null.
 * @param {object} [opts] { select, lean, SellerApplication (tests) }
 */
async function findApplicationForToken(token, opts = {}) {
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(String(token), process.env.JWT_SECRET);
  } catch {
    return null;
  }
  if (payload?.type !== TYPE || !payload.appId) return null;

  const SellerApplication = opts.SellerApplication || require("../models/SellerApplication");
  let query = SellerApplication.findById(payload.appId);
  if (opts.select) query = query.select(opts.select);
  if (opts.lean) query = query.lean();
  let application;
  try {
    application = await query;
  } catch {
    return null; // invalid ObjectId waghera
  }
  if (!application || normalize(application.email) !== normalize(payload.email)) return null;
  return application;
}

const INVALID_SETUP_LINK = "This setup link is invalid or has expired. Please use the link from your latest email.";

module.exports = { signSetupToken, findApplicationForToken, INVALID_SETUP_LINK, SETUP_TOKEN_TYPE: TYPE };
