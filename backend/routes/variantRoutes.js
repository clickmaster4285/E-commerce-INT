const express = require("express");

const {
  createVariant,
  getVariants,
  getVariantPicker,
  getVariantById,
  updateVariant,
  deleteVariant,
  getNextSkuNumber,
} = require("../controllers/variantController");

const Variant = require("../models/Variant");

// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { staffPermissionCheck, checkPermission } = require("../middleware/checkPermission");
const requireProducts = checkPermission("products");

const {
  productImagesUpload,
  validateProductImages,
} = require("../middleware/productImageMiddleware");

const saveProductImages = require("../middleware/saveProductImages");
const { invalidate } = require("../utils/publicCache");

const router = express.Router();
const dropProductsCache = (req, res, next) => {
  invalidate("products");
  next();
};


// Product ID set for CREATE
const setCreateProductId = (req, res, next) => {
  req.productId = req.body.product_id;
  next();
};


// Product ID find for UPDATE
const setUpdateProductId = async (req, res, next) => {
  try {
    const variant = await Variant.findById(req.params.id);

    if (!variant) {
      return res.status(404).json({
        message: "Variant not found",
      });
    }

    req.productId = variant.product_id;

    next();
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};


// CREATE
router.post(
  "/",
  authMiddleware,
  staffPermissionCheck,
  requireProducts,
  dropProductsCache,
  productImagesUpload,
  validateProductImages,
  setCreateProductId,
  saveProductImages,
  createVariant
);

router.get(
  "/next-sku",
  authMiddleware,
  staffPermissionCheck,
  requireProducts,
  getNextSkuNumber
);

router.get(
  "/picker",
  authMiddleware,
  staffPermissionCheck,
  requireProducts,
  getVariantPicker
);

// UPDATE
router.put(
  "/:id",
  authMiddleware,
  staffPermissionCheck,
  requireProducts,
  dropProductsCache,
  setUpdateProductId,
  productImagesUpload,
  validateProductImages,
  saveProductImages,
  updateVariant
);


// DELETE
router.delete(
  "/:id",
  authMiddleware,
  staffPermissionCheck,
  requireProducts,
  dropProductsCache,
  deleteVariant
);


// GET ALL
router.get(
  "/",
  authMiddleware,
  staffPermissionCheck,
  requireProducts,
  getVariants
);


// GET ONE
router.get(
  "/:id",
  authMiddleware,
  staffPermissionCheck,
  requireProducts,
  getVariantById
);


module.exports = router;