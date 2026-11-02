const toVariantQuantities = (items = []) => {
  const quantities = new Map();
  for (const item of items) {
    const variantId = String(item?.variant_id?._id || item?.variant_id || "");
    if (!variantId) continue;
    const quantity = Number(item.quantity || 0);
    quantities.set(variantId, (quantities.get(variantId) || 0) + quantity);
  }
  return quantities;
};

// Positive deltas mean invoice quantity increased (deduct stock); negative
// deltas mean quantity decreased (return stock to inventory).
const getInvoiceStockAdjustments = (previousItems = [], nextItems = []) => {
  const previous = toVariantQuantities(previousItems);
  const next = toVariantQuantities(nextItems);
  const ids = new Set([...previous.keys(), ...next.keys()]);
  return [...ids].map((variant_id) => ({
    variant_id,
    quantity: (next.get(variant_id) || 0) - (previous.get(variant_id) || 0),
  })).filter(({ quantity }) => quantity !== 0);
};

module.exports = { getInvoiceStockAdjustments };
