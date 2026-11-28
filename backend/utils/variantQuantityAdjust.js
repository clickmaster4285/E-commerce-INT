const Variant = require("../models/Variant");
const StockHistory = require("../models/StockHistory");
const Product = require("../models/Product");

/**
 * Variant ko absolute target quantity par le jao — race-safe $inc + StockHistory (§4.1).
 * Direct `variant.quantity = x` + save overwrite concurrent stock changes.
 */
async function adjustVariantQuantityToTarget({
  variant,
  newQty,
  performerId = null,
  performerName = "Admin",
  reason = "",
  explanation = "Variant quantity updated",
}) {
  const previousQuantity = variant.quantity ?? 0;
  const delta = newQty - previousQuantity;
  if (delta === 0) {
    return {
      ok: true,
      changed: false,
      previousQuantity,
      newQuantity: previousQuantity,
      productId: variant.product_id?._id || variant.product_id || null,
    };
  }

  let updated;
  if (delta < 0) {
    const absDelta = Math.abs(delta);
    updated = await Variant.findOneAndUpdate(
      { _id: variant._id, is_deleted: { $ne: true }, quantity: { $gte: absDelta } },
      { $inc: { quantity: delta }, $set: { updatedby: performerId } },
      { returnDocument: "after" },
    );
    if (!updated) {
      return {
        ok: false,
        status: 400,
        message: `Cannot reduce stock below zero. Only ${previousQuantity} in stock.`,
      };
    }
  } else {
    updated = await Variant.findOneAndUpdate(
      { _id: variant._id, is_deleted: { $ne: true } },
      { $inc: { quantity: delta }, $set: { updatedby: performerId } },
      { returnDocument: "after" },
    );
    if (!updated) {
      return { ok: false, status: 404, message: "Variant not found" };
    }
  }

  const newQuantity = updated.quantity ?? 0;
  const productId = updated.product_id?._id || updated.product_id || null;
  let productName = "";
  if (productId) {
    const product = await Product.findById(productId).select("name").lean();
    productName = product?.name || "";
  }

  // Form se absolute target aati hai — history me "set" (manage-stock adjust jaisa)
  const adjustment_type = "set";

  await StockHistory.create({
    variant_id: variant._id,
    product_id: productId,
    product_name: productName,
    sku: variant.sku || updated.sku || "",
    variant_title: variant.title || updated.title || "",
    previous_quantity: previousQuantity,
    new_quantity: newQuantity,
    change_quantity: newQuantity - previousQuantity,
    adjustment_type,
    reason: String(reason || "").trim(),
    explanation: String(explanation || "").trim(),
    performed_by: performerId,
    performed_by_name: performerName,
  });

  variant.quantity = newQuantity;

  return {
    ok: true,
    changed: true,
    previousQuantity,
    newQuantity,
    productId,
    variant: updated,
  };
}

module.exports = { adjustVariantQuantityToTarget };