const express = require("express");
const { getPosProducts, getPosSales, getPosSaleById, createPosSale, updatePosSale, getCustomerPosHistory, returnPosSaleItems } = require("../controllers/posController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");

const router = express.Router();

router.get("/products", authMiddleware, checkPermission("pos"), getPosProducts);
router.get("/sales", authMiddleware, checkPermission("pos"), getPosSales);
router.get("/sales/:id", authMiddleware, checkPermission("pos"), getPosSaleById);
router.get("/customers/:customerId/history", authMiddleware, checkPermission("pos"), getCustomerPosHistory);
router.post("/sales", authMiddleware, checkPermission("pos"), createPosSale);
router.put("/sales/:id", authMiddleware, checkPermission("pos"), updatePosSale);
router.post("/sales/:id/returns", authMiddleware, checkPermission("pos"), returnPosSaleItems);

module.exports = router;
