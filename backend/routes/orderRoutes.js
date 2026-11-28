const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const { limiters } = require("../middleware/rateLimit");
const { 
  placeOrder, 
  getMyOrders, 
  getOrderById, 
  getAllOrders,          // ✅ Import
  getProductSummary,     // ✅ Import (product history summary)
  updateOrderStatus,    // ✅ Import
  editOrder,            // ✅ Import
  deleteOrder,          // ✅ Import
  getOrderByIdAdmin,   // ✅ Import
  updatePaymentStatus ,   // ✅ Import

} = require("../controllers/orderController");

const router = express.Router();

// User Routes
router.post("/", authMiddleware.requireUser, limiters.orderCreate, placeOrder);
router.get("/my", authMiddleware.requireUser, getMyOrders);
router.get("/:id", authMiddleware.requireUser, getOrderById);
// ✅ User ke apne orders ke liye (edit + delete)
router.put("/:id/edit", authMiddleware.requireUser, editOrder);
router.delete("/:id", authMiddleware.requireUser, deleteOrder);

// ✅ Admin Routes (Requires 'order' permission)
router.get("/admin/all", authMiddleware.requireAdmin, checkPermission("order"), getAllOrders);
// ⚠️ Ye /admin/:id se PEHLE hona zaroori hai, warna "product-summary" id samajh aayega
router.get("/admin/product-summary", authMiddleware.requireAdmin, checkPermission("order"), getProductSummary);
router.get("/admin/:id", authMiddleware.requireAdmin, checkPermission("order"), getOrderByIdAdmin); // ✅ NEW

router.patch("/admin/:id/status", authMiddleware.requireAdmin, checkPermission("order"), updateOrderStatus);
router.patch("/admin/:id/payment", authMiddleware.requireAdmin, checkPermission("order"), updatePaymentStatus);

module.exports = router;