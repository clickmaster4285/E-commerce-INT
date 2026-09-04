const Order = require("../models/Order");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Address = require("../models/Address");
const Discount = require("../models/Discount");
const Deal = require("../models/Deal");
const discountController = require("./discountController");
const calculateDiscountedPrice = discountController.calculateDiscountedPrice;

const emitOrderEvent = (event, data) => {
  try {
    const io = require("../utils/socket").getIO();
    if (io) io.emit(event, data);
  } catch (e) {}
};

const DELIVERY_FEE = 200;

/// ==========================================
// POST /api/orders — Place Order
// ✅ FIXED: Trust frontend snapshot, no re-calculation
// ==========================================
const placeOrder = async (req, res) => {
  try {
    const { items, address_id, payment_method, notes, shipping_method: reqShippingMethod } = req.body;

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

    let subtotal = 0;
    let taxTotal = 0;
    const orderItems = [];
    const uniqueDealIds = new Set();

    for (const item of items) {
      const keyParts = String(item.key || "").split("__");
      const rawId = item.id || item.productId || item._id || keyParts[0] || null;
      const rawVariantId = item.variant_id || (keyParts[1] !== "default" ? keyParts[1] : null);

      // ✅ Product/Variant fetch — sirf validation + snapshot ke liye
      let product = null;
      try { product = await Product.findById(rawId); } catch (e) { product = null; }
      if (!product || product.is_deleted) {
        console.error("❌ [placeOrder] Product not found | id:", rawId, "| item:", item.name);
        return res.status(400).json({
          success: false,
          message: `Product not found or removed (${item.name || "unknown"})`,
        });
      }

      let variant = null;
      if (rawVariantId) {
        try { variant = await Variant.findById(rawVariantId); } catch (e) { variant = null; }
      }
      if (!variant) {
        variant = await Variant.findOne({ product_id: product._id });
      }
      if (!variant) {
        return res.status(400).json({ success: false, message: "Variant not found" });
      }

      // =====================================================
      // ✅ TRUST FRONTEND SNAPSHOT — no re-calculation
      // Frontend ne already calculate kiya hai (checkout pe):
      //   - displayPrice (final discounted price)
      //   - originalPrice (before discount)
      //   - savings (per item discount savings)
      //   - dealSavings (buy X get Y savings)
      //   - freeItems / payableItems
      // =====================================================

      // Frontend se aaye calculated values
      const displayPrice = Number(item.displayPrice || item.price || variant.selling_price || 0);
      const originalPrice = Number(item.originalPrice || item.dealOriginalPrice || variant.selling_price || 0);
      const perItemSavings = Number(item.savings || 0);
      const dealSavings = Number(item.dealSavings || 0);
      const freeItems = Number(item.freeItems || 0);
      const qty = Math.max(1, Number(item.qty || 1));  // paid qty
      const payableItems = Number(item.payableItems || qty);
      const totalItems = payableItems + freeItems;  // total ship hone wale

      // Deal info (frontend se)
      const dealId = item.dealId || null;
      const dealType = item.dealType || "";
      const dealName = item.dealName || "";
      const dealBadge = item.dealBadge || "";
      const dealBuyQuantity = Number(item.dealBuyQuantity || 0);
      const dealGetQuantity = Number(item.dealGetQuantity || 0);

      // Discount name (frontend se ya product se fallback)
      const discountName = item.discountName || "";

      // ✅ Stock check TOTAL (paid + free) par
      if (Number(variant.quantity) < totalItems) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}" (available: ${variant.quantity})`,
        });
      }

      // ✅ Subtotal = PAID qty × FINAL PRICE (frontend calculated)
      subtotal += displayPrice * payableItems;
      taxTotal += displayPrice * payableItems * (Number(product.tax || 0) / 100);

      if (dealId) uniqueDealIds.add(dealId);

      orderItems.push({
        product_id: product._id,
        variant_id: variant._id,
        name: product.name,
        brand: typeof product.brand_id === "object" ? product.brand_id?.name || "" : (product.brand || ""),
        variantTitle: variant.title || "",
        image: variant.images?.[0]?.img_url || "",
        price: displayPrice,           // ✅ FRONTEND CALCULATED (final discounted)
        original_price: originalPrice, // ✅ BEFORE discount
        discount_name: discountName,
        savings: perItemSavings,       // ✅ Per-item discount savings
        qty: payableItems,             // ✅ PAID quantity (snapshot)
        deal_id: dealId,
        deal_type: dealType,
        deal_name: dealName,
        deal_buy_quantity: dealBuyQuantity,
        deal_get_quantity: dealGetQuantity,
        free_items: freeItems,         // ✅ FREE items (frontend calculated)
        payable_items: payableItems,   // ✅ PAID qty
        deal_savings: dealSavings,     // ✅ DEAL SAVINGS (frontend calculated)
      });
    }

    // ✅ Stock decrement = PAID + FREE (total ship hone wale)
    for (const oi of orderItems) {
      await Variant.updateOne(
        { _id: oi.variant_id },
        { $inc: { quantity: -(oi.qty + (oi.free_items || 0)) } }
      );
    }

    const shipping_method = reqShippingMethod === "express" ? "express" : "standard";
    const hasFreeShippingDeal = orderItems.some(i => i.deal_type === "free_shipping");
    let shipping;
    if (hasFreeShippingDeal) {
      shipping = 0;
    } else {
      const { calculateShipping } = require("./shippingController");
      const quote = await calculateShipping({
        items: items.map(i => ({ productId: i.productId || i.id, brandId: i.brandId, categoryId: i.categoryId })),
        method: shipping_method,
        subtotal,
      });
      shipping = quote.fee;
    }

    const tax = Math.round(taxTotal);
    const total = subtotal + shipping + tax;

    // ✅ SAFE ORDER NUMBER
    const getNextOrderNumber = async () => {
      const last = await Order.findOne({ order_number: /^ORD-/ })
        .sort({ order_number: -1 })
        .select("order_number")
        .lean();
      let next = 1;
      if (last?.order_number) {
        const m = last.order_number.match(/(\d+)$/);
        if (m) next = parseInt(m[1], 10) + 1;
      }
      return `ORD-${String(next).padStart(5, "0")}`;
    };

    let order;
    for (let attempt = 0; attempt < 5; attempt++) {
      const order_number = await getNextOrderNumber();
      try {
        order = await Order.create({
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
          deal_ids: Array.from(uniqueDealIds),
          total_deal_savings: orderItems.reduce((sum, i) => sum + (i.deal_savings || 0), 0),
        });
        break;
      } catch (err) {
        if (err.code === 11000 && attempt < 4) continue;
        throw err;
      }
    }

    // ✅ Increment deal usage count
    for (const dId of uniqueDealIds) {
      await Deal.findByIdAndUpdate(dId, { $inc: { usedCount: 1 } });
    }

    emitOrderEvent("order:created", { success: true, data: order });
    emitOrderEvent("order:updated", { success: true, data: order });
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

// ==========================================
// GET /api/orders/admin/all — Get All Orders (Admin Only)
// ==========================================
const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 15, status = "all", search = "" } = req.query;
    const query = {};

    if (status !== "all") {
      query.status = status;
    }

    if (search.trim()) {
      query.$or = [
        { order_number: { $regex: search, $options: "i" } },
        { "address_snapshot.full_name": { $regex: search, $options: "i" } },
        { "address_snapshot.phone": { $regex: search, $options: "i" } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("user_id", "name email phone")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Order.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      }
    });
  } catch (error) {
    console.error("❌ [getAllOrders] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// PATCH /api/orders/admin/:id/status — Update Order Status
// ==========================================
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, cancel_reason } = req.body;

    const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

      order.status = status;
    if (notes) order.notes = notes;
    if (status === "cancelled" && cancel_reason) order.cancel_reason = cancel_reason;

    await order.save();

    emitOrderEvent("order:updated", { success: true, data: order });
    emitOrderEvent("order:statusChanged", { success: true, data: order });
    res.status(200).json({ success: true, message: `Order status updated to ${status}`, data: order });
  } catch (error) {
    console.error("❌ [updateOrderStatus] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// PUT /api/orders/:id/edit — Edit Pending Order (Qty + Address)
// ✅ FIXED: Supports address_override for "order only" mode
// ==========================================
const editOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, address_id, address_override } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (String(order.user_id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You can only edit your own orders" });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ success: false, message: "Only pending orders can be edited" });
    }

    // ✅ Update Quantities
    if (Array.isArray(items) && items.length) {
      let subtotal = 0;
      let taxTotal = 0;

      order.items = order.items.map((item) => {
        const updated = items.find((i) => String(i._id || i.id) === String(item._id));
        const newQty = updated ? Math.max(1, Number(updated.qty) || 1) : item.qty;

        // ✅ Free items recalc (paid qty se UPAR se)
        let freeItems = 0;
        if (item.deal_type === "buy_x_get_y" && item.deal_buy_quantity && item.deal_get_quantity) {
          freeItems = Math.floor(newQty / item.deal_buy_quantity) * item.deal_get_quantity;
          item.deal_savings = freeItems * item.price;
        }

        item.qty = newQty;          // ✅ paid qty
        item.payable_items = newQty; // ✅ poora payment
        item.free_items = freeItems; // ✅ free UPAR se

        const lineTotal = item.price * newQty;
        subtotal += lineTotal;
        taxTotal += lineTotal * (Number(item.tax || 0) / 100);

        return item;
      });

      order.subtotal = Math.round(subtotal);
      order.tax = Math.round(taxTotal);
      order.total = order.subtotal + order.shipping + order.tax;
    }

    // ✅ Update Address — FIXED: supports address_override
    if (address_override && typeof address_override === "object") {
      // 🆕 Custom snapshot — address book UNTOUCHED (order-only mode)
      order.address_snapshot = {
        full_name: address_override.full_name || "",
        phone: address_override.phone || "",
        country: address_override.country || "",
        street_address1: address_override.street_address1 || "",
        street_address2: address_override.street_address2 || "",
        city: address_override.city || "",
        state: address_override.state || "",
        zip_code: address_override.zip_code || "",
        delivery_instructions: address_override.delivery_instructions || "",
      };
      // Optional: link to address_id if provided (for reference)
      if (address_id) {
        order.address_id = address_id;
      }
    } else if (address_id) {
      // ✅ Existing: use saved address
      const address = await Address.findOne({ _id: address_id, user_id: req.user._id });
      if (!address) {
        return res.status(400).json({ success: false, message: "Address not found" });
      }
      order.address_id = address._id;
      order.address_snapshot = {
        full_name: address.full_name,
        phone: address.phone,
        country: address.country,
        street_address1: address.street_address1,
        street_address2: address.street_address2,
        city: address.city,
        state: address.state,
        zip_code: address.zip_code,
        delivery_instructions: address.delivery_instructions || "",
      };
    }

    await order.save();

    emitOrderEvent("order:updated", { success: true, data: order });
    res.status(200).json({ success: true, message: "Order updated successfully", data: order });
  } catch (error) {
    console.error("❌ [editOrder] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// DELETE /api/orders/:id — Delete Pending Order
// ==========================================
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (String(order.user_id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You can only delete your own orders" });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ success: false, message: "Only pending orders can be deleted" });
    }

    // ✅ Stock wapas restore = PAID + FREE (total jo ship hone wala tha)
    for (const item of order.items) {
      if (item.variant_id) {
        await Variant.updateOne(
          { _id: item.variant_id },
          { $inc: { quantity: item.qty + (item.free_items || 0) } }
        );
      }
    }

    await Order.findByIdAndDelete(id);

    emitOrderEvent("order:deleted", { success: true, data: { id: req.params.id } });
    emitOrderEvent("order:updated", { success: true, data: { id: req.params.id, deleted: true } });
    res.status(200).json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    console.error("❌ [deleteOrder] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// GET /api/orders/admin/:id — Admin single order
// ==========================================
const getOrderByIdAdmin = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user_id", "name email phone")
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("❌ [getOrderByIdAdmin] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// PATCH /api/orders/admin/:id/payment — Mark Payment Received
// ==========================================
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["paid", "pending", "failed", "refunded"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid payment status" });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.payment.status = status;
    await order.save();

    emitOrderEvent("order:updated", { success: true, data: order });
    emitOrderEvent("order:paymentUpdated", { success: true, data: order });
    res.status(200).json({
      success: true,
      message: status === "paid" ? "Payment marked as received" : `Payment marked as ${status}`,
      data: order,
    });
  } catch (error) {
    console.error("❌ [updatePaymentStatus] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  placeOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  editOrder,
  deleteOrder,
  getOrderByIdAdmin,
  updatePaymentStatus,
};