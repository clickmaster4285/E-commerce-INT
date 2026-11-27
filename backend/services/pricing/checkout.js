// ==========================================================
// CHECKOUT PRICING — server hi price ka faisla karta hai (optimizeplan.md §2.2 / §4.2)
// ----------------------------------------------------------
// Pehle placeOrder browser ke bheje displayPrice / freeItems / savings /
// bundle price par bharosa karta tha ("TRUST FRONTEND SNAPSHOT") → koi bhi
// price 1 bhej kar order kar sakta tha.
//
// Ab har line ka price DB data (variant.selling_price, active Discounts,
// Deal / Bundle docs) se, storefront wale hi rules se (dealRules /
// discountRules / bundleRules — test/pricingParity.test.js) nikalta hai.
// Client ka bheja price sirf COMPARE ke liye: farq ho to `mismatches` me
// (placeOrder 409 PRICE_CHANGED deta hai — cart purana / tampered).
//
// Pure function: koi DB call nahi (caller docs load karta hai) → unit-testable.
// ==========================================================

const { isDealActiveForQty, getDealUnitPrice, calculateFreeItems, dealAppliesToProduct } = require("./dealRules");
const { bestRegularDiscount } = require("./discountRules");
const {
  round2, normalizeBundleRule, bundleMultiplierFromLines, computeBundlePricing, repriceBundleGroup,
} = require("./bundleRules");

const PRICE_TOLERANCE = 0.01; // round6 / float noise
const idStr = (v) => String(v?._id || v || "");

function targetOf(product) {
  return { productId: idStr(product?._id), categoryId: idStr(product?.category_id), brandId: idStr(product?.brand_id) };
}

/** Bundle me is product ki per-set quantity (Deal.bundleProducts / Bundle.products) */
function perSetQuantity(bundleDealDoc, bundleDoc, productId) {
  const list = bundleDealDoc?.bundleProducts || bundleDoc?.products || [];
  const hit = list.find((entry) => idStr(entry?.product) === String(productId));
  return Math.max(1, Number(hit?.quantity) || 1);
}

/**
 * @param {object} input
 * @param {Array}  input.lines  [{ index, qty, product, variant, clientUnit, clientFree,
 *                                 dealDoc?, bundleId?, bundleDealDoc?, bundleDoc?, isGift? }]
 * @param {Array}  input.discounts  active public discounts
 * @param {Date}   [input.now]
 * @returns {{ priced: Map<index, line>, mismatches: Array, errors: Array }}
 */
function priceCheckout({ lines, discounts, now = new Date() }) {
  const priced = new Map();
  const mismatches = [];
  const errors = [];
  const bundleGroups = new Map();

  for (const line of lines) {
    const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
    const regularPrice = Number(line.variant?.selling_price) || 0;
    const base = { index: line.index, qty, regularPrice, unit: regularPrice, free: 0, perItemSavings: 0, dealSavings: 0, bundleSavings: 0, dealActive: false, discountName: "" };

    if (line.bundleId) {
      const key = String(line.bundleId);
      if (!bundleGroups.has(key)) bundleGroups.set(key, { lines: [], gift: null, bundleDealDoc: line.bundleDealDoc, bundleDoc: line.bundleDoc });
      const group = bundleGroups.get(key);
      if (line.isGift) group.gift = { ...base, line };
      else group.lines.push({ ...base, line });
      continue;
    }

    if (line.dealDoc) {
      const deal = line.dealDoc;
      if (!dealAppliesToProduct(deal, targetOf(line.product), now) || !isDealActiveForQty(deal, qty)) {
        errors.push({ index: line.index, code: "DEAL_NOT_APPLICABLE" });
        continue;
      }
      const unit = getDealUnitPrice(regularPrice, deal.type, deal.discountValue);
      const free = deal.type === "buy_x_get_y" ? calculateFreeItems(qty, Number(deal.buyQuantity), Number(deal.getQuantity)) : 0;
      priced.set(line.index, {
        ...base,
        unit,
        free,
        dealActive: true,
        dealSavings: deal.type === "buy_x_get_y" ? free * regularPrice : Math.max(0, (regularPrice - unit) * qty),
      });
      continue;
    }

    const disc = bestRegularDiscount(regularPrice, discounts, targetOf(line.product));
    priced.set(line.index, {
      ...base,
      unit: disc.discountedPrice,
      perItemSavings: Math.max(0, regularPrice - disc.discountedPrice),
      discountName: disc.discountName || "",
    });
  }

  // ---- Bundle groups (combo deals): storefront CartContext.priceBundleGroup jaisa ----
  for (const [bundleId, group] of bundleGroups) {
    if (!group.bundleDealDoc && !group.bundleDoc) {
      for (const l of group.lines) errors.push({ index: l.index, code: "BUNDLE_NOT_AVAILABLE" });
      if (group.gift) errors.push({ index: group.gift.index, code: "BUNDLE_NOT_AVAILABLE" });
      continue;
    }
    const rule = normalizeBundleRule(group.bundleDealDoc?.bundleRule);
    const withSets = group.lines.map((l) => ({ ...l, key: String(l.index), bundleQuantity: perSetQuantity(group.bundleDealDoc, group.bundleDoc, idStr(l.line.product?._id)) }));
    const groupUnits = withSets.reduce((s, l) => s + l.qty, 0);
    const groupSubtotal = round2(withSets.reduce((s, l) => s + l.regularPrice * l.qty, 0));
    const pricing = computeBundlePricing({
      rule,
      groupUnits,
      groupSubtotal,
      productCount: withSets.length,
      legacyBundlePrice: Number(group.bundleDealDoc?.bundlePrice || group.bundleDoc?.bundlePrice || 0),
      multiplier: bundleMultiplierFromLines(withSets),
    });
    const repriced = new Map(repriceBundleGroup(withSets, pricing.effectiveTotal).map((p) => [p.key, p.price]));
    for (const l of withSets) {
      const unit = Number(repriced.get(l.key) ?? l.regularPrice);
      priced.set(l.index, { ...l, line: undefined, key: undefined, unit, bundleSavings: round2((l.regularPrice - unit) * l.qty), bundleId });
    }

    // Gift line: sirf tab jab rule free_product ho, wahi product aur qty <= giftQty
    if (group.gift) {
      const gift = group.gift;
      const okProduct = pricing.giftRule && idStr(gift.line.product?._id) === String(pricing.giftRule.freeProductId);
      if (!okProduct || gift.qty > pricing.giftQty) {
        errors.push({ index: gift.index, code: "BUNDLE_GIFT_INVALID" });
      } else {
        priced.set(gift.index, { ...gift, line: undefined, unit: 0, bundleSavings: round2(gift.regularPrice * gift.qty), bundleId, isGift: true });
      }
    }
  }

  // ---- Client ne jo dikhaya tha us se compare ----
  for (const line of lines) {
    const p = priced.get(line.index);
    if (!p) continue;
    const clientUnit = Number(line.clientUnit);
    const unitDiff = Number.isFinite(clientUnit) ? Math.abs(clientUnit - p.unit) : Infinity;
    const freeDiff = Math.abs((Number(line.clientFree) || 0) - p.free);
    if (unitDiff > PRICE_TOLERANCE || freeDiff > 0) {
      mismatches.push({ index: line.index, clientUnit, serverUnit: p.unit, clientFree: Number(line.clientFree) || 0, serverFree: p.free });
    }
  }

  return { priced, mismatches, errors };
}

module.exports = { priceCheckout, PRICE_TOLERANCE };
