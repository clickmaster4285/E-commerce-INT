const Cart = require("../models/Cart");

// ==========================================
// GET CART (logged-in user)
// ==========================================
const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user_id: req.user._id || req.user.id });
    res.json({ success: true, data: cart?.items || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// SAVE CART (full replace)
// ==========================================
const saveCart = async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const userId = req.user._id || req.user.id;

    const cart = await Cart.findOneAndUpdate(
      { user_id: userId },
      { user_id: userId, items },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: cart.items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getCart, saveCart };