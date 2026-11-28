// §3.7 — delete ke baad dangling refs saaf karna / referenced master-data delete block karna.
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Bundle = require("../models/Bundle");
const Deal = require("../models/Deal");
const Discount = require("../models/Discount");
const Cart = require("../models/Cart");
const CheckoutDraft = require("../models/CheckoutDraft");

async function pullAttributeFromCategories(attributeId) {
  return Category.updateMany(
    { "attributes.attribute_id": attributeId },
    { $pull: { attributes: { attribute_id: attributeId } } },
  );
}

async function pullTagFromProducts(tagId) {
  const [products, variants] = await Promise.all([
    Product.updateMany({ tag_ids: tagId }, { $pull: { tag_ids: tagId } }),
    Variant.updateMany({ tag_ids: tagId }, { $pull: { tag_ids: tagId } }),
  ]);
  return { products, variants };
}

async function countProductsUsingBrand(brandId) {
  return Product.countDocuments({ brand_id: brandId, is_deleted: { $ne: true } });
}
async function countProductsUsingCategory(categoryId) {
  return Product.countDocuments({ category_id: categoryId, is_deleted: { $ne: true } });
}

/** Product soft/hard delete → Bundle / Deal / Discount / cart refs clean */
async function cleanupProductReferences(productId) {
  const id = productId;
  const [bundles, deals, discounts, carts, drafts] = await Promise.all([
    Bundle.updateMany(
      { "products.product": id },
      { $pull: { products: { product: id } } },
    ).catch(() => null),
    Deal.updateMany(
      { productIds: id },
      { $pull: { productIds: id } },
    ).catch(() => null),
    Discount.updateMany(
      { $or: [{ productIds: id }, { "products": id }] },
      { $pull: { productIds: id, products: id } },
    ).catch(() => null),
    Cart.updateMany(
      { "items.product_id": id },
      { $pull: { items: { product_id: id } } },
    ).catch(() => null),
    CheckoutDraft.updateMany(
      { "items.product_id": id },
      { $pull: { items: { product_id: id } } },
    ).catch(() => null),
  ]);
  // Also drop cart/draft lines that only carry variant_id belonging to this product
  const variantIds = await Variant.find({ product_id: id }).select("_id").lean();
  const vids = variantIds.map((v) => v._id);
  if (vids.length) {
    await Promise.all([
      Cart.updateMany({ "items.variant_id": { $in: vids } }, { $pull: { items: { variant_id: { $in: vids } } } }).catch(() => null),
      CheckoutDraft.updateMany({ "items.variant_id": { $in: vids } }, { $pull: { items: { variant_id: { $in: vids } } } }).catch(() => null),
      Bundle.updateMany({ "products.variant": { $in: vids } }, { $pull: { products: { variant: { $in: vids } } } }).catch(() => null),
    ]);
  }
  return { bundles, deals, discounts, carts, drafts };
}

module.exports = {
  pullAttributeFromCategories,
  pullTagFromProducts,
  countProductsUsingBrand,
  countProductsUsingCategory,
  cleanupProductReferences,
};
