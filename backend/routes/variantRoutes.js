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
const adminMiddleware = require("../middleware/adminMiddleware");

const {
  productImagesUpload,
  validateProductImages,
} = require("../middleware/productImageMiddleware");

const saveProductImages = require("../middleware/saveProductImages");

const router = express.Router();


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
  adminMiddleware,
  productImagesUpload,
  validateProductImages,
  setCreateProductId,
  saveProductImages,
  createVariant
);

router.get(
  "/next-sku",
  authMiddleware,
  getNextSkuNumber
);

// UPDATE
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
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
  adminMiddleware,
  deleteVariant
);


// GET ALL
router.get(
  "/",
  authMiddleware,
  getVariants
);


// GET ONE
router.get(
  "/:id",
  authMiddleware,
  getVariantById
);


module.exports = router;