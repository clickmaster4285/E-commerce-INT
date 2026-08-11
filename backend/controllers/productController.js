const Product = require("../models/Product");
const Variant = require("../models/Variant");
const { getNextSku } = require("../utils/skuHelper");
const {
  deleteImageFile,
  deleteProductUploadFolder,
} = require("../utils/uploadHelpers");
const { getIO } = require("../utils/socket");

// ==========================================
// ✅ SOCKET EMIT HELPER
// ==========================================
const emitSocketEvent = (event, data) => {
  try {
    const io = getIO();
    if (io) {
      io.emit(event, data);
      console.log(`📡 Socket emitted: ${event}`);
    }
  } catch (error) {
    console.warn(`⚠️ Socket emit failed for ${event}:`, error.message);
  }
};

// ==========================================
// PARSE JSON
// ==========================================
const parseJSON = (value, fallback) => {
  try {
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

// ==========================================
// CREATE PRODUCT
// ==========================================
const createProduct = async (req, res) => {
  let createdProduct = null;

  try {
    const variants = parseJSON(req.body.variants, []);
    const imageVariantIndexes = parseJSON(req.body.image_variant_indexes, []);

    if (!variants.length) {
      return res.status(400).json({ message: "At least one variant is required" });
    }

    const productData = {
      name: req.body.name,
      category_id: req.body.category_id,
      brand_id: req.body.brand_id,
      description: req.body.description || "",
      tax: Number(req.body.tax || 0),
      status: req.body.status === "inactive" ? "inactive" : "active",
      createdby: req.user?._id || null,
      updatedby: req.user?._id || null,
    };

    if (req.productId) {
      productData._id = req.productId;
    }

    createdProduct = await Product.create(productData);

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
      const item = variants[index];
      let sku = String(item.sku || "").trim();

      if (!sku) {
        sku = await getNextSku();
      }

      if (usedSkus.has(sku)) {
        throw new Error(`Duplicate SKU: ${sku}`);
      }

      const existingSku = await Variant.findOne({ sku });
      if (existingSku) {
        throw new Error(`SKU ${sku} already exists`);
      }

      usedSkus.add(sku);

      const variant = await Variant.create({
        product_id: createdProduct._id,
        sku,
        title: item.title || item.variant_title || sku,
        description: item.description || "",
        cost_price: Number(item.cost_price || 0),
        selling_price: Number(item.selling_price || 0),
        quantity: Number(item.quantity || 0),
        min_qnt: Number(item.min_qnt || 0),
        max_qnt: Number(item.max_qnt || 0),
        attributes: item.attributes || {},
        images: imagesByVariant[index] || [],
        createdby: req.user?._id || null,
        updatedby: req.user?._id || null,
      });

      createdVariants.push(variant);
    }

    // ✅ SOCKET: Product Created — flat structure for frontend compatibility
    emitSocketEvent("productCreated", {
      _id: createdProduct._id,
      name: createdProduct.name,
      brand_id: createdProduct.brand_id,
      category_id: createdProduct.category_id,
      status: createdProduct.status,
      variants: createdVariants,
    });

    return res.status(201).json({
      message: "Product created successfully",
      product: createdProduct,
      variants: createdVariants,
    });
  } catch (error) {
    if (createdProduct) {
      await Variant.deleteMany({ product_id: createdProduct._id });
      await Product.findByIdAndDelete(createdProduct._id);
      await deleteProductUploadFolder(createdProduct._id);
    }

    return res.status(400).json({ message: error.message });
  }
};

// ==========================================
// ✅ GET ALL PRODUCTS — UPDATED WITH brand_id FILTER
// ==========================================
const getProducts = async (req, res) => {
  try {
    // ✅ Build filter dynamically
    const filter = { is_deleted: { $ne: true } };

    // ✅ Agar brand_id query param aaya hai, to sirf us brand ke products lao
    if (req.query.brand_id) {
      filter.brand_id = req.query.brand_id;
    }

    const products = await Product.find(filter)
      .select("-__v")
      .populate("category_id", "category_code name")
      .populate("brand_id", "brand_code name")
      .sort({ created_at: -1 });

    const result = await Promise.all(
      products.map(async (product) => {
        const variants = await Variant.find({ product_id: product._id }).select("-__v");
        return { ...product.toObject(), variants };
      })
    );

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ==========================================
// GET PRODUCT BY ID
// ==========================================
const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    })
      .select("-__v")
      .populate("category_id", "category_code name")
      .populate("brand_id", "brand_code name")
      .populate("createdby", "email")
      .populate("updatedby", "email");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const variants = await Variant.find({ product_id: product._id }).select("-__v");

    return res.status(200).json({ ...product.toObject(), variants });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ==========================================
// UPDATE PRODUCT AND VARIANTS
// ==========================================
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Update Product Fields
    if (req.body.name !== undefined) product.name = req.body.name;
    if (req.body.category_id !== undefined) product.category_id = req.body.category_id;
    if (req.body.brand_id !== undefined) product.brand_id = req.body.brand_id;
    if (req.body.description !== undefined) product.description = req.body.description;
    if (req.body.tax !== undefined) product.tax = Number(req.body.tax);
    if (req.body.status !== undefined) product.status = req.body.status;
    product.updatedby = req.user?._id || null;
    await product.save();

    // Parse Variants
    const incomingVariants = parseJSON(req.body.variants, []);
    const imageVariantIndexes = parseJSON(req.body.image_variant_indexes, []);

    if (!incomingVariants.length) {
      return res.status(400).json({ message: "At least one variant is required" });
    }

    const imagesByVariant = {};
    (req.savedImages || []).forEach((image, fileIndex) => {
      const variantIndex = Number(imageVariantIndexes[fileIndex]) || 0;
      if (!imagesByVariant[variantIndex]) imagesByVariant[variantIndex] = [];
      imagesByVariant[variantIndex].push(image);
    });

    const retainedVariantIds = [];
    const requestSkus = new Set();

    for (let index = 0; index < incomingVariants.length; index++) {
      const item = incomingVariants[index];
      let sku = String(item.sku || "").trim();
      if (!sku) sku = await getNextSku();

      if (requestSkus.has(sku)) throw new Error(`Duplicate SKU: ${sku}`);
      requestSkus.add(sku);

      const existingImages = Array.isArray(item.existing_images) ? item.existing_images : [];
      const newImages = imagesByVariant[index] || [];

      if (item._id) {
        // Update Existing Variant
        const variant = await Variant.findOne({ _id: item._id, product_id: product._id });
        if (!variant) throw new Error(`Variant not found for SKU ${sku}`);

        const duplicate = await Variant.findOne({ sku, _id: { $ne: variant._id } });
        if (duplicate) throw new Error(`SKU ${sku} already exists`);

        const retainedUrls = existingImages.map((img) => img?.img_url).filter(Boolean);
        for (const oldImage of variant.images || []) {
          if (!retainedUrls.includes(oldImage.img_url)) {
            await deleteImageFile(oldImage.img_url);
          }
        }

        variant.sku = sku;
        variant.title = item.title || item.variant_title || sku;
        variant.description = item.description || "";
        variant.cost_price = Number(item.cost_price || 0);
        variant.selling_price = Number(item.selling_price || 0);
        variant.quantity = Number(item.quantity || 0);
        variant.min_qnt = Number(item.min_qnt || 0);
        variant.max_qnt = Number(item.max_qnt || 0);
        variant.attributes = item.attributes || {};
        variant.images = [...existingImages, ...newImages];
        variant.updatedby = req.user?._id || null;

        await variant.save();
        retainedVariantIds.push(variant._id.toString());
      } else {
        // Create New Variant
        const duplicate = await Variant.findOne({ sku });
        if (duplicate) throw new Error(`SKU ${sku} already exists`);

        const variant = await Variant.create({
          product_id: product._id,
          sku,
          title: item.title || item.variant_title || sku,
          description: item.description || "",
          cost_price: Number(item.cost_price || 0),
          selling_price: Number(item.selling_price || 0),
          quantity: Number(item.quantity || 0),
          min_qnt: Number(item.min_qnt || 0),
          max_qnt: Number(item.max_qnt || 0),
          attributes: item.attributes || {},
          images: newImages,
          createdby: req.user?._id || null,
          updatedby: req.user?._id || null,
        });

        retainedVariantIds.push(variant._id.toString());
      }
    }

    // Remove Deleted Variants
    const oldVariants = await Variant.find({ product_id: product._id });
    for (const variant of oldVariants) {
      const variantId = variant._id.toString();
      if (!retainedVariantIds.includes(variantId)) {
        for (const image of variant.images || []) {
          await deleteImageFile(image.img_url);
        }
        await Variant.findByIdAndDelete(variant._id);
      }
    }

    const updatedVariants = await Variant.find({ product_id: product._id }).select("-__v");

    // ✅ SOCKET: Product Updated — flat structure with _id at top level
    emitSocketEvent("productUpdated", {
      _id: product._id,
      name: product.name,
      brand_id: product.brand_id,
      category_id: product.category_id,
      status: product.status,
      variants: updatedVariants,
    });

    return res.status(200).json({
      message: "Product updated successfully",
      product,
      variants: updatedVariants,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// ==========================================
// DELETE PRODUCT - SOFT DELETE
// ==========================================
const deleteProduct = async (req, res) => {
  try {
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

    // ✅ SOCKET: Product Deleted — send plain string ID for frontend compatibility
    emitSocketEvent("productDeleted", req.params.id);

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};