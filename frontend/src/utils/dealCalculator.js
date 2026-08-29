// ==========================================
// DEAL CALCULATOR - Shared logic for Buy X Get Y
// ✅ NAYA RULE: qty = PAID qty | free = UPAR se | total = qty + free
// ==========================================

/**
 * Free items (jo UPAR se milenge)
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