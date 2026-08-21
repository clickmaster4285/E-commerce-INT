const mongoose = require("mongoose");

const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Tag = require("../models/Tag");

const { getNextSku } = require("../utils/skuHelper");
const { deleteProductUploadFolder } = require("../utils/uploadHelpers");

const { getIO } = require("../utils/socket");
const { pushGlobalActivity } = require("../utils/activityHelper");

// ======================================================
// SOCKET HELPER
// ======================================================
const emitSocketEvent = (event, data) => {
  try {
    const io = getIO();
    if (io) {
      io.emit(event, data);
    }
  } catch (error) {
    console.warn("⚠️ Socket emit failed:", error.message);
  }
};

// ======================================================
// JSON PARSER
// ======================================================
const parseJSON = (value, fallback = []) => {
  try {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value;
  } catch (error) {
    return fallback;
  }
};

// ======================================================
// NUMBER HELPER
// ======================================================
const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

// ======================================================
// SKU NORMALIZER
// ======================================================
const normalizeSku = (sku) => {
  return String(sku || "").trim();
};

// ======================================================
// REGEX ESCAPER
// ======================================================
const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ======================================================
// ⭐ SIMPLIFIED TAG RESOLVER (Find or Create)
// ======================================================
const resolveTags = async (tagNames, userId) => {
  if (!Array.isArray(tagNames) || tagNames.length === 0) return [];

  const cleanNames = [...new Set(
    tagNames
      .map(n => String(n).trim().toLowerCase())
      .filter(Boolean)
  )];

  if (cleanNames.length === 0) return [];

  const existingTags = await Tag.find({ 
    name: { $in: cleanNames }, 
    is_deleted: { $ne: true } 
  }).lean();

  const existingMap = new Map(existingTags.map(t => [t.name, t._id]));
  const finalTagIds = [];

  for (const name of cleanNames) {
    if (existingMap.has(name)) {
      finalTagIds.push(existingMap.get(name));
    } else {
      const newTag = await Tag.create({ 
        name, 
        createdby: userId, 
        updatedby: userId 
      });
      finalTagIds.push(newTag._id);
    }
  }

  return finalTagIds;
};

// ======================================================
// GET ALL PRODUCTS
// ======================================================
const getProducts = async (req, res) => {
  try {
    const products = await Product.find({
      is_deleted: { $ne: true },
    })
      .populate("category_id", "name")
      .populate("brand_id", "name")
      .populate("tag_ids", "name")
      .sort({ created_at: -1 })
      .lean();

    if (!products.length) {
      return res.status(200).json([]);
    }

    const productIds = products.map((product) => product._id);

    const variants = await Variant.find({
      product_id: { $in: productIds },
      is_deleted: { $ne: true },
    })
      .sort({ created_at: 1 })
      .lean();

    const variantsMap = {};
    variants.forEach((variant) => {
      const productId = String(variant.product_id);
      if (!variantsMap[productId]) {
        variantsMap[productId] = [];
      }
      variantsMap[productId].push(variant);
    });

    const result = products.map((product) => ({
      ...product,
      variants: variantsMap[String(product._id)] || [],
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error(" [getProducts] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to fetch products",
    });
  }
};

// ======================================================
// GET PRODUCT BY ID
// ======================================================
const getProductById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    })
      .populate("category_id", "name")
      .populate("brand_id", "name")
      .populate("tag_ids", "name")
      .lean();

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const variants = await Variant.find({
      product_id: product._id,
      is_deleted: { $ne: true },
    })
      .sort({ created_at: 1 })
      .lean();

    return res.status(200).json({
      ...product,
      variants,
    });
  } catch (error) {
    console.error("❌ [getProductById] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to fetch product",
    });
  }
};

// ======================================================
// CREATE PRODUCT
// ======================================================
const createProduct = async (req, res) => {
  let createdProduct = null;

  try {
    const productName = String(req.body.name || "").trim();

    if (!productName) {
      return res.status(400).json({ message: "Product name is required" });
    }

    if (!req.body.category_id) {
      return res.status(400).json({ message: "Category is required" });
    }

    if (!req.body.brand_id) {
      return res.status(400).json({ message: "Brand is required" });
    }

    const variants = parseJSON(req.body.variants, []);

    if (!Array.isArray(variants) || !variants.length) {
      return res.status(400).json({ message: "At least one variant is required" });
    }

    const tagNames = parseJSON(req.body.tag_names, []);
    const tagIds = await resolveTags(tagNames, req.user?._id);

    const productData = {
      name: productName,
      category_id: req.body.category_id,
      brand_id: req.body.brand_id,
      tag_ids: tagIds,
      description: String(req.body.description || "").trim(),
      tax: toNumber(req.body.tax, 0),
      status: req.body.status === "inactive" ? "inactive" : "active",
      createdby: req.user?._id || null,
      updatedby: req.user?._id || null,
      is_deleted: false,
      deleted_at: null,
      deletedby: null,
    };

    if (req.productId) {
      productData._id = req.productId;
    }

    createdProduct = await Product.create(productData);

    const imageVariantIndexes = parseJSON(req.body.image_variant_indexes, []);
    const imagesByVariant = {};

    (req.savedImages || []).forEach((image, fileIndex) => {
      const variantIndex = Number(imageVariantIndexes[fileIndex]) || 0;
      if (!imagesByVariant[variantIndex]) {
        imagesByVariant[variantIndex] = [];
      }
      imagesByVariant[variantIndex].push(image);
    });

    const createdVariants = [];
    const usedSkus = new Set();

    for (let index = 0; index < variants.length; index++) {
      const item = variants[index] || {};
      let sku = normalizeSku(item.sku);

      if (!sku) {
        sku = await getNextSku();
      }

      const skuKey = sku.toLowerCase();

      if (usedSkus.has(skuKey)) {
        throw new Error(`Duplicate SKU in request: ${sku}`);
      }

      const existingSku = await Variant.findOne({
        sku: { $regex: `^${escapeRegex(sku)}$`, $options: "i" },
      }).lean();

      if (existingSku) {
        throw new Error(`SKU ${sku} already exists`);
      }

      usedSkus.add(skuKey);

      const variant = await Variant.create({
        product_id: createdProduct._id,
        sku,
        title: item.title || item.variant_title || sku,
        description: item.description || "",
        cost_price: toNumber(item.cost_price, 0),
        selling_price: toNumber(item.selling_price, 0),
        quantity: toNumber(item.quantity, 0),
        min_qnt: toNumber(item.min_qnt, 0),
        max_qnt: toNumber(item.max_qnt, 0),
        attributes: item.attributes || {},
        // ✅ ADDED: Save variant tags during creation
        tags: Array.isArray(item.tags) ? item.tags : [],
        images: imagesByVariant[index] || [],
        createdby: req.user?._id || null,
        updatedby: req.user?._id || null,
        is_deleted: false,
        deleted_at: null,
        deletedby: null,
      });

      createdVariants.push(variant);
    }

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    await pushGlobalActivity(
      io,
      {
        action: `${performerName} created product "${createdProduct.name}"`,
        category: "Product Management",
        performedBy: performerId,
        performedByName: performerName,
        details: {
          productId: createdProduct._id,
          variantCount: createdVariants.length,
          tagCount: tagIds.length,
        },
      },
      performerId
    );

    emitSocketEvent("productCreated", {
      _id: createdProduct._id,
      name: createdProduct.name,
      tag_ids: createdProduct.tag_ids,
      variants: createdVariants,
    });

    return res.status(201).json({
      message: "Product created successfully",
      product: createdProduct,
      variants: createdVariants,
    });
  } catch (error) {
    console.error("❌ [createProduct] Error:", error);

    if (createdProduct) {
      await Variant.deleteMany({ product_id: createdProduct._id }).catch(() => {});
      await Product.findByIdAndDelete(createdProduct._id).catch(() => {});
      await deleteProductUploadFolder(createdProduct._id).catch(() => {});
    }

    return res.status(400).json({
      message: error.message || "Failed to create product",
    });
  }
};

// ======================================================
// UPDATE PRODUCT
// ======================================================
const updateProduct = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ message: "Product name is required" });
      }
      product.name = name;
    }

    if (req.body.category_id !== undefined) {
      if (!req.body.category_id) {
        return res.status(400).json({ message: "Category is required" });
      }
      product.category_id = req.body.category_id;
    }

    if (req.body.brand_id !== undefined) {
      if (!req.body.brand_id) {
        return res.status(400).json({ message: "Brand is required" });
      }
      product.brand_id = req.body.brand_id;
    }

    if (req.body.tag_names !== undefined) {
      const tagNames = parseJSON(req.body.tag_names, []);
      const tagIds = await resolveTags(tagNames, req.user?._id);
      product.tag_ids = tagIds;
    }

    if (req.body.description !== undefined) {
      product.description = String(req.body.description || "").trim();
    }

    if (req.body.tax !== undefined) {
      product.tax = toNumber(req.body.tax, 0);
    }

    if (req.body.status !== undefined) {
      product.status = req.body.status === "inactive" ? "inactive" : "active";
    }

    product.updatedby = req.user?._id || null;
    await product.save();

    const variants = parseJSON(req.body.variants, null);

    if (Array.isArray(variants)) {
      const imageVariantIndexes = parseJSON(req.body.image_variant_indexes, []);
      const imagesByVariant = {};

      (req.savedImages || []).forEach((image, fileIndex) => {
        const variantIndex = Number(imageVariantIndexes[fileIndex]) || 0;
        if (!imagesByVariant[variantIndex]) {
          imagesByVariant[variantIndex] = [];
        }
        imagesByVariant[variantIndex].push(image);
      });

      const existingVariants = await Variant.find({
        product_id: product._id,
        is_deleted: { $ne: true },
      });

      const existingVariantMap = new Map();
      existingVariants.forEach((variant) => {
        existingVariantMap.set(String(variant._id), variant);
      });

      const receivedVariantIds = new Set();

      for (let index = 0; index < variants.length; index++) {
        const item = variants[index] || {};

        // ==============================================
        // EXISTING VARIANT
        // ==============================================
        if (item._id) {
          const variantId = String(item._id);
          const variant = existingVariantMap.get(variantId);

          if (!variant) {
            return res.status(400).json({
              message: "Invalid variant or variant does not belong to this product",
            });
          }

          receivedVariantIds.add(variantId);

          if (item.sku !== undefined) {
            const sku = normalizeSku(item.sku);
            if (!sku) {
              return res.status(400).json({ message: "Variant SKU is required" });
            }

            const duplicateSku = await Variant.findOne({
              _id: { $ne: variant._id },
              sku: { $regex: `^${escapeRegex(sku)}$`, $options: "i" },
            }).lean();

            if (duplicateSku) {
              return res.status(400).json({ message: `SKU ${sku} already exists` });
            }
            variant.sku = sku;
          }

          if (item.title !== undefined || item.variant_title !== undefined) {
            variant.title = item.title || item.variant_title || variant.sku;
          }

          if (item.description !== undefined) {
            variant.description = item.description;
          }

          if (item.cost_price !== undefined) {
            variant.cost_price = toNumber(item.cost_price, 0);
          }

          if (item.selling_price !== undefined) {
            variant.selling_price = toNumber(item.selling_price, 0);
          }

          if (item.quantity !== undefined) {
            variant.quantity = toNumber(item.quantity, 0);
          }

          if (item.min_qnt !== undefined) {
            variant.min_qnt = toNumber(item.min_qnt, 0);
          }

          if (item.max_qnt !== undefined) {
            variant.max_qnt = toNumber(item.max_qnt, 0);
          }

          if (item.attributes !== undefined) {
            variant.attributes = item.attributes || {};
          }

          // ✅ ADDED: Update variant tags
          if (item.tags !== undefined) {
            variant.tags = Array.isArray(item.tags) ? item.tags : [];
          }

          if (imagesByVariant[index]) {
            const oldImages = Array.isArray(variant.images) ? variant.images : [];
            variant.images = [...oldImages, ...imagesByVariant[index]];
          }

          variant.updatedby = req.user?._id || null;
          await variant.save();
        }

        // ==============================================
        // NEW VARIANT
        // ==============================================
        else {
          let sku = normalizeSku(item.sku);
          if (!sku) {
            sku = await getNextSku();
          }

          const duplicateSku = await Variant.findOne({
            sku: { $regex: `^${escapeRegex(sku)}$`, $options: "i" },
          }).lean();

          if (duplicateSku) {
            return res.status(400).json({ message: `SKU ${sku} already exists` });
          }

          await Variant.create({
            product_id: product._id,
            sku,
            title: item.title || item.variant_title || sku,
            description: item.description || "",
            cost_price: toNumber(item.cost_price, 0),
            selling_price: toNumber(item.selling_price, 0),
            quantity: toNumber(item.quantity, 0),
            min_qnt: toNumber(item.min_qnt, 0),
            max_qnt: toNumber(item.max_qnt, 0),
            attributes: item.attributes || {},
            // ✅ ADDED: Save variant tags for new variants
            tags: Array.isArray(item.tags) ? item.tags : [],
            images: imagesByVariant[index] || [],
            createdby: req.user?._id || null,
            updatedby: req.user?._id || null,
            is_deleted: false,
            deleted_at: null,
            deletedby: null,
          });
        }
      }

      for (const oldVariant of existingVariants) {
        const oldId = String(oldVariant._id);
        if (!receivedVariantIds.has(oldId)) {
          oldVariant.is_deleted = true;
          oldVariant.deleted_at = new Date();
          oldVariant.deletedby = req.user?._id || null;
          await oldVariant.save();
        }
      }
    }

    const updatedVariants = await Variant.find({
      product_id: product._id,
      is_deleted: { $ne: true },
    })
      .sort({ created_at: 1 })
      .lean();

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    await pushGlobalActivity(
      io,
      {
        action: `${performerName} updated product "${product.name}"`,
        category: "Product Management",
        performedBy: performerId,
        performedByName: performerName,
        details: {
          productId: product._id,
          variantCount: updatedVariants.length,
          tagCount: product.tag_ids ? product.tag_ids.length : 0,
        },
      },
      performerId
    );

    emitSocketEvent("productUpdated", {
      _id: product._id,
      name: product.name,
      status: product.status,
      tag_ids: product.tag_ids,
      variants: updatedVariants,
    });

    return res.status(200).json({
      message: "Product updated successfully",
      product,
      variants: updatedVariants,
    });
  } catch (error) {
    console.error("❌ [updateProduct] Error:", error);
    return res.status(400).json({
      message: error.message || "Failed to update product",
    });
  }
};

// ======================================================
// DELETE PRODUCT
// ======================================================
const deleteProduct = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    product.is_deleted = true;
    product.deleted_at = new Date();
    product.deletedby = req.user?._id || null;
    await product.save();

    await Variant.updateMany(
      {
        product_id: product._id,
        is_deleted: { $ne: true },
      },
      {
        $set: {
          is_deleted: true,
          deleted_at: new Date(),
          deletedby: req.user?._id || null,
        },
      }
    );

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    await pushGlobalActivity(
      io,
      {
        action: `${performerName} deleted product "${product.name}"`,
        category: "Product Management",
        performedBy: performerId,
        performedByName: performerName,
        details: { productId: product._id },
      },
      performerId
    );

    emitSocketEvent("productDeleted", product._id);

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("❌ [deleteProduct] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to delete product",
    });
  }
};

// ======================================================
// TOGGLE PRODUCT STATUS
// ======================================================
const toggleProductStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    product.status = product.status === "active" ? "inactive" : "active";
    product.updatedby = req.user?._id || null;
    await product.save();

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    await pushGlobalActivity(
      io,
      {
        action: `${performerName} ${product.status === "active" ? "activated" : "deactivated"} product "${product.name}"`,
        category: "Product Management",
        performedBy: performerId,
        performedByName: performerName,
        details: { productId: product._id, status: product.status },
      },
      performerId
    );

    emitSocketEvent("productUpdated", {
      _id: product._id,
      name: product.name,
      status: product.status,
      tag_ids: product.tag_ids,
    });

    return res.status(200).json({
      message: `Product status updated to ${product.status}`,
      product,
    });
  } catch (error) {
    console.error("❌ [toggleProductStatus] Error:", error);
    return res.status(500).json({
      message: error.message || "Failed to update product status",
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================
module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
};