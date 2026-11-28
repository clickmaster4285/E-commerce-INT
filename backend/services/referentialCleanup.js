// §3.7 — delete ke baad dangling refs saaf karna / referenced master-data delete block karna.
// Models tenantScope plugin se storeId automatically filter karte hain (current store ka hi data).
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");

// Attribute delete → Category.attributes se wo entry hata do
async function pullAttributeFromCategories(attributeId) {
  return Category.updateMany(
    { "attributes.attribute_id": attributeId },
    { $pull: { attributes: { attribute_id: attributeId } } },
  );
}

// Tag delete → Product.tag_ids (aur Variant.tag_ids) se id hata do
async function pullTagFromProducts(tagId) {
  const [products, variants] = await Promise.all([
    Product.updateMany({ tag_ids: tagId }, { $pull: { tag_ids: tagId } }),
    Variant.updateMany({ tag_ids: tagId }, { $pull: { tag_ids: tagId } }),
  ]);
  return { products, variants };
}

// Brand/category delete se pehle: kitne (non-deleted) products reference kar rahe hain
async function countProductsUsingBrand(brandId) {
  return Product.countDocuments({ brand_id: brandId, is_deleted: { $ne: true } });
}
async function countProductsUsingCategory(categoryId) {
  return Product.countDocuments({ category_id: categoryId, is_deleted: { $ne: true } });
}

module.exports = {
  pullAttributeFromCategories,
  pullTagFromProducts,
  countProductsUsingBrand,
  countProductsUsingCategory,
};
