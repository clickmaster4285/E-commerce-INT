const express = require("express");

const {
  createVariant,
  getVariants,
  getVariantById,
  updateVariant,
  deleteVariant,
  getNextSkuNumber,
} = require("../controllers/variantController");

const Variant = require("../models/Variant");

const authMiddleware = require("../middleware/authMiddleware");
const { staffPermissionCheck } = require("../middleware/checkPermission");

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
  getNextSkuNumber
);

// UPDATE
router.put(
  "/:id",
  authMiddleware,
  staffPermissionCheck,
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
  dropProductsCache,
  deleteVariant
);


// GET ALL
router.get(
  "/",
  authMiddleware,
  staffPermissionCheck,
  getVariants
);


// GET ONE
router.get(
  "/:id",
  authMiddleware,
  staffPermissionCheck,
  getVariantById
);


module.exports = router;