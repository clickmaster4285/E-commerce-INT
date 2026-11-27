// ==========================================================
// DEAL RULES — server copy of frontend/src/utils/dealCalculator.js
// ----------------------------------------------------------
// ⚠️ Storefront aur server ka price hisaab EK jaisa hona chahiye. Is file ka
// har function frontend wale ke barabar hai; test/pricingParity.test.js dono
// ko same inputs par chala kar compare karta hai — ek badlo to doosra bhi.
// ==========================================================

/** buy_x_get_y: max(minQuantity, buyQuantity); baaki: minQuantity (default 1) */
function getEffectiveMinQuantity(deal) {
  if (!deal) return 1;
  const minQty = Number(deal.minQuantity) || 1;
  if (deal.type === "buy_x_get_y") {
    const buyQty = Number(deal.buyQuantity) || 0;
    return Math.max(minQty, buyQty);
  }
  return minQty;
}

/** Cart line par deal laagu hai? (frontend isDealActive — deal doc se) */
function isDealActiveForQty(deal, qty) {
  if (!deal) return false;
  if (deal.type === "buy_x_get_y" && !(Number(deal.buyQuantity) > 0)) return false;
  return Number(qty) >= getEffectiveMinQuantity(deal);
}

/** percentage / fixed_amount deal ka unit price (frontend getDealUnitPrice) */
function getDealUnitPrice(price, dealType, discountValue) {
  const regularPrice = Number(price) || 0;
  const value = Number(discountValue) || 0;
  if (dealType === "percentage" && value > 0) {
    const discountedPrice = Math.round(regularPrice * (1 - value / 100));
    return discountedPrice > 0 ? discountedPrice : regularPrice;
  }
  if (dealType === "fixed_amount" && value > 0 && value < regularPrice) {
    return regularPrice - value;
  }
  return regularPrice;
}

/** Buy X Get Y: har `buyQty` paid par `getQty` free */
function calculateFreeItems(qty, buyQty, getQty) {
  if (!buyQty || !getQty || buyQty <= 0 || getQty <= 0) return 0;
  return Math.floor(qty / buyQty) * getQty;
}

/** Deal abhi chal rahi hai aur is product par laagu hai? */
function dealAppliesToProduct(deal, { productId, categoryId, brandId }, now = new Date()) {
  if (!deal || !deal.isActive) return false;
  if (deal.startDate && new Date(deal.startDate) > now) return false;
  if (deal.endDate && new Date(deal.endDate) < now) return false;
  const has = (ids, id) => Boolean(id) && (ids || []).some((x) => String(x?._id || x) === String(id));
  switch (deal.applyTo) {
    case "all": return true;
    case "product": case "specific_products": return has(deal.productIds, productId);
    case "category": case "specific_categories": return has(deal.categoryIds, categoryId);
    case "brand": case "specific_brands": return has(deal.brandIds, brandId);
    default: return false;
  }
}

module.exports = { getEffectiveMinQuantity, isDealActiveForQty, getDealUnitPrice, calculateFreeItems, dealAppliesToProduct };
