// Paisay half-up 2 decimals (optimizeplan §8.2)
function roundMoney(value) {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;
}

module.exports = { roundMoney };