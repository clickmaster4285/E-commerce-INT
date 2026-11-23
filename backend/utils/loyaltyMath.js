// ==========================================================
// LOYALTY MATH — pure functions (DB nahi), tests isi ko check karte hain.
// Frontend checkout bhi yahi formula use karta hai (src/lib/loyalty.js),
// lekin aakhri faisla hamesha server ka hai.
// ==========================================================

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Settings ko safe defaults ke saath normalize karo (DB doc ya plain object). */
function normalizeSettings(raw = {}) {
  const s = raw || {};
  return {
    enabled: Boolean(s.enabled),
    programName: String(s.programName || "Rewards"),
    earn: {
      enabled: s.earn?.enabled !== false,
      pointsPerUnit: Math.max(0, num(s.earn?.pointsPerUnit, 1)),
      spendUnit: Math.max(1, num(s.earn?.spendUnit, 100)),
      minOrderSubtotal: Math.max(0, num(s.earn?.minOrderSubtotal, 0)),
    },
    signupBonus: {
      enabled: s.signupBonus?.enabled !== false,
      points: Math.max(0, Math.floor(num(s.signupBonus?.points, 100))),
    },
    redeem: {
      enabled: s.redeem?.enabled !== false,
      redeemPoints: Math.max(1, num(s.redeem?.redeemPoints, 100)),
      redeemValue: Math.max(0, num(s.redeem?.redeemValue, 10)),
      minPoints: Math.max(0, Math.floor(num(s.redeem?.minPoints, 100))),
      maxPercent: Math.min(100, Math.max(1, num(s.redeem?.maxPercent, 50))),
    },
  };
}

/** Order ke amount par kitne points banenge (pending → delivery par available). */
function pointsForAmount(settings, amount) {
  const s = normalizeSettings(settings);
  if (!s.enabled || !s.earn.enabled) return 0;
  const a = Math.max(0, num(amount));
  if (a <= 0 || a < s.earn.minOrderSubtotal) return 0;
  return Math.floor(a / s.earn.spendUnit) * Math.floor(s.earn.pointsPerUnit);
}

/** Points → rupay (hamesha neeche round, poore rupay). */
function pointsToValue(settings, points) {
  const s = normalizeSettings(settings);
  return Math.floor((Math.max(0, num(points)) * s.redeem.redeemValue) / s.redeem.redeemPoints);
}

/**
 * Checkout par kitne points lag sakte hain.
 * Returns { ok, points, discount, maxPoints, reason }
 *   maxPoints → is order par zyada se zyada (balance + order limit dono)
 *   reason    → ok false ho to: disabled | min_points | nothing
 */
function quoteRedemption(settings, { balance, subtotal, requested }) {
  const s = normalizeSettings(settings);
  const bal = Math.max(0, Math.floor(num(balance)));
  const sub = Math.max(0, num(subtotal));
  const want = Math.max(0, Math.floor(num(requested)));

  if (!s.enabled || !s.redeem.enabled || s.redeem.redeemValue <= 0) {
    return { ok: false, points: 0, discount: 0, maxPoints: 0, reason: "disabled" };
  }

  // Order ka zyada se zyada `maxPercent` points se, aur subtotal se upar kabhi nahi
  const maxDiscount = Math.floor((sub * s.redeem.maxPercent) / 100);
  const maxPointsByOrder = Math.floor((maxDiscount * s.redeem.redeemPoints) / s.redeem.redeemValue);
  const maxPoints = Math.min(bal, maxPointsByOrder);

  if (bal < s.redeem.minPoints) {
    return { ok: false, points: 0, discount: 0, maxPoints, reason: "min_points" };
  }
  if (want === 0) return { ok: false, points: 0, discount: 0, maxPoints, reason: "nothing" };

  let points = Math.min(want, maxPoints);
  const discount = Math.floor((points * s.redeem.redeemValue) / s.redeem.redeemPoints);
  if (discount <= 0) return { ok: false, points: 0, discount: 0, maxPoints, reason: "nothing" };
  // Sirf utne points kaato jitne is discount ke liye chahiye (rounding me points zaya na hon)
  points = Math.ceil((discount * s.redeem.redeemPoints) / s.redeem.redeemValue);
  if (points < s.redeem.minPoints) {
    return { ok: false, points: 0, discount: 0, maxPoints, reason: "min_points" };
  }
  return { ok: true, points, discount, maxPoints, reason: "" };
}

module.exports = { normalizeSettings, pointsForAmount, pointsToValue, quoteRedemption };
