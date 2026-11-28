// ==========================================================
// AUTH PAYLOAD CACHE — ek request me JWT sirf ek baar verify
// ----------------------------------------------------------
// rateLimit.roleOf (global limiter) aur authMiddleware dono token verify karte
// the. Ab jo pehle verify kare wo `req._authPayload` me { aud, raw, decoded }
// rakh deta hai; doosra sirf tab reuse karta hai jab SAME audience + SAME raw
// token ho. Secret / aud / typ ki verification kabhi skip nahi hoti — payload
// sirf verifyAccess() ke success par hi stash hota hai.
// ==========================================================

const { verifyAccess } = require("./tokens");

/** Token verify karo (cache hit par dobara crypto nahi); fail par verifyAccess ka error throw. */
function verifyAccessOnce(req, aud, raw) {
  const cached = req && req._authPayload;
  if (cached && cached.aud === aud && cached.raw === raw) return cached.decoded;
  const decoded = verifyAccess(aud, raw);
  if (req) req._authPayload = { aud, raw, decoded };
  return decoded;
}

module.exports = { verifyAccessOnce };
