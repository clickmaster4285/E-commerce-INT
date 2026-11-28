// Explicit storefront DTOs (§9.2) — never return whole Mongoose docs publicly.

function localizedName(doc, locale = "en") {
  if (!doc) return "";
  if (locale && locale !== "en") {
    const t = doc.translations?.name?.[locale];
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return String(doc.name || "").trim();
}

function imageUrl(doc) {
  if (!doc) return "";
  if (typeof doc.primary_image === "string" && doc.primary_image) return doc.primary_image;
  const imgs = doc.images || doc.variants?.[0]?.images;
  if (Array.isArray(imgs) && imgs[0]?.img_url) return imgs[0].img_url;
  return "";
}

/** Shop / home / search tile — ~8–10 KB shape */
function toProductTile(doc, locale = "en") {
  if (!doc) return null;
  const brand = doc.brand_id && typeof doc.brand_id === "object"
    ? { _id: doc.brand_id._id, name: localizedName(doc.brand_id, locale) || doc.brand_id.name }
    : doc.brand_id
      ? { _id: doc.brand_id, name: "" }
      : null;

  const variantCount = Number(doc.variant_count) || (Array.isArray(doc.variants) ? doc.variants.length : 0) || 0;
  const price = Number(doc.price ?? doc.price_from ?? doc.variants?.[0]?.selling_price) || 0;
  const totalStock = Number(doc.stock_total ?? doc.variants?.[0]?.quantity) || 0;
  const first = Array.isArray(doc.variants) && doc.variants[0] ? doc.variants[0] : null;

  return {
    _id: doc._id,
    name: localizedName(doc, locale) || doc.name || "",
    category_id: doc.category_id?._id || doc.category_id || null,
    brand,
    price,
    compareAt: doc.compare_at != null ? Number(doc.compare_at) : undefined,
    totalStock,
    image: imageUrl(doc),
    variantCount,
    rating: doc.rating_avg != null
      ? { avg: Number(doc.rating_avg) || 0, count: Number(doc.rating_count) || 0 }
      : undefined,
    singleVariant: variantCount === 1 && first
      ? {
          _id: first._id,
          sku: first.sku || "",
          price: Number(first.selling_price) || price,
          qty: Number(first.quantity) || totalStock,
          image: first.images?.[0]?.img_url || imageUrl(doc),
        }
      : undefined,
  };
}

/** Product detail page — no cost_price, no PO history, no audit refs */
function toProductDetail(doc, locale = "en") {
  if (!doc) return null;
  const category = doc.category_id && typeof doc.category_id === "object"
    ? { _id: doc.category_id._id, name: localizedName(doc.category_id, locale) || doc.category_id.name }
    : doc.category_id
      ? { _id: doc.category_id, name: "" }
      : null;
  const brand = doc.brand_id && typeof doc.brand_id === "object"
    ? { _id: doc.brand_id._id, name: localizedName(doc.brand_id, locale) || doc.brand_id.name }
    : doc.brand_id
      ? { _id: doc.brand_id, name: "" }
      : null;

  const variants = (doc.variants || []).map((v) => ({
    _id: v._id,
    sku: v.sku || "",
    title: v.title || "",
    description: v.description || "",
    price: Number(v.selling_price) || 0,
    qty: Number(v.quantity) || 0,
    attributes: v.attributes || [],
    images: (v.images || []).map((img) => (typeof img === "string" ? img : img?.img_url)).filter(Boolean),
  }));

  return {
    _id: doc._id,
    name: localizedName(doc, locale) || doc.name || "",
    description: doc.description || "",
    short_description: doc.short_description || "",
    category,
    brand,
    isPerishable: Boolean(doc.isPerishable),
    expiryDuration: doc.expiryDuration,
    expiryUnit: doc.expiryUnit,
    rating: {
      avg: Number(doc.rating_avg) || 0,
      count: Number(doc.rating_count) || 0,
      dist: doc.rating_dist || undefined,
    },
    variants,
  };
}

function toVariantPicker(variants = []) {
  return (variants || []).map((v) => ({
    _id: v._id,
    title: v.title || "",
    sku: v.sku || "",
    price: Number(v.selling_price) || 0,
    qty: Number(v.quantity) || 0,
    attributes: v.attributes || [],
    image: v.images?.[0]?.img_url || "",
  }));
}

module.exports = { toProductTile, toProductDetail, toVariantPicker, localizedName };
