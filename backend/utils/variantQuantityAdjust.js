const Product = require("../models/Product");
const stock = require("../services/stock");

/**
 * Variant ko absolute target quantity par le jao — services/stock.js (§4.1 / §3.9).
 * Direct `variant.quantity = x` + save overwrite concurrent stock changes.
 */
async function adjustVariantQuantityToTarget({
  variant,
  newQty,
  performerId = null,
  performerName = "Admin",
  reason = "",
  explanation = "Variant quantity updated",
  session = null,
}) {
  const previousQuantity = variant.quantity ?? 0;
  const target = Number(newQty);
  if (Number.isNaN(target) || target < 0) {
    return { ok: false, status: 400, message: "Quantity must be a non-negative number" };
  }
  if (target === previousQuantity) {
    return {
      ok: true,
      changed: false,
      previousQuantity,
      newQuantity: previousQuantity,
      productId: variant.product_id?._id || variant.product_id || null,
    };
  }

  const result = await stock.adjust(
    {
      variant_id: variant._id,
      setTo: target,
      kind: "count_set",
      reason: String(reason || "").trim(),
      explanation: String(explanation || "").trim(),
      actor: { id: performerId, name: performerName },
      ref_type: "variant",
      ref_id: variant._id,
    },
    session,
  );

  if (!result.ok) {
    return {
      ok: false,
      status: result.status || 400,
      message: result.message || `Cannot reduce stock below zero. Only ${previousQuantity} in stock.`,
    };
  }

  const newQuantity = result.on_hand ?? target;
  const productId = variant.product_id?._id || variant.product_id || null;
  if (productId && !result.changed) {
    // no-op already handled above
  }

  variant.quantity = newQuantity;

  return {
    ok: true,
    changed: Boolean(result.changed),
    previousQuantity,
    newQuantity,
    productId,
    variant: result.movement ? { ...variant, quantity: newQuantity } : variant,
  };
}

module.exports = { adjustVariantQuantityToTarget };
