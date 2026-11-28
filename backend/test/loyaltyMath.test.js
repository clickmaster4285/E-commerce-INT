const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeSettings, pointsForAmount, pointsToValue, quoteRedemption } = require("../utils/loyaltyMath");

const on = (over = {}) => ({ enabled: true, ...over });

test("defaults: 1 point per Rs 100, 100 points = Rs 10, 50% cap, min 100", () => {
  const s = normalizeSettings({ enabled: true });
  assert.equal(s.earn.pointsPerUnit, 1);
  assert.equal(s.earn.spendUnit, 100);
  assert.equal(s.redeem.redeemPoints, 100);
  assert.equal(s.redeem.redeemValue, 10);
  assert.equal(s.redeem.maxPercent, 50);
  assert.equal(s.redeem.minPoints, 100);
});

test("earning rounds down per whole spend unit", () => {
  assert.equal(pointsForAmount(on(), 0), 0);
  assert.equal(pointsForAmount(on(), 99), 0);
  assert.equal(pointsForAmount(on(), 250), 2);
  assert.equal(pointsForAmount(on({ earn: { pointsPerUnit: 5, spendUnit: 100 } }), 1999), 95);
});

test("no points when program or earning is off, or below minimum order", () => {
  assert.equal(pointsForAmount({ enabled: false }, 5000), 0);
  assert.equal(pointsForAmount(on({ earn: { enabled: false } }), 5000), 0);
  assert.equal(pointsForAmount(on({ earn: { minOrderSubtotal: 1000 } }), 999), 0);
  assert.equal(pointsForAmount(on({ earn: { minOrderSubtotal: 1000 } }), 1000), 10);
});

test("points to value rounds down to whole rupees", () => {
  assert.equal(pointsToValue(on(), 100), 10);
  assert.equal(pointsToValue(on(), 159), 15);
});

test("redemption is capped by balance", () => {
  const q = quoteRedemption(on(), { balance: 300, subtotal: 10000, requested: 1000 });
  assert.equal(q.ok, true);
  assert.equal(q.points, 300);
  assert.equal(q.discount, 30);
  assert.equal(q.maxPoints, 300);
});

test("redemption is capped by max percent of subtotal", () => {
  // subtotal 1000, 50% → Rs 500 max → 5000 points max
  const q = quoteRedemption(on(), { balance: 9000, subtotal: 1000, requested: 9000 });
  assert.equal(q.discount, 500);
  assert.equal(q.points, 5000);
  assert.equal(q.maxPoints, 5000);
});

test("redemption never charges points that buy nothing", () => {
  // 155 points → Rs 15 → only 150 points charged
  const q = quoteRedemption(on(), { balance: 1000, subtotal: 10000, requested: 155 });
  assert.equal(q.discount, 15);
  assert.equal(q.points, 150);
});

test("redemption requires minimum balance", () => {
  const q = quoteRedemption(on(), { balance: 99, subtotal: 10000, requested: 99 });
  assert.equal(q.ok, false);
  assert.equal(q.reason, "min_points");
});

test("redemption refused when program or redeeming is off", () => {
  assert.equal(quoteRedemption({ enabled: false }, { balance: 500, subtotal: 1000, requested: 100 }).reason, "disabled");
  assert.equal(quoteRedemption(on({ redeem: { enabled: false } }), { balance: 500, subtotal: 1000, requested: 100 }).reason, "disabled");
});

test("bad input never produces negative or fractional points", () => {
  const q = quoteRedemption(on(), { balance: -50, subtotal: "abc", requested: -10 });
  assert.equal(q.ok, false);
  assert.equal(q.points, 0);
  assert.equal(q.discount, 0);
});

test("balance exactly at minimum still redeems when rounding would drop below it", () => {
  // 99 points = Rs 10, min 100: 100 points → Rs 10; rounding wants 99 but min is 100
  const s = on({ redeem: { redeemPoints: 99, redeemValue: 10, minPoints: 100, maxPercent: 50 } });
  const q = quoteRedemption(s, { balance: 100, subtotal: 50000, requested: 100 });
  assert.equal(q.ok, true);
  assert.equal(q.points, 100);
  assert.equal(q.discount, 10);
});

test("order too small for the minimum reports order_small", () => {
  // subtotal 100 → 50% = Rs 50 → max 500 points, but min is 1000
  const q = quoteRedemption(on({ redeem: { minPoints: 1000 } }), { balance: 5000, subtotal: 100, requested: 5000 });
  assert.equal(q.ok, false);
  assert.equal(q.reason, "order_small");
});
