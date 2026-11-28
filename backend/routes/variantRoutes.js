const express = require("express");

const {
  createVariant,
  getVariants,
  getVariantPicker,
  getVariantById,
  updateVariant,
  deleteVariant,
  getNextSkuNumber,
  setCreateProductId,
  setUpdateProductId,
} = require("../controllers/variantController");



// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { staffPermissionCheck, checkPermission } = require("../middleware/checkPermission");
const requireProducts = checkPermission("products");

const {
  productImagesUpload,
  validateProductImages,
} = require("../middleware/productImageMiddleware");

const saveProductImages = require("../middleware/saveProductImages");
const { invalidateOn } = require("../middleware/invalidateOn");

const router = express.Router();
const dropProductsCache = invalidateOn("products"); // 2xx ke BAAD drop


// setCreateProductId / setUpdateProductId ab variantController me hain (§5.1)


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