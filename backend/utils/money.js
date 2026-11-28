// ==========================================================
// MONEY — integer minor units (paisa/cents), optimizeplan §3.9
// ----------------------------------------------------------
// Floats mat use karo. Har amount_minor integer hai; major sirf display.
const { roundMoney } = require("./roundMoney");

const CURRENCY_DECIMALS = {
  PKR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  SAR: 2,
  INR: 2,
};

function decimalsFor(currency = "PKR") {
  const code = String(currency || "PKR").toUpperCase();
  return CURRENCY_DECIMALS[code] ?? 2;
}

/** Major (float/string) → minor integer (half-up). */
function toMinor(amount, currency = "PKR") {
  const d = decimalsFor(currency);
  const factor = 10 ** d;
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * factor);
}

/** Minor integer → major number. */
function fromMinor(minor, currency = "PKR") {
  const d = decimalsFor(currency);
  const factor = 10 ** d;
  return (Number(minor) || 0) / factor;
}

function add(...minors) {
  return minors.reduce((sum, m) => sum + (Number(m) || 0), 0);
}

/** qty can be fractional for weight later — round to nearest minor. */
function mul(minor, qty) {
  return Math.round((Number(minor) || 0) * (Number(qty) || 0));
}

/** ratePercent e.g. 17.5 → half-up of minor * rate/100 */
function pct(minor, ratePercent) {
  const rate = Number(ratePercent) || 0;
  return Math.round(((Number(minor) || 0) * rate) / 100);
}

/**
 * Split totalMinor across parts (weights). Largest-remainder so sum === total.
 * @param {number} totalMinor
 * @param {number[]} parts — non-negative weights (e.g. line prices)
 * @returns {number[]}
 */
function allocate(totalMinor, parts) {
  const total = Number(totalMinor) || 0;
  const weights = (Array.isArray(parts) ? parts : []).map((w) => Math.max(0, Number(w) || 0));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (!weights.length) return [];
  if (weightSum <= 0) return weights.map(() => 0);

  const raw = weights.map((w) => (total * w) / weightSum);
  const floors = raw.map((x) => Math.floor(x));
  let rem = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  const out = floors.slice();
  for (let k = 0; k < order.length && rem > 0; k += 1) {
    out[order[k].i] += 1;
    rem -= 1;
  }
  return out;
}

/** Display helper — major rounded half-up 2dp (legacy roundMoney). */
function toMajorDisplay(minor, currency = "PKR") {
  return roundMoney(fromMinor(minor, currency));
}

module.exports = {
  CURRENCY_DECIMALS,
  decimalsFor,
  toMinor,
  fromMinor,
  add,
  mul,
  pct,
  allocate,
  toMajorDisplay,
  roundMoney,
};
