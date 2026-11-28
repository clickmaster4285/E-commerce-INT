const Variant = require("../models/Variant");
const { nextSeq, peekSeq, maxNumericSuffix } = require("./counter");

const skuSeed = () => maxNumericSuffix(Variant, "sku", /^sku_\d+$/i);

/** Atomic next SKU for the current store (optimizeplan §3.2). */
const getNextSku = async () => {
  const seq = await nextSeq("sku", { seed: skuSeed });
  return `sku_${seq}`;
};

/** Preview only — does not consume a number. */
const peekNextSku = async () => {
  const seq = await peekSeq("sku", { seed: skuSeed });
  return `sku_${seq}`;
};

module.exports = {
  getNextSku,
  peekNextSku,
};
