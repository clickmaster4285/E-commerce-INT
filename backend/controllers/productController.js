const Product = require("../models/Product");
const Variant = require("../models/Variant");
const { getNextSku } = require("../utils/skuHelper");
const { deleteImageFile, deleteProductUploadFolder } = require("../utils/uploadHelpers");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity } = require("../utils/activityHelper");

const emitSocketEvent = (event, data) => {
  try {
    const io = getIO();
    if (io) io.emit(event, data);
  } catch (error) {
    console.warn(`⚠️ Socket emit failed:`, error.message);
  }
};

const parseJSON = (value, fallback) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : value ?? fallback;
  } catch {
    return fallback;
  }
};

// ==========================================
// ✅ GET ALL PRODUCTS — OPTIMIZED, KABHI HANG NAHI HOGA
// ==========================================
const getProducts = async (req, res) => {
  try {
    console.log("📦 [getProducts] Query start...");

    // Step 1: Sirf active (non-deleted) products lao — lean + fast
    const products = await Product.find({ is_deleted: { $ne: true } })
      .populate("category_id", "name")
      .populate("brand_id", "name")
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    console.log(`📦 [getProducts] Found ${products.length} products`);

    // Step 2: Agar koi product nahi mila, empty array bhejo (hang mat karo)
    if (!products || products.length === 0) {
      return res.status(200).json([]);
    }

    // Step 3: Saare product IDs ek saath variants fetch karo (N+1 query se bachao)
    const productIds = products.map((p) => p._id);
    const allVariants = await Variant.find({ product_id: { $in: productIds } })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    console.log(`📦 [getProducts] Found ${allVariants.length} variants`);

    // Step 4: Variants ko product-wise group karo
    const variantsMap = {};
    allVariants.forEach((v) => {
      const key = String(v.product_id);
      if (!variantsMap[key]) variantsMap[key] = [];
      variantsMap[key].push(v);
    });

    // Step 5: Final result assemble karo
    const result = products.map((product) => ({
      ...product,
      variants: variantsMap[String(product._id)] || [],
    }));

    console.log("✅ [getProducts] Sending response...");
    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ [getProducts] Error:", error);
    // ✅ ALWAYS response bhejo — kabhi hang mat karo
    return res.status(500).json({ message: error.message || "Failed to fetch products" });
  }
};

// ==========================================
// ✅ GET PRODUCT BY ID
// ==========================================
const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, is_deleted: { $ne: true } })
      .populate("category_id", "name")
      .populate("brand_id", "name")
      .lean();

    if (!product) return res.status(404).json({ message: "Product not found" });

    const variants = await Variant.find({ product_id: product._id }).lean();
    return res.status(200).json({ ...product, variants });
  } catch (error) {
    console.error("❌ [getProductById] Error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ==========================================
// ✅ CREATE PRODUCT
// ==========================================
const createProduct = async (req, res) => {
  let createdProduct = null;
  try {
    const variants = parseJSON(req.body.variants, []);
    const imageVariantIndexes = parseJSON(req.body.image_variant_indexes, []);
    if (!variants.length) return res.status(400).json({ message: "At least one variant is required" });

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
    if (req.productId) productData._id = req.productId;

    createdProduct = await Product.create(productData);

    const imagesByVariant = {};
    (req.savedImages || []).forEach((image, fileIndex) => {
      const variantIndex = Number(imageVariantIndexes[fileIndex]) || 0;
      if (!imagesByVariant[variantIndex]) imagesByVariant[variantIndex] = [];
      imagesByVariant[variantIndex].push(image);
    });

    const createdVariants = [];
    const usedSkus = new Set();
    for (let index = 0; index < variants.length; index++) {
      const item = variants[index];
      let sku = String(item.sku || "").trim();
      if (!sku) sku = await getNextSku();
      if (usedSkus.has(sku)) throw new Error(`Duplicate SKU: ${sku}`);
      const existingSku = await Variant.findOne({ sku });
      if (existingSku) throw new Error(`SKU ${sku} already exists`);
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

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();
    await pushGlobalActivity(io, {
      action: `${performerName} created product "${createdProduct.name}"`,
      category: "Product Management",
      performedBy: performerId,
      performedByName: performerName,
      details: { productId: createdProduct._id },
    }, performerId);

    emitSocketEvent("productCreated", { _id: createdProduct._id, name: createdProduct.name, variants: createdVariants });
    return res.status(201).json({ message: "Product created successfully", product: createdProduct, variants: createdVariants });
  } catch (error) {
    if (createdProduct) {
      await Variant.deleteMany({ product_id: createdProduct._id }).catch(() => {});
      await Product.findByIdAndDelete(createdProduct._id).catch(() => {});
      await deleteProductUploadFolder(createdProduct._id).catch(() => {});
    }
    return res.status(400).json({ message: error.message });
  }
};

// ==========================================
// ✅ UPDATE PRODUCT
// ==========================================
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (req.body.name !== undefined) product.name = req.body.name;
    if (req.body.category_id !== undefined) product.category_id = req.body.category_id;
    if (req.body.brand_id !== undefined) product.brand_id = req.body.brand_id;
    if (req.body.description !== undefined) product.description = req.body.description;
    if (req.body.tax !== undefined) product.tax = Number(req.body.tax);
    if (req.body.status !== undefined) product.status = req.body.status;
    product.updatedby = req.user?._id || null;
    await product.save();

    // Variants processing (agar aap ke paas pehle se logic hai to wo yahan rakho)
    const variants = parseJSON(req.body.variants, []);
    const imageVariantIndexes = parseJSON(req.body.image_variant_indexes, []);

    if (variants.length > 0) {
      const imagesByVariant = {};
      (req.savedImages || []).forEach((image, fileIndex) => {
        const variantIndex = Number(imageVariantIndexes[fileIndex]) || 0;
        if (!imagesByVariant[variantIndex]) imagesByVariant[variantIndex] = [];
        imagesByVariant[variantIndex].push(image);
      });

      for (let index = 0; index < variants.length; index++) {
        const item = variants[index];
        const variantData = {
          title: item.title || item.sku,
          description: item.description || "",
          cost_price: Number(item.cost_price || 0),
          selling_price: Number(item.selling_price || 0),
          quantity: Number(item.quantity || 0),
          min_qnt: Number(item.min_qnt || 0),
          max_qnt: Number(item.max_qnt || 0),
          attributes: item.attributes || {},
          updatedby: req.user?._id || null,
        };
        if (imagesByVariant[index]) variantData.images = imagesByVariant[index];

        if (item._id) {
          await Variant.findByIdAndUpdate(item._id, variantData);
        } else {
          await Variant.create({ ...variantData, product_id: product._id, sku: item.sku });
        }
      }
    }

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();
    await pushGlobalActivity(io, {
      action: `${performerName} updated product "${product.name}"`,
      category: "Product Management",
      performedBy: performerId,
      performedByName: performerName,
      details: { productId: product._id },
    }, performerId);

    emitSocketEvent("productUpdated", { _id: product._id, name: product.name, status: product.status });
    return res.status(200).json({ message: "Product updated successfully", product });
  } catch (error) {
    console.error("❌ [updateProduct] Error:", error);
    return res.status(400).json({ message: error.message });
  }
};

// ==========================================
// ✅ DELETE PRODUCT (Soft Delete)
// ==========================================
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.is_deleted = true;
    product.deleted_at = new Date();
    product.deletedby = req.user?._id || null;
    await product.save();

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();
    await pushGlobalActivity(io, {
      action: `${performerName} deleted product "${product.name}"`,
      category: "Product Management",
      performedBy: performerId,
      performedByName: performerName,
      details: { productId: product._id },
    }, performerId);

    emitSocketEvent("productDeleted", req.params.id);
    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("❌ [deleteProduct] Error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// ==========================================
// ✅ TOGGLE STATUS
// ==========================================
const toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.status = product.status === "active" ? "inactive" : "active";
    product.updatedby = req.user?._id || null;
    await product.save();

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();
    await pushGlobalActivity(io, {
      action: `${performerName} ${product.status === "active" ? "activated" : "deactivated"} product "${product.name}"`,
      category: "Product Management",
      performedBy: performerId,
      performedByName: performerName,
      details: { status: product.status },
    }, performerId);

    emitSocketEvent("productUpdated", { _id: product._id, name: product.name, status: product.status });
    return res.status(200).json({ message: `Product status updated to ${product.status}`, product });
  } catch (error) {
    console.error("❌ [toggleProductStatus] Error:", error);
    return res.status(500).json({ message: error.message });
  }
};
// ==========================================
// 🌐 GET ALL PRODUCTS — PUBLIC (User GUI)
// Sirf ACTIVE + NON-DELETED
// ==========================================
const getProductsPublic = async (req, res) => {
  try {
    const products = await Product.find({
      is_deleted: false,
      status: "active",
    })
      .populate("category_id", "name")
      .populate("brand_id", "name")
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!products || products.length === 0) {
      return res.status(200).json([]);
    }

    const productIds = products.map((p) => p._id);
    const allVariants = await Variant.find({ product_id: { $in: productIds } })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    const variantsMap = {};
    allVariants.forEach((v) => {
      const key = String(v.product_id);
      if (!variantsMap[key]) variantsMap[key] = [];
      variantsMap[key].push(v);
    });

    const result = products.map((product) => ({
      ...product,
      variants: variantsMap[String(product._id)] || [],
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ [getProductsPublic] Error:", error);
    return res.status(500).json({ message: error.message || "Failed to fetch products" });
  }
};

// ==========================================
// 🛡️ GET ALL PRODUCTS — ADMIN
// NON-DELETED (active + inactive dono)
// ==========================================
const getProductsAdmin = async (req, res) => {
  try {
    const products = await Product.find({ is_deleted: false })
      .populate("category_id", "name")
      .populate("brand_id", "name")
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!products || products.length === 0) {
      return res.status(200).json([]);
    }

    const productIds = products.map((p) => p._id);
    const allVariants = await Variant.find({ product_id: { $in: productIds } })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    const variantsMap = {};
    allVariants.forEach((v) => {
      const key = String(v.product_id);
      if (!variantsMap[key]) variantsMap[key] = [];
      variantsMap[key].push(v);
    });

    const result = products.map((product) => ({
      ...product,
      variants: variantsMap[String(product._id)] || [],
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ [getProductsAdmin] Error:", error);
    return res.status(500).json({ message: error.message || "Failed to fetch products" });
  }
};
module.exports = {
  createProduct,
  getProducts,
  getProductsPublic,
  getProductsAdmin,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
};