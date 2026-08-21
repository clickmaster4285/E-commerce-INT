const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); 
const { checkPermission } = require("../middleware/checkPermission");

const {
  createDiscount,
  getDiscounts,
  getDiscountById,
  updateDiscount,
  deleteDiscount
} = require('../controllers/discountController');

// ✅ STATIC ROUTE (Pehle likho)
router.get('/admin/all', authMiddleware, checkPermission("discounts"), getDiscounts);

// ✅ DYNAMIC ROUTES (Baad mein likho)
router.post('/', authMiddleware, checkPermission("discounts"), createDiscount);
router.get('/:id', authMiddleware, checkPermission("discounts"), getDiscountById);
router.put('/:id', authMiddleware, checkPermission("discounts"), updateDiscount);
router.delete('/:id', authMiddleware, checkPermission("discounts"), deleteDiscount);

module.exports = router;