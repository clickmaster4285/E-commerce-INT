const express = require('express');
const router = express.Router();

// ✅ Yeh line sab se zaroori hai (apne path ke hisaab se adjust karein)
const authMiddleware = require('../middleware/authMiddleware'); 

const {
  createDiscount,
  getDiscounts,
  getDiscountById,
  updateDiscount,
  deleteDiscount
} = require('../controllers/discountController');

// ✅ Har route ke beech mein 'authMiddleware' lagana lazmi hai
router.post('/', authMiddleware, createDiscount);
router.get('/', authMiddleware, getDiscounts);
router.get('/:id', authMiddleware, getDiscountById);
router.put('/:id', authMiddleware, updateDiscount);
router.delete('/:id', authMiddleware, deleteDiscount);

module.exports = router;