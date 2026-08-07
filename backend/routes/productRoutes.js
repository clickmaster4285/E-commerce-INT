  const express = require("express");

  const {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
  } = require("../controllers/productController");

  const authMiddleware = require("../middleware/authMiddleware");
  const adminMiddleware = require("../middleware/adminMiddleware");

  const {
    productImagesUpload,
    validateProductImages,
  } = require("../middleware/productImageMiddleware");

  const saveProductImages = require("../middleware/saveProductImages");

  const router = express.Router();

  // CREATE PRODUCT
  router.post(
    "/",
    authMiddleware,
    adminMiddleware,
    productImagesUpload,
    validateProductImages,
    saveProductImages,
    createProduct,
  );

  // UPDATE PRODUCT
  router.put(
    "/:id",
    authMiddleware,
    adminMiddleware,
    productImagesUpload,
    validateProductImages,
    saveProductImages,
    updateProduct,
  );

  // DELETE PRODUCT
  router.delete("/:id", authMiddleware, adminMiddleware, deleteProduct);

  // GET ALL PRODUCTS
  router.get("/", authMiddleware, getProducts);

  // GET SINGLE PRODUCT
  router.get("/:id", authMiddleware, getProductById);

  module.exports = router;
