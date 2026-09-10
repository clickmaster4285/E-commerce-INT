// ==========================================
// DEAL CALCULATOR - Shared logic for Buy X Get Y
// ✅ NAYA RULE: qty = PAID qty | free = UPAR se | total = qty + free
// ==========================================

/**
 * ✅ An item is treated as an active deal line only if:
 *   - it has a dealId, AND
 *   - for buy_x_get_y deals: qty >= dealBuyQuantity (activation threshold)
 *   - for other deal types (percentage/fixed_amount/free_shipping/bundle): always
 *
 * Buy X Get Y below the threshold behaves as a regular line.
 */
export function isDealActive(item) {
  if (!item || !item.dealId) return false;
  if (item.dealType === "buy_x_get_y") {
    const buyQty = Number(item.dealBuyQuantity) || 0;
    if (buyQty <= 0) return false;
    return Number(item.qty) >= buyQty;
  }
  return true;
}

/**
 * ✅ SINGLE SOURCE OF TRUTH: does any line in `cart` qualify for free shipping
 * because of a free_shipping deal? Uses isDealActive so buy_x_get_y threshold
 * semantics are honoured (only counts deal lines that are ACTIVE).
 */
export function hasFreeShippingDeal(cart) {
  if (!Array.isArray(cart) || cart.length === 0) return false;
  return cart.some((line) => isDealActive(line) && line.dealType === "free_shipping");
}

/**
 * ✅ Per-method helper: does a free_shipping deal apply to the given shipping
 * method (e.g. "standard" | "express")?
 *
 *   - Returns false unless deal.type === "free_shipping"
 *   - Missing / empty `freeShippingMethods` is treated as BOTH methods
 *     (backward compatible with old deals that don't have the field)
 *
 * This is the single helper all UI must reuse — do not duplicate the logic.
 */
export function isFreeShippingApplicable(deal, method) {
  if (!deal || deal.type !== "free_shipping" || !method) return false;
  const methods = deal.freeShippingMethods;
  if (!Array.isArray(methods) || methods.length === 0) return true;
  return methods.includes(method);
}

/**
 * ✅ Pick the default shipping method for a free-shipping deal.
 *   - Prefer 'standard' if it's covered (cheapest / most common default)
 *   - Otherwise fall back to 'express' if it's covered
 *   - No deal, missing/empty list, or no covered method => 'standard'
 *
 * Backward compatible: missing/empty freeShippingMethods is treated as BOTH.
 */
export function getDefaultShippingMethod(freeShippingDeal) {
  if (!freeShippingDeal || freeShippingDeal.type !== "free_shipping") return "standard";
  const methods = freeShippingDeal.freeShippingMethods;
  if (!Array.isArray(methods) || methods.length === 0) return "standard";
  if (methods.includes("standard")) return "standard";
  if (methods.includes("express")) return "express";
  return "standard";
}

/**
 * ✅ Match admin shipping rules against cart items (single source of truth).
 *
 * A rule is considered ACTIVE only when isActive/is_active is true.
 * Matching logic:
 *   - 'product'  => any cart item's productId equals rule.ref_id
 *   - 'category' => any cart item's categoryId equals rule.ref_id
 *   - 'brand'    => any cart item's brandId equals rule.ref_id
 *   - 'all'      => always matches (no ref_id needed)
 *
 * Tie-breaker priority: product > category > brand > all.
 * On equal priority: prefer shipping_type 'free' over 'fixed'.
 *
 * Returns the matched rule object (with shipping_type + fee) or null.
 *
 * NOTE: rule.ref_id may be a populated object OR a string id; the helper
 *       handles both via String(...) normalization.
 */
export function matchShippingRule(cartItems, rules) {
  if (!Array.isArray(rules) || rules.length === 0) return null;
  const items = Array.isArray(cartItems) ? cartItems : [];

  // ✅ Priority order — higher number wins.
  const priority = { product: 4, category: 3, brand: 2, all: 1 };
  const norm = (v) => {
    if (v == null) return "";
    if (typeof v === "object") return String(v._id || v.id || "");
    return String(v);
  };

  let best = null;

  for (const rule of rules) {
    if (!rule || (rule.is_active !== true && rule.isActive !== true)) continue;

    let matched = false;
    if (rule.rule_type === "all") {
      matched = items.length > 0;
    } else if (rule.rule_type === "product") {
      const ref = norm(rule.ref_id);
      if (ref) matched = items.some((i) => norm(i.productId || i.product_id || i._id || i.id) === ref);
    } else if (rule.rule_type === "category") {
      const ref = norm(rule.ref_id);
      if (ref) matched = items.some((i) => norm(i.categoryId || i.category_id) === ref);
    } else if (rule.rule_type === "brand") {
      const ref = norm(rule.ref_id);
      if (ref) matched = items.some((i) => norm(i.brandId || i.brand_id) === ref);
    }

    if (!matched) continue;

    // ✅ Compare with current best.
    if (!best) { best = rule; continue; }
    const bp = priority[best.rule_type] || 0;
    const rp = priority[rule.rule_type] || 0;
    if (rp > bp) {
      best = rule;
    } else if (rp === bp) {
      // Tie: prefer 'free' over 'fixed'.
      if (rule.shipping_type === "free" && best.shipping_type !== "free") {
        best = rule;
      }
    }
  }

  return best;
}

/**
 * ✅ Free items (jo UPAR se milenge)
 */
export function calculateFreeItems(qty, buyQty, getQty) {
  if (!buyQty || !getQty || buyQty <= 0 || getQty <= 0) return 0;
  return Math.floor(qty / buyQty) * getQty;
}

/**
 * ✅ Payable = jo customer ne add kiya (POORA payment)
 */
export function calculatePayableItems(qty, buyQty, getQty) {
  return Math.max(0, Number(qty) || 0);
}

/**
 * ✅ Total items = paid + free (customer ko milne wale)
 */
export function calculateTotalItems(qty, buyQty, getQty) {
  const q = Math.max(0, Number(qty) || 0);
  return q + calculateFreeItems(q, buyQty, getQty);
}

/**
 * Savings = free items × price
 */
export function calculateBuyXGetYSavings(qty, price, buyQty, getQty) {
  return calculateFreeItems(qty, buyQty, getQty) * price;
}

/**
 * ✅ Stock se max PAID qty (paid + free stock se zyada na ho)
 */
export function maxPayableQty(stock, buyQty, getQty) {
  if (stock == null || !Number.isFinite(Number(stock))) return null;
  let q = Math.floor(Number(stock));
  while (q > 0 && q + calculateFreeItems(q, buyQty, getQty) > Number(stock)) q--;
  return q;
}

/**
 * Get deal display info
 */
export function getDealDisplayInfo(deal) {
  if (!deal) return null;

  if (deal.type === "buy_x_get_y") {
    const buyQty = deal.buyQuantity || 2;
    const getQty = deal.getQuantity || 1;
    return {
      type: "buy_x_get_y",
      label: `Buy ${buyQty} Get ${getQty}`,
      buyQty,
      getQty,
      color: "from-purple-500 to-pink-600",
    };
  }

  if (deal.type === "percentage") {
    return { type: "percentage", label: `${deal.discountValue}% OFF`, color: "from-green-500 to-emerald-600" };
  }

  if (deal.type === "fixed_amount") {
    return { type: "fixed_amount", label: `Rs. ${deal.discountValue} OFF`, color: "from-blue-500 to-cyan-600" };
  }

  if (deal.type === "free_shipping") {
    return { type: "free_shipping", label: "Free Shipping", color: "from-orange-500 to-red-600" };
  }

  return { type: deal.type, label: deal.name || "Deal", color: "from-orange-500 to-red-600" };
}