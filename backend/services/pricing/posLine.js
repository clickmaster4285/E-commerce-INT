// POS line pricing (§4.2) — savePosSale / quote-adjacent callers share this.
// Flat-per-unit + % discount + line tax; totals still round via roundMoney at sale level.
function pricePosLine({ unitPrice, quantity, discountRate = 0, flatDiscountPerUnit = 0, taxRate = 0 } = {}) {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  const dRate = Math.min(100, Math.max(0, Number(discountRate) || 0));
  const tRate = Math.min(100, Math.max(0, Number(taxRate) || 0));
  const flat = Math.max(0, Number(flatDiscountPerUnit) || 0);
  const grossLineTotal = price * qty;
  const percentageDiscount = grossLineTotal * (dRate / 100);
  const cappedFlat = Math.min(flat, Math.max(0, price * (1 - dRate / 100)));
  const flatDiscountTotal = cappedFlat * qty;
  const itemDiscount = percentageDiscount + flatDiscountTotal;
  const lineTotal = grossLineTotal - itemDiscount;
  const itemTax = lineTotal * (tRate / 100);
  return {
    grossLineTotal,
    itemDiscount,
    lineTotal,
    itemTax,
    flat_discount: cappedFlat,
    discount_rate: dRate,
    tax_rate: tRate,
  };
}

module.exports = { pricePosLine };
