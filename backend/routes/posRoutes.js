const express = require("express");
const { getPosProducts, getPosSales, getPosSaleById, getPosReturns, createPosSale, updatePosSale, getPosSummary, getCustomerPosHistory, returnPosSaleItems } = require("../controllers/posController");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");

const router = express.Router();

router.get("/products", authMiddleware, checkPermission("pos"), getPosProducts);
router.get("/summary", authMiddleware, checkPermission("pos"), getPosSummary);
router.get("/sales", authMiddleware, checkPermission("pos"), getPosSales);
router.get("/returns", authMiddleware, checkPermission("pos"), getPosReturns);
router.get("/sales/:id", authMiddleware, checkPermission("pos"), getPosSaleById);
router.get("/customers/:customerId/history", authMiddleware, checkPermission("pos"), getCustomerPosHistory);
router.post("/sales", authMiddleware, checkPermission("pos"), createPosSale);
router.put("/sales/:id", authMiddleware, checkPermission("pos"), updatePosSale);
router.post("/sales/:id/returns", authMiddleware, checkPermission("pos"), returnPosSaleItems);

module.exports = router;
