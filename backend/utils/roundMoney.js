// Paisay half-up 2 decimals (optimizeplan §8.2 / §3.9)
// Canonical math ab utils/money.js me hai — ye thin re-export hai.
function roundMoney(value) {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;
}

module.exports = { roundMoney };