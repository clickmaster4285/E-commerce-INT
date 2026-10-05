/**
 * ============================================================
 * BUNDLE (COMBO DEAL) — PURE CALCULATIONS
 * ============================================================
 * A bundle deal is a combo of products with ONE offer condition:
 *
 *   1) Mode "all"   → customer must buy ALL selected products
 *                     (required quantity = number of selected products)
 *   2) Mode "limit" → customer must buy a specific number of items
 *                     (admin defines the quantity)
 *
 * Until the condition is met the bundle deal does NOT apply — the cart
 * lines stay at their regular price. When it is met, the reward is:
 *   - percentage   → % off the bundle subtotal
 *   - fixed_amount → flat Rs. off the bundle subtotal
 *   - free_product → a free gift line (price 0) is added to the cart
 *
 * Cart lines carry the rule + their regular price; the discounted total is
 * split back over the lines proportionally so cart / checkout / order totals
 * are always exact.
 * ============================================================
 */

export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

/** Money helper for per-unit prices that must stay exact (6 decimals) */
export const round6 = (value) => Math.round((Number(value) || 0) * 1e6) / 1e6;

/**
 * Original (discount free) total of a set of items
 */
export function bundleOriginalTotal(items = []) {
  return round2(
    items.reduce(
      (sum, item) =>
        sum + (Number(item.regularPrice) || 0) * Math.max(1, Number(item.quantity) || 1),
      0
    )
  );
}

/**
 * Split a total price over items proportionally to their regular price.
 * The last line absorbs the rounding remainder so the group total is exact.
 *
 * @param {Array<{regularPrice:number, quantity:number}>} items
 * @param {number} total
 * @returns {Array} items + `unitPrice` (per cart unit price)
 */
export function splitBundlePrice(items, total) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];

  const target = Math.max(0, Number(total) || 0);
  const originalTotal = bundleOriginalTotal(list);

  // No regular price → split equally
  if (originalTotal <= 0) {
    const each = round2(target / list.length);
    let allocated = 0;
    return list.map((item, idx) => {
      if (idx === list.length - 1) {
        return { ...item, unitPrice: round2(target - allocated) };
      }
      allocated = round2(allocated + each);
      return { ...item, unitPrice: each };
    });
  }

  const out = [];
  let allocated = 0;

  list.forEach((item, idx) => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const regularUnit = Number(item.regularPrice) || 0;

    if (idx === list.length - 1) {
      // Last line absorbs the remainder → group total is EXACT
      const remaining = round2(target - allocated);
      out.push({ ...item, unitPrice: round2(remaining / qty) });
      return;
    }

    const share = round2((target * regularUnit * qty) / originalTotal);
    allocated = round2(allocated + share);
    out.push({ ...item, unitPrice: round2(share / qty) });
  });

  return out;
}

/**
 * Actual total of cart lines
 */
export function bundleLinesTotal(lines = []) {
  return round2(
    lines.reduce(
      (sum, line) =>
        sum + (Number(line.price) || 0) * (Math.max(1, Number(line.qty) || 1)),
      0
    )
  );
}

/**
 * How many complete bundle sets are in the cart
 */
export function bundleMultiplier(line) {
  const perBundle = Math.max(1, Number(line?.bundleQuantity) || 1);
  const qty = Math.max(1, Number(line?.qty) || 1);
  return Math.max(1, Math.round(qty / perBundle));
}

/**
 * How many sets are in a bundle group (gift lines are ignored)
 */
export function bundleMultiplierFromLines(lines = []) {
  let max = 1;
  (Array.isArray(lines) ? lines : []).forEach((line) => {
    if (line?.isBundleGift) return;
    const perSet = Math.max(1, Number(line?.bundleQuantity) || 1);
    const qty = Math.max(0, Number(line?.qty) || 0);
    max = Math.max(max, Math.floor(qty / perSet) || 1);
  });
  return Math.max(1, max);
}

/**
 * Percentage saved by a combo price
 */
export function bundleDiscountPercent(originalPrice, bundlePrice) {
  const original = Number(originalPrice) || 0;
  if (original <= 0) return 0;
  const savings = Math.max(0, original - (Number(bundlePrice) || 0));
  return Math.round((savings / original) * 100);
}

/* ============================================================
   BUNDLE OFFER CONDITION (single rule)
   ============================================================ */

export const BUNDLE_RULE_MODES = {
  all: "All selected products",
  limit: "Limited quantity",
};

export const BUNDLE_REWARD_TYPES = {
  percentage: "Percentage discount (%)",
  fixed_amount: "Fixed amount (Rs.)",
  free_product: "Free product (gift)",
};

const REWARD_TYPES = ["percentage", "fixed_amount", "free_product"];

/**
 * Normalize one raw rule (admin form / API document) into a safe shape.
 * A legacy array of rules is also accepted — its first rule is used.
 */
export function normalizeBundleRule(rule) {
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
  const freeProductId = String(
    gift?._id || gift?.id || raw.freeProduct || raw.free_product || raw.freeProductId || ""
  );

  if (rewardType === "free_product" && !freeProductId) return null;
  if (rewardType !== "free_product" && value <= 0) return null;
  if (mode === "limit" && buyQuantity <= 0) return null;

  return {
    mode,
    buyQuantity,
    rewardType,
    value,
    freeProductId,
    freeProductName: gift?.name || String(raw.freeProductName || raw.free_product_name || ""),
    freeProductImage:
      gift?.images?.[0]?.img_url || gift?.image || String(raw.freeProductImage || ""),
    freeProductPrice: Number(raw.freeProductPrice ?? raw.free_product_price ?? 0) || 0,
    freeProductVariantId: String(raw.freeProductVariantId ?? raw.free_product_variant_id ?? ""),
    freeQuantity: Math.max(1, Math.floor(Number(raw.freeQuantity ?? raw.free_quantity) || 1)),
  };
}

/**
 * Quantity the customer must buy for the offer to unlock.
 *   mode "all"   → number of selected bundle products
 *   mode "limit" → admin defined quantity
 */
export function bundleRuleRequiredQty(rule, productCount) {
  if (!rule) return 0;
  const count = Math.max(1, Math.floor(Number(productCount) || 0) || 1);

  if (rule.mode === "limit") {
    return Math.max(1, Math.floor(Number(rule.buyQuantity) || 0) || count);
  }
  return count;
}

/**
 * Discount (Rs.) for the whole bundle group. 0 while condition is not met.
 */
export function bundleRuleDiscountAmount(rule, groupSubtotal, groupUnits, productCount) {
  if (!rule) return 0;

  const required = bundleRuleRequiredQty(rule, productCount);
  if (Math.floor(Number(groupUnits) || 0) < required) return 0;

  const subtotal = Math.max(0, Number(groupSubtotal) || 0);

  if (rule.rewardType === "percentage") {
    return round2((subtotal * Math.min(100, Math.max(0, Number(rule.value) || 0))) / 100);
  }
  if (rule.rewardType === "fixed_amount") {
    return round2(Math.min(subtotal, Math.max(0, Number(rule.value) || 0)));
  }
  return 0;
}

/**
 * Free gift quantity — every complete condition multiple gives one gift set.
 * 0 while condition is not met.
 */
export function bundleGiftQuantity(rule, groupUnits, productCount) {
  if (!rule || rule.rewardType !== "free_product") return 0;

  const required = Math.max(1, bundleRuleRequiredQty(rule, productCount));
  const freePer = Math.max(1, Number(rule.freeQuantity) || 1);
  return Math.floor(Math.max(0, Number(groupUnits) || 0) / required) * freePer;
}

/**
 * Human readable rule label, e.g.
 *   "Buy all 3 products → 10% OFF"
 *   "Buy 4 items → Free Gift Box"
 */
export function bundleRuleLabel(rule, productCount) {
  if (!rule) return "";

  const required = bundleRuleRequiredQty(rule, productCount);
  const buyText =
    rule.mode === "limit"
      ? `Buy ${required} item${required > 1 ? "s" : ""}`
      : `Buy all ${required} products`;

  if (rule.rewardType === "percentage") {
    return `${buyText} → ${Number(rule.value) || 0}% OFF`;
  }
  if (rule.rewardType === "fixed_amount") {
    return `${buyText} → Rs. ${(Number(rule.value) || 0).toLocaleString()} OFF`;
  }
  const qty = Math.max(1, Number(rule.freeQuantity) || 1);
  const gift = rule.freeProductName || "Free product";
  return `${buyText} → ${qty > 1 ? `${qty}× ` : ""}${gift} FREE`;
}

/**
 * Progress hint while the condition is still pending, e.g.
 *   "Add 2 more items to unlock 10% OFF"
 */
export function bundleProgressLabel(rule, groupUnits, productCount) {
  if (!rule) return "";

  const required = bundleRuleRequiredQty(rule, productCount);
  const remaining = Math.max(0, required - Math.floor(Number(groupUnits) || 0));
  if (remaining <= 0) return "";

  const reward =
    rule.rewardType === "percentage"
      ? `${Number(rule.value) || 0}% OFF`
      : rule.rewardType === "fixed_amount"
      ? `Rs. ${(Number(rule.value) || 0).toLocaleString()} OFF`
      : `${rule.freeProductName || "a free gift"}`;

  return `Add ${remaining} more item${remaining > 1 ? "s" : ""} to unlock ${reward}`;
}

/**
 * Full pricing for one bundle group.
 *
 * @param {object} args
 * @param {object|null} args.rule            normalized single offer rule
 * @param {number} args.groupUnits           total units of bundle products in cart
 * @param {number} args.groupSubtotal        regular price total of the group
 * @param {number} args.productCount         number of bundle products (mode "all")
 * @param {number} [args.legacyBundlePrice]  legacy fixed combo price (no rule)
 * @param {number} [args.multiplier]         complete bundle sets
 */
export function computeBundlePricing({
  rule,
  groupUnits,
  groupSubtotal,
  productCount,
  legacyBundlePrice = 0,
  multiplier = 1,
}) {
  const subtotal = round2(Math.max(0, Number(groupSubtotal) || 0));
  const units = Math.max(0, Math.floor(Number(groupUnits) || 0));
  const sets = Math.max(1, Number(multiplier) || 1);

  // ---- Legacy combo pricing: no rule + fixed bundle price ----
  if (!rule) {
    const basePerSet = Math.max(0, Number(legacyBundlePrice) || 0);
    const baseTotal = round2(basePerSet * sets);
    const comboSavings = basePerSet > 0 ? Math.max(0, round2(subtotal - baseTotal)) : 0;

    return {
      rule: null,
      mode: null,
      eligible: false,
      requiredQty: 0,
      groupUnits: units,
      groupSubtotal: subtotal,
      discountAmount: 0,
      giftRule: null,
      giftQty: 0,
      giftSavings: 0,
      comboSavings,
      totalSavings: comboSavings,
      effectiveTotal: basePerSet > 0 ? baseTotal : subtotal,
      progress: null,
      appliedLabel: "",
    };
  }

  const requiredQty = bundleRuleRequiredQty(rule, productCount);
  const eligible = units >= requiredQty;
  const discountAmount = eligible
    ? bundleRuleDiscountAmount(rule, subtotal, units, productCount)
    : 0;
  const giftQty = eligible ? bundleGiftQuantity(rule, units, productCount) : 0;
  const giftSavings = round2((Number(rule.freeProductPrice) || 0) * giftQty);

  return {
    rule,
    mode: rule.mode,
    eligible,
    requiredQty,
    groupUnits: units,
    groupSubtotal: subtotal,
    discountAmount,
    giftRule: rule.rewardType === "free_product" && eligible ? rule : null,
    giftQty,
    giftSavings,
    comboSavings: 0,
    totalSavings: round2(discountAmount + giftSavings),
    effectiveTotal: round2(Math.max(0, subtotal - discountAmount)),
    progress: eligible ? null : bundleProgressLabel(rule, units, productCount),
    appliedLabel: eligible ? bundleRuleLabel(rule, productCount) : "",
  };
}

/**
 * Re-split a group total over its lines. The last line absorbs the exact
 * remainder, so the group total always matches `effectiveTotal` to the paisa
 * even when a line has quantity > 1. Gift lines are left untouched.
 */
export function repriceBundleGroup(lines, effectiveTotal) {
  const list = (Array.isArray(lines) ? lines : []).filter((l) => l && !l.isBundleGift);
  if (!list.length) return [];

  const target = Math.max(0, Number(effectiveTotal) || 0);
  const totalRegular = list.reduce(
    (s, l) => s + (Number(l.regularPrice) || 0) * Math.max(1, Number(l.qty) || 1),
    0
  );

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

    const share =
      totalRegular > 0
        ? round2((target * regularUnit * qty) / totalRegular)
        : round2(target / list.length);

    allocated = round2(allocated + share);
    out.push({ ...line, qty, price: round6(share / qty) });
  });

  return out;
}
