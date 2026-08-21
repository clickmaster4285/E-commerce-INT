const Order = require("../models/Order");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Address = require("../models/Address");

const FREE_DELIVERY_THRESHOLD = 5000;
const DELIVERY_FEE = 200;

// ==========================================
// POST /api/orders — Place Order
// ==========================================
const placeOrder = async (req, res) => {
  try {
    const { items, address_id, payment_method, notes } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }
    if (!["cod", "bank", "card"].includes(payment_method)) {
      return res.status(400).json({ success: false, message: "Invalid payment method" });
    }

    const address = await Address.findOne({ _id: address_id, user_id: req.user._id });
    if (!address) {
      return res.status(400).json({ success: false, message: "Address not found" });
    }

    // ✅ DB se price verify + stock check (tampering se bachao)
    let subtotal = 0;
    let taxTotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findOne({ _id: item.id, is_deleted: false });
      if (!product) {
        return res.status(400).json({ success: false, message: "Product not found or removed" });
      }

      let variant = null;
      if (item.variant_id) {
        variant = await Variant.findById(item.variant_id);
      } else {
        variant = await Variant.findOne({ product_id: product._id });
      }
      if (!variant) {
        return res.status(400).json({ success: false, message: "Variant not found" });
      }

      const qty = Math.max(1, Number(item.qty || 1));
      if (Number(variant.quantity) < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}" (available: ${variant.quantity})`,
        });
      }

      const price = Number(variant.selling_price || 0);
      subtotal += price * qty;
      taxTotal += price * qty * (Number(product.tax || 0) / 100);

      orderItems.push({
        product_id: product._id,
        variant_id: variant._id,
        name: product.name,
        brand: typeof product.brand_id === "object" ? product.brand_id?.name || "" : "",
        variantTitle: variant.title || "",
        image: variant.images?.[0]?.img_url || "",
        price,
        qty,
      });
    }

    // ✅ Stock decrement
    for (const oi of orderItems) {
      await Variant.updateOne({ _id: oi.variant_id }, { $inc: { quantity: -oi.qty } });
    }

       const shipping_method = req.body.shipping_method === "express" ? "express" : "standard";
    const shipping = shipping_method === "express"
      ? 500  // Express fee
      : (subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE);
    const tax = Math.round(taxTotal);
    const total = subtotal + shipping + tax;

    const count = await Order.countDocuments();
    const order_number = `ORD-${String(count + 1).padStart(5, "0")}`;

    const order = await Order.create({
              shipping_method,
      order_number,
      user_id: req.user._id,
      items: orderItems,
      address_id: address._id,
      address_snapshot: {
        full_name: address.full_name,
        phone: address.phone,
        country: address.country,
        street_address1: address.street_address1,
        street_address2: address.street_address2,
        city: address.city,
        state: address.state,
        zip_code: address.zip_code,
      },
      payment: { method: payment_method, status: "pending" },
      subtotal,
      shipping,
      tax,
      total,
      status: "pending",
      notes: notes || "",
    });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error("❌ [placeOrder] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// GET /api/orders/my — Meri orders
// ==========================================
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user_id: req.user._id })
      .sort({ created_at: -1 })
      .lean();
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// GET /api/orders/:id — Order detail (sirf apni)
// ==========================================
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user_id: req.user._id }).lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { placeOrder, getMyOrders, getOrderById };