const Category = require("../models/Category");
const { nextSeq, peekSeq, maxNumericSuffix } = require("./counter");

const catSeed = () => maxNumericSuffix(Category, "category_code", /^cat_\d+$/i);

/** Atomic next category code for the current store (optimizeplan §3.2). */
const getNextCategoryCode = async () => {
  const seq = await nextSeq("category", { seed: catSeed });
  return `cat_${seq}`;
};

/** Preview only — does not consume a number. */
const peekNextCategoryCode = async () => {
  const seq = await peekSeq("category", { seed: catSeed });
  return `cat_${seq}`;
};

module.exports = {
  getNextCategoryCode,
  peekNextCategoryCode,
};
