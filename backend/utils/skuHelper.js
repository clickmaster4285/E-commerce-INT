const Variant = require("../models/Variant");

const getNextSku = async () => {
  const variants = await Variant.find({
    sku: /^sku_\d+$/i,
  })
    .select("sku -_id")
    .lean();

  let highestNumber = 0;

  for (const variant of variants) {
    const match = variant.sku?.match(/^sku_(\d+)$/i);

    if (match) {
      const number = Number(match[1]);

      if (number > highestNumber) {
        highestNumber = number;
      }
    }
  }

  return `sku_${highestNumber + 1}`;
};

module.exports = {
  getNextSku,
};