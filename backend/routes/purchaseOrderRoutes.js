const express = require("express");
const { getNextPONumber, createPO, getAllPOs, getPOByIdAdmin, updatePO, confirmPO, cancelPO, closePO, deliverPO, receivePO, recordPOPayment } = require("../controllers/purchaseOrderController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const router = express.Router();

router.get("/next-code", authMiddleware, getNextPONumber);
router.get("/admin/all", authMiddleware, checkPermission("purchaseOrders"), getAllPOs);
router.post("/", authMiddleware, checkPermission("purchaseOrders"), createPO);
router.get("/admin/:id", authMiddleware, checkPermission("purchaseOrders"), getPOByIdAdmin);
router.put("/:id", authMiddleware, checkPermission("purchaseOrders"), updatePO);
router.patch("/admin/:id/confirm", authMiddleware, checkPermission("purchaseOrders"), confirmPO);
router.patch("/admin/:id/cancel", authMiddleware, checkPermission("purchaseOrders"), cancelPO);
router.patch("/admin/:id/close", authMiddleware, checkPermission("purchaseOrders"), closePO);
router.post("/admin/:id/deliver", authMiddleware, checkPermission("purchaseOrders"), checkPermission("manageStock"), deliverPO);
router.post("/admin/:id/receive", authMiddleware, checkPermission("purchaseOrders"), checkPermission("manageStock"), receivePO);
router.patch("/admin/:id/payment", authMiddleware, checkPermission("purchaseOrders"), recordPOPayment);

module.exports = router;
