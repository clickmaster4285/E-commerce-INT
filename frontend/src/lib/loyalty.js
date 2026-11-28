// ==========================================================
// Loyalty math — backend/utils/loyaltyMath.js ka aaina (same formula).
// Sirf preview ke liye; order par aakhri hisaab server karta hai.
// ==========================================================

export function pointsForAmount(program, amount) {
  if (!program?.enabled || !program.earn?.enabled) return 0;
  const a = Math.max(0, Number(amount) || 0);
  const unit = Math.max(1, Number(program.earn.spendUnit) || 100);
  if (a <= 0 || a < (Number(program.earn.minOrderSubtotal) || 0)) return 0;
  return Math.floor(a / unit) * Math.floor(Number(program.earn.pointsPerUnit) || 0);
}

export function pointsToValue(program, points) {
  const r = program?.redeem || {};
  const per = Math.max(1, Number(r.redeemPoints) || 100);
  return Math.floor((Math.max(0, Number(points) || 0) * (Number(r.redeemValue) || 0)) / per);
}

/** Same rules as the server: balance, max % of subtotal, minimum points. */
export function quoteRedemption(program, { balance, subtotal, requested }) {
  const r = program?.redeem || {};
  const per = Math.max(1, Number(r.redeemPoints) || 100);
  const value = Math.max(0, Number(r.redeemValue) || 0);
  const minPoints = Math.max(0, Number(r.minPoints) || 0);
  const pct = Math.min(100, Math.max(1, Number(r.maxPercent) || 50));
  const bal = Math.max(0, Math.floor(Number(balance) || 0));
  const sub = Math.max(0, Number(subtotal) || 0);
  const want = Math.max(0, Math.floor(Number(requested) || 0));

  if (!program?.enabled || !r.enabled || value <= 0) return { ok: false, points: 0, discount: 0, maxPoints: 0, reason: "disabled" };
  const maxDiscount = Math.floor((sub * pct) / 100);
  const maxPoints = Math.min(bal, Math.floor((maxDiscount * per) / value));
  if (bal < minPoints) return { ok: false, points: 0, discount: 0, maxPoints, reason: "min_points" };
  if (want === 0) return { ok: false, points: 0, discount: 0, maxPoints, reason: "nothing" };
  if (maxPoints < minPoints || maxPoints <= 0) return { ok: false, points: 0, discount: 0, maxPoints, reason: "order_small" };
  const chosen = Math.max(minPoints, Math.min(want, maxPoints));
  const discount = Math.floor((chosen * value) / per);
  if (discount <= 0) return { ok: false, points: 0, discount: 0, maxPoints, reason: "order_small" };
  const needed = Math.ceil((discount * per) / value);
  const points = Math.min(chosen, Math.max(minPoints, needed));
  return { ok: true, points, discount, maxPoints, reason: "" };
}

