const Cart = require("../models/Cart");
const { MAX_CART_ITEMS } = require("../models/shared/cartItemSchema");

// ==========================================
// GET CART (logged-in user)
// ==========================================
const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user_id: req.user._id || req.user.id });
    res.json({ success: true, data: cart?.items || [] });
  } catch (error) {
    (require("../utils/logger").error({ err: error }, "cartController failed"), res.status(500).json({ success: false, message: "Something went wrong. Please try again." }));
  }
};

// ==========================================
// SAVE CART (full replace)
// ==========================================
const saveCart = async (req, res) => {
  try {
    // ✅ Max 50 items (typed schema cap) — findOneAndUpdate me validators nahi chalte, isliye yahan slice
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, MAX_CART_ITEMS) : [];
    const userId = req.user._id || req.user.id;

    const cart = await Cart.findOneAndUpdate(
      { user_id: userId },
      { user_id: userId, items },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: cart.items });
  } catch (error) {
    (require("../utils/logger").error({ err: error }, "cartController failed"), res.status(500).json({ success: false, message: "Something went wrong. Please try again." }));
  }
};

module.exports = { getCart, saveCart };