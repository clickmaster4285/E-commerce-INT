// ==========================================================
// BUNDLE RULES — server copy of frontend/src/utils/bundleCalculator.js
// (sirf woh functions jo price par asar dalte hain; labels frontend me).
// Parity: test/pricingParity.test.js.
// ==========================================================

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const round6 = (value) => Math.round((Number(value) || 0) * 1e6) / 1e6;
const REWARD_TYPES = ["percentage", "fixed_amount", "free_product"];

function normalizeBundleRule(rule) {
  const raw = Array.isArray(rule) ? rule[0] : rule;
  if (!raw || typeof raw !== "object") return null;
  const mode = raw.mode === "limit" || raw.limit === true ? "limit" : "all";
  const buyQuantity = Math.max(0, Math.floor(Number(raw.buyQuantity ?? raw.buy_quantity) || 0));
  const rawType = raw.rewardType ?? raw.reward_type;
  const rewardType = REWARD_TYPES.includes(rawType) ? rawType : "percentage";
  let value = Math.max(0, Number(raw.value) || 0);
  if (rewardType === "percentage") value = Math.min(100, value);
  if (rewardType === "free_product") value = 0;
  const gift = typeof raw.freeProduct === "object" && raw.freeProduct ? raw.freeProduct : null;
  const freeProductId = String(gift?._id || gift?.id || raw.freeProduct || raw.free_product || raw.freeProductId || "");
  if (rewardType === "free_product" && !freeProductId) return null;
  if (rewardType !== "free_product" && value <= 0) return null;
  if (mode === "limit" && buyQuantity <= 0) return null;
  return {
    mode,
    buyQuantity,
    rewardType,
    value,
    freeProductId,
    freeProductVariantId: String(raw.freeProductVariantId ?? raw.free_product_variant_id ?? ""),
    freeQuantity: Math.max(1, Math.floor(Number(raw.freeQuantity ?? raw.free_quantity) || 1)),
  };
}

function bundleRuleRequiredQty(rule, productCount) {
  if (!rule) return 0;
  const count = Math.max(1, Math.floor(Number(productCount) || 0) || 1);
  if (rule.mode === "limit") return Math.max(1, Math.floor(Number(rule.buyQuantity) || 0) || count);
  return count;
}

function bundleRuleDiscountAmount(rule, groupSubtotal, groupUnits, productCount) {
  if (!rule) return 0;
  const required = bundleRuleRequiredQty(rule, productCount);
  if (Math.floor(Number(groupUnits) || 0) < required) return 0;
  const subtotal = Math.max(0, Number(groupSubtotal) || 0);
  if (rule.rewardType === "percentage") return round2((subtotal * Math.min(100, Math.max(0, Number(rule.value) || 0))) / 100);
  if (rule.rewardType === "fixed_amount") return round2(Math.min(subtotal, Math.max(0, Number(rule.value) || 0)));
  return 0;
}

function bundleGiftQuantity(rule, groupUnits, productCount) {
  if (!rule || rule.rewardType !== "free_product") return 0;
  const required = Math.max(1, bundleRuleRequiredQty(rule, productCount));
  const freePer = Math.max(1, Number(rule.freeQuantity) || 1);
  return Math.floor(Math.max(0, Number(groupUnits) || 0) / required) * freePer;
}

function bundleMultiplierFromLines(lines = []) {
  let max = 1;
  (Array.isArray(lines) ? lines : []).forEach((line) => {
    if (line?.isBundleGift) return;
    const perSet = Math.max(1, Number(line?.bundleQuantity) || 1);
    const qty = Math.max(0, Number(line?.qty) || 0);
    max = Math.max(max, Math.floor(qty / perSet) || 1);
  });
  return Math.max(1, max);
}

function computeBundlePricing({ rule, groupUnits, groupSubtotal, productCount, legacyBundlePrice = 0, multiplier = 1 }) {
  const subtotal = round2(Math.max(0, Number(groupSubtotal) || 0));
  const units = Math.max(0, Math.floor(Number(groupUnits) || 0));
  const sets = Math.max(1, Number(multiplier) || 1);
  if (!rule) {
    const basePerSet = Math.max(0, Number(legacyBundlePrice) || 0);
    const baseTotal = round2(basePerSet * sets);
    return { eligible: false, discountAmount: 0, giftQty: 0, giftRule: null, effectiveTotal: basePerSet > 0 ? baseTotal : subtotal };
  }
  const requiredQty = bundleRuleRequiredQty(rule, productCount);
  const eligible = units >= requiredQty;
  const discountAmount = eligible ? bundleRuleDiscountAmount(rule, subtotal, units, productCount) : 0;
  const giftQty = eligible ? bundleGiftQuantity(rule, units, productCount) : 0;
  return {
    eligible,
    discountAmount,
    giftQty,
    giftRule: rule.rewardType === "free_product" && eligible ? rule : null,
    effectiveTotal: round2(Math.max(0, subtotal - discountAmount)),
  };
}

function repriceBundleGroup(lines, effectiveTotal) {
  const list = (Array.isArray(lines) ? lines : []).filter((l) => l && !l.isBundleGift);
  if (!list.length) return [];
  const target = Math.max(0, Number(effectiveTotal) || 0);
  const totalRegular = list.reduce((s, l) => s + (Number(l.regularPrice) || 0) * Math.max(1, Number(l.qty) || 1), 0);
  const out = [];
  let allocated = 0;
  list.forEach((line, idx) => {
    const qty = Math.max(1, Number(line.qty ?? line.quantity) || 1);
    const regularUnit = Number(line.regularPrice) || 0;
    if (idx === list.length - 1) {
      const remaining = round2(target - allocated);
      out.push({ ...line, qty, price: round6(remaining / qty) });
      return;
    }
    const share = totalRegular > 0 ? round2((target * regularUnit * qty) / totalRegular) : round2(target / list.length);
    allocated = round2(allocated + share);
    out.push({ ...line, qty, price: round6(share / qty) });
  });
  return out;
}

module.exports = {
  round2, round6, normalizeBundleRule, bundleRuleRequiredQty, bundleRuleDiscountAmount,
  bundleGiftQuantity, bundleMultiplierFromLines, computeBundlePricing, repriceBundleGroup,
};
