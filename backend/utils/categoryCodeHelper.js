const Category = require("../models/Category");

const getNextCategoryCode = async () => {
  // Sirf un categories ko dhundo jinka code "cat_" se shuru hota hai aur number par khatam hota hai
  const categories = await Category.find({
    category_code: /^cat_\d+$/i,
  })
    .select("category_code -_id")
    .lean();

  let highestNumber = 0;

  for (const category of categories) {
    const match = category.category_code?.match(/^cat_(\d+)$/i);

    if (match) {
      const number = Number(match[1]);
      if (number > highestNumber) {
        highestNumber = number;
      }
    }
  }

  // Highest number mein 1 add karke return karo (e.g., "cat_1", "cat_2")
  return `cat_${highestNumber + 1}`;
};

module.exports = {
  getNextCategoryCode,
};