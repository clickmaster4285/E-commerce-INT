const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const { 
  placeOrder, 
  getMyOrders, 
  getOrderById, 
  getAllOrders,          // ✅ Import
  updateOrderStatus,    // ✅ Import
  editOrder,            // ✅ Import
  deleteOrder,          // ✅ Import
  getOrderByIdAdmin,   // ✅ Import
  updatePaymentStatus ,   // ✅ Import

} = require("../controllers/orderController");

const router = express.Router();

// User Routes
router.post("/", authMiddleware, placeOrder);
router.get("/my", authMiddleware, getMyOrders);
router.get("/:id", authMiddleware, getOrderById);
// ✅ User ke apne orders ke liye (edit + delete)
router.put("/:id/edit", authMiddleware, editOrder);
router.delete("/:id", authMiddleware, deleteOrder);

// ✅ Admin Routes (Requires 'order' permission)
router.get("/admin/all", authMiddleware, checkPermission("order"), getAllOrders);
router.get("/admin/:id", authMiddleware, checkPermission("order"), getOrderByIdAdmin); // ✅ NEW

router.patch("/admin/:id/status", authMiddleware, checkPermission("order"), updateOrderStatus);
router.patch("/admin/:id/payment", authMiddleware, checkPermission("order"), updatePaymentStatus);

module.exports = router;