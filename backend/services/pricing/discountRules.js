// ==========================================================
// REGULAR DISCOUNT — server copy of the non-deal branch of
// frontend/src/components/user/DiscountContext.js → calculateProductDiscount
// (includeDeals = false, jaisa checkout regular lines par chalata hai).
// ----------------------------------------------------------
// `discounts` = wahi list jo GET /discounts/public deta hai (active, status
// active, date window ke andar). Parity: test/pricingParity.test.js.
// ==========================================================

function discountApplies(disc, { productId, categoryId, brandId }) {
  const has = (ids, id) => Boolean(id) && (ids || []).some((x) => String(x?._id || x) === String(id));
  if (disc.applyTo === "all") return true;
  if (disc.applyTo === "product" || disc.applyTo === "specific_products") return has(disc.productIds || disc.selectedProducts, productId);
  if (disc.applyTo === "category" || disc.applyTo === "specific_categories") return has(disc.categoryIds || disc.selectedCategories, categoryId);
  if (disc.applyTo === "brand" || disc.applyTo === "specific_brands") return has(disc.brandIds || disc.selectedBrands, brandId);
  return false; // tags / sizes / price_range: storefront bhi apply nahi karta
}

/**
 * @returns {{ hasDiscount, originalPrice, discountedPrice, savings, discountName, discountId }}
 */
function bestRegularDiscount(regularPrice, discounts, target) {
  const originalPrice = Number(regularPrice) || 0;
  let bestPrice = originalPrice;
  let bestName = null;
  let bestId = null;
  for (const disc of Array.isArray(discounts) ? discounts : []) {
    if (!disc || !disc.isActive) continue;
    if (!discountApplies(disc, target)) continue;
    let finalPrice = originalPrice;
    if (disc.type === "percentage") {
      finalPrice = originalPrice * (1 - Number(disc.value || disc.discountValue) / 100);
    } else if (disc.type === "fixed" || disc.type === "fixed_amount") {
      finalPrice = Math.max(0, originalPrice - Number(disc.value || disc.discountValue));
    }
    if (finalPrice < bestPrice) {
      bestPrice = finalPrice;
      bestName = disc.name || "Discount";
      bestId = disc._id || null;
    }
  }
  const hasDiscount = bestPrice < originalPrice;
  return {
    hasDiscount,
    originalPrice,
    discountedPrice: Math.round(hasDiscount ? bestPrice : originalPrice),
    savings: hasDiscount ? Math.round(originalPrice - bestPrice) : 0,
    discountName: bestName,
    discountId: bestId,
  };
}

module.exports = { bestRegularDiscount, discountApplies };
