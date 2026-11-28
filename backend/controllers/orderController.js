const mongoose = require("mongoose");
const Order = require("../models/Order");
const CheckoutDraft = require("../models/CheckoutDraft");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Address = require("../models/Address");
const Discount = require("../models/Discount");
const Deal = require("../models/Deal");
const Bundle = require("../models/Bundle");
const discountController = require("./discountController");
const log = require("../utils/logger");
const { nextSeq, ensureSeeded, formatNumber, maxNumericSuffix } = require("../utils/counter");
const { priceCheckout } = require("../services/pricing/checkout"); // server-side cart pricing
const { withTx, TxAbort } = require("../utils/tx"); // one transaction per checkout
const calculateDiscountedPrice = discountController.calculateDiscountedPrice;

const emitOrderEvent = (event, data) => {
  try {
    const io = require("../utils/socket").getIO();
    if (io) io.emit(event, data);
  } catch (e) {}
};

// ✅ Live stock sync — order par stock kam/aur bar hone par manage-stock page
//    socket se refresh ho jata hai (manual page refresh ki zaroorat nahi).
const emitStockEvent = (data) => {
  emitOrderEvent("stockUpdated", data);
};

const DELIVERY_FEE = 200;

/// ==========================================
// POST /api/orders — Place Order
// ✅ FIXED: Trust frontend snapshot, no re-calculation
// ==========================================
const placeOrder = async (req, res) => {
  try {
    const {
      items,
      address_id,
      payment_method,
      notes,
      checkout_draft_id: rawCheckoutDraftId,
      shipping_method: reqShippingMethod,
      bank_sender_name,
      bank_transaction_ref,
    } = req.body;
    const checkoutDraftId = mongoose.isValidObjectId(rawCheckoutDraftId)
      ? rawCheckoutDraftId
      : null;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // 🔁 IDEMPOTENCY — ek checkout attempt = ek key (frontend Idempotency-Key header).
    // Double click / network retry same key ke sath aaye to naya order NAHI,
    // pehle wala order lautao (unique index {storeId, idempotency_key}).
    const rawIdemKey = String(req.get("Idempotency-Key") || req.body?.idempotency_key || "").trim();
    const idempotencyKey = /^[A-Za-z0-9_-]{8,100}$/.test(rawIdemKey) ? rawIdemKey : undefined;
    if (idempotencyKey) {
      const existing = await Order.findOne({ user_id: req.user._id, idempotency_key: idempotencyKey }).lean();
      if (existing) return res.status(200).json({ success: true, data: existing, replayed: true });
    }
    if (!["cod", "bank", "card"].includes(payment_method)) {
      return res.status(400).json({ success: false, message: "Invalid payment method" });
    }

    // 🔒 PCI: raw PAN / CVV / expiry kabhi accept nahi (optimizeplan.md §2.2).
    // payment_method "card" ab sirf intent hai; charged provider token flow baad me.
    if (
      req.body?.card_number != null
      || req.body?.card_cvv != null
      || req.body?.card_expiry != null
      || req.body?.card_holder_name != null
    ) {
      return res.status(400).json({
        success: false,
        code: "CARD_DATA_REJECTED",
        message: "Card details must not be sent to this server. Choose another payment method.",
      });
    }

    // ✅ Validate bank transfer fields when payment method is bank
    if (payment_method === "bank") {
      const trimmedSenderName = (bank_sender_name || "").trim();
      const trimmedTransactionRef = (bank_transaction_ref || "").trim();
      
      if (!trimmedSenderName) {
        return res.status(400).json({
          success: false,
          message: "Sender name is required for bank transfer",
        });
      }
      if (!trimmedTransactionRef) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID / Reference is required for bank transfer",
        });
      }
    }

    const address = await Address.findOne({ _id: address_id, user_id: req.user._id });
    if (!address) {
      return res.status(400).json({ success: false, message: "Address not found" });
    }

    // =====================================================
    // 💰 SERVER-SIDE PRICING (services/pricing/checkout.js)
    // Pehle yahan "TRUST FRONTEND SNAPSHOT" tha: displayPrice / freeItems /
    // savings / bundle price browser se aate the → koi bhi price 1 bhej sakta
    // tha. Ab loop sirf product / variant / deal / bundle DB se load + validate
    // karta hai; price, free items aur savings server storefront wale rules se
    // nikalta hai. Client ka price sirf compare: farq → 409 PRICE_CHANGED.
    // PRICING_MODE=log (sirf emergency) → purana behaviour + mismatch log.
    // =====================================================
    const now = new Date();
    const activeDiscounts = await Discount.find({
      is_deleted: false,
      isActive: true,
      status: "active",
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).select("type value discountValue applyTo selectedProducts selectedCategories selectedBrands isActive name usageLimit usageCount").lean();

    const DEAL_PRICING_FIELDS = "name type applyTo productIds categoryIds brandIds discountValue buyQuantity getQuantity minQuantity isActive startDate endDate freeShippingMethods usageLimit perUserLimit";
    const BUNDLE_DEAL_FIELDS = "name type isActive startDate endDate bundleRule bundlePrice bundleProducts";
    const pricingLines = [];
    const shippingItems = [];
    const uniqueDealIds = new Set();
    const uniqueBundleIds = new Set();
    const orderItems = [];

    for (const [index, item] of items.entries()) {
      const keyParts = String(item.key || "").split("__");
      const rawId = item.id || item.productId || item._id || keyParts[0] || null;
      const rawVariantId = item.variant_id || (keyParts[1] !== "default" ? keyParts[1] : null);

      // ✅ Product/Variant fetch — validation + snapshot + PRICE (server)
      let product = null;
      try { product = await Product.findById(rawId).lean(); } catch (e) { product = null; }
      if (!product || product.is_deleted) {
        log.warn("[placeOrder] Product not found | id:", rawId, "| item:", item.name);
        return res.status(400).json({
          success: false,
          message: `Product not found or removed (${item.name || "unknown"})`,
        });
      }

      let variant = null;
      if (rawVariantId) {
        try { variant = await Variant.findOne({ _id: rawVariantId, product_id: product._id }).lean(); } catch (e) { variant = null; }
      }
      if (!variant) {
        variant = await Variant.findOne({ product_id: product._id }).lean();
      }
      if (!variant) {
        return res.status(400).json({ success: false, message: "Variant not found" });
      }

      const qty = Math.max(1, Math.floor(Number(item.qty || 1))); // paid qty
      const isGift = Boolean(item.isBundleGift);

      // ✅ Bundle (combo) lines — rule / price DB ke bundle doc se, client se nahi
      const bundleId =
        item.bundleId && /^[a-f\d]{24}$/i.test(String(item.bundleId))
          ? String(item.bundleId)
          : null;
      let bundleDoc = null;
      let bundleDealDoc = null;
      if (bundleId) {
        [bundleDoc, bundleDealDoc] = await Promise.all([
          Bundle.findById(bundleId).select("name bundlePrice products isActive").lean(),
          Deal.findOne({ _id: bundleId, type: "bundle" }).select(BUNDLE_DEAL_FIELDS).lean(),
        ]);
        const dealWindowOk = bundleDealDoc
          && bundleDealDoc.isActive !== false
          && (!bundleDealDoc.startDate || new Date(bundleDealDoc.startDate) <= now)
          && (!bundleDealDoc.endDate || new Date(bundleDealDoc.endDate) >= now);
        if (!dealWindowOk) bundleDealDoc = null;
        if (bundleDoc && bundleDoc.isActive === false) bundleDoc = null;
        if (!bundleDoc && !bundleDealDoc) {
          return res.status(400).json({
            success: false,
            message: `"${item.name}" was part of a bundle that is no longer available`,
          });
        }
      }

      // ✅ Deal lines (non-bundle) — threshold check (pehle jaisa message)
      const dealId = !bundleId && item.dealId ? item.dealId : null;
      let dealDoc = null;
      if (dealId) {
        if (!mongoose.isValidObjectId(dealId)) {
          return res.status(400).json({
            success: false,
            message: `"${item.name}" has an invalid deal. Please remove it and try again.`,
          });
        }
        dealDoc = await Deal.findById(dealId).select(DEAL_PRICING_FIELDS).lean();
        if (!dealDoc || !dealDoc.isActive) {
          return res.status(400).json({
            success: false,
            message: `The deal for "${item.name}" is no longer available. Please update your cart.`,
          });
        }
        const minQty = Number(dealDoc.minQuantity) || 1;
        const buyQty = dealDoc.type === "buy_x_get_y" ? Number(dealDoc.buyQuantity) || 0 : 0;
        const threshold = Math.max(minQty, buyQty);
        if (qty < threshold) {
          const remaining = threshold - qty;
          return res.status(400).json({
            success: false,
            message: `"${item.name}" requires at least ${threshold} items for this deal. You have selected only ${qty}. Please add ${remaining} more item${remaining === 1 ? "" : "s"}.`,
          });
        }
        uniqueDealIds.add(String(dealId));
      }
      if (bundleId) uniqueBundleIds.add(bundleId);

      pricingLines.push({
        index,
        qty,
        product,
        variant,
        isGift,
        dealDoc,
        bundleId,
        bundleDoc,
        bundleDealDoc,
        clientUnit: item.displayPrice ?? item.price,
        clientFree: item.freeItems,
      });
      shippingItems.push({ productId: product._id, brandId: product.brand_id, categoryId: product.category_id });

      // Snapshot (price fields neeche server pricing se bharte hain)
      orderItems.push({
        product_id: product._id,
        variant_id: variant._id,
        name: product.name,
        brand: String(item.brand || ""),
        variantTitle: variant.title || "",
        image: variant.images?.[0]?.img_url || "",
        price: 0,
        tax_rate: Number(product.tax) || 0,
        original_price: Number(variant.selling_price) || 0,
        discount_name: "",
        savings: 0,
        qty,
        deal_id: dealDoc?._id || null,
        deal_type: dealDoc?.type || "",
        deal_name: dealDoc?.name || "",
        deal_buy_quantity: Number(dealDoc?.buyQuantity) || 0,
        deal_get_quantity: Number(dealDoc?.getQuantity) || 0,
        free_items: 0,
        payable_items: qty,
        deal_savings: 0,
        bundle_id: bundleId,
        bundle_name: bundleDealDoc?.name || bundleDoc?.name || "",
        bundle_price: 0,
        bundle_savings: 0,
      });
    }

    const { priced, mismatches, errors: pricingErrors } = priceCheckout({ lines: pricingLines, discounts: activeDiscounts, now });
    if (pricingErrors.length) {
      const first = pricingErrors[0];
      const name = items[first.index]?.name || orderItems[first.index]?.name || "an item";
      const messages = {
        DEAL_NOT_APPLICABLE: `The deal for "${name}" no longer applies. Please update your cart.`,
        BUNDLE_NOT_AVAILABLE: `"${name}" was part of a bundle that is no longer available`,
        BUNDLE_GIFT_INVALID: `The free gift "${name}" does not match the bundle offer. Please update your cart.`,
      };
      return res.status(400).json({ success: false, code: first.code, message: messages[first.code] || "Your cart needs an update." });
    }
    const pricingMode = String(process.env.PRICING_MODE || "enforce").toLowerCase();
    if (mismatches.length) {
      log.warn({ mismatches: mismatches.slice(0, 20), mode: pricingMode }, "[placeOrder] client prices differ from server pricing");
      if (pricingMode !== "log") {
        return res.status(409).json({
          success: false,
          code: "PRICE_CHANGED",
          message: "Prices in your cart have changed. Please review your cart and try again.",
          items: mismatches.map((m) => ({ index: m.index, name: orderItems[m.index]?.name, price: m.serverUnit, freeItems: m.serverFree })),
        });
      }
    }

    let subtotal = 0;
    let taxTotal = 0;
    orderItems.forEach((oi, index) => {
      const p = priced.get(index);
      const client = items[index] || {};
      // PRICING_MODE=log: purana (client) hisaab; warna hamesha server
      const useClient = pricingMode === "log";
      const unit = useClient ? Number(client.displayPrice || client.price || p.unit || 0) : p.unit;
      const free = useClient ? Number(client.freeItems || 0) : p.free;
      oi.price = unit;
      oi.free_items = free;
      oi.discount_name = p.discountName || "";
      oi.discount_id = p.discountId || null;
      oi.savings = p.perItemSavings;
      oi.deal_savings = p.dealSavings;
      oi.bundle_savings = p.bundleSavings;
      oi.bundle_price = oi.bundle_id ? unit : 0;
      subtotal += unit * oi.qty;
      taxTotal += unit * oi.qty * ((Number(oi.tax_rate) || 0) / 100);
    });
    subtotal = Math.round(subtotal * 100) / 100;

    // ✅ Stock check TOTAL (paid + free) par — free items ab server se pata hain
    for (const [index, oi] of orderItems.entries()) {
      const lineVariant = pricingLines[index].variant;
      if (Number(lineVariant.quantity) < oi.qty + oi.free_items) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${oi.name}" (available: ${lineVariant.quantity})`,
        });
      }
    }

    // ✅ Custom shipping method support:
    //    'standard'/'express' as-is; koi bhi aur code sirf tab accepted
    //    jab wo active custom ShippingMethod ho — warna standard fallback.
    let shipping_method = "standard";
    if (reqShippingMethod === "express" || reqShippingMethod === "standard") {
      shipping_method = reqShippingMethod;
    } else if (reqShippingMethod) {
      const ShippingMethod = require("../models/ShippingMethod");
      const customMethod = await ShippingMethod.findOne({
        code: String(reqShippingMethod),
        is_active: true,
      }).lean();
      if (customMethod) shipping_method = String(reqShippingMethod);
    }

    // ✅ Fetch the free_shipping deal docs so we can honour freeShippingMethods
    //    (missing/empty array => BOTH methods, backward compatible).
    const freeShipDeals = await Deal.find({
      _id: { $in: Array.from(uniqueDealIds) },
      type: "free_shipping",
      isActive: true,
    }).select("_id freeShippingMethods").lean();

    const isFreeForMethod = (method) =>
      Array.isArray(freeShipDeals) &&
      freeShipDeals.some((d) => {
        const arr = d.freeShippingMethods;
        if (!Array.isArray(arr) || arr.length === 0) return true;
        return arr.includes(method);
      });

    const hasFreeShippingDeal = isFreeForMethod(shipping_method);
    let shipping;
    if (hasFreeShippingDeal) {
      shipping = 0;
    } else {
      const { calculateShipping } = require("./shippingController");
      const quote = await calculateShipping({
        // Shipping rules ke liye category / brand DB product se (client ke bheje ids nahi)
        items: shippingItems,
        method: shipping_method,
        subtotal,
      });
      shipping = quote.fee;
    }

    const tax = Math.round(taxTotal);
    const total = subtotal + shipping + tax;

    // =====================================================
    // 🔒 ONE TRANSACTION (utils/tx.js): stock + deal usage + order number +
    // order + draft — sab ek saath commit, ya kuch bhi nahi. Pehle ye alag
    // alag writes the: beech me fail → stock kam, order nahi; deal usedCount
    // order ke BAAD aur bina limit check ke badhta tha.
    // Business rule fail → TxAbort → poora rollback (manual restore ki zaroorat nahi).
    // =====================================================
    // Order counter transaction se PEHLE seed (andar seed race tx abort kar deti)
    const orderSeed = () => maxNumericSuffix(Order, "order_number", /^ORD-/);
    await ensureSeeded("order", { seed: orderSeed });

    let stockTouchedOnOrder = [];
    let dealsIncremented = [];
    let discountsIncremented = [];
    const uniqueDiscountIds = new Set(
      orderItems.map((oi) => oi.discount_id).filter(Boolean).map(String),
    );
    let order;
    try {
      ({ result: order } = await withTx(async () => {
        stockTouchedOnOrder = []; // driver retry par callback dobara chalta hai
        dealsIncremented = [];
        discountsIncremented = [];

        // 1) Stock — conditional decrement (PAID + FREE)
        for (const oi of orderItems) {
          const need = oi.qty + (oi.free_items || 0);
          const result = await Variant.updateOne(
            { _id: oi.variant_id, quantity: { $gte: need } },
            { $inc: { quantity: -need } },
          );
          if (!result.modifiedCount) {
            throw new TxAbort(400, { success: false, message: `Insufficient stock for "${oi.name}". Please refresh your cart.` });
          }
          stockTouchedOnOrder.push({ variant_id: oi.variant_id, change: -need });
        }

        // 2) Deal usage — global usageLimit (atomic conditional $inc) + perUserLimit
        for (const dId of uniqueDealIds) {
          const dealDoc = pricingLines.find((l) => l.dealDoc && String(l.dealDoc._id) === String(dId))?.dealDoc;
          const perUserLimit = Number(dealDoc?.perUserLimit) || 0;
          if (perUserLimit > 0) {
            const used = await Order.countDocuments({ user_id: req.user._id, deal_ids: dId, status: { $ne: "cancelled" } });
            if (used >= perUserLimit) {
              throw new TxAbort(400, { success: false, code: "DEAL_LIMIT_REACHED", message: `You have already used the deal "${dealDoc?.name || ""}" the maximum number of times.` });
            }
          }
          const inc = await Deal.updateOne(
            {
              _id: dId,
              $or: [
                { usageLimit: null },
                { usageLimit: { $lte: 0 } },
                { $expr: { $lt: [{ $ifNull: ["$usedCount", 0] }, "$usageLimit"] } },
              ],
            },
            { $inc: { usedCount: 1 } },
          );
          if (inc.matchedCount) dealsIncremented.push(dId);
          if (!inc.matchedCount) {
            throw new TxAbort(400, { success: false, code: "DEAL_LIMIT_REACHED", message: `The deal "${dealDoc?.name || ""}" has reached its usage limit. Please update your cart.` });
          }
        }

        // 2b) Discount usage — usageLimit via conditional $inc on usageCount (§4.2 step 5)
        for (const discId of uniqueDiscountIds) {
          const discDoc = activeDiscounts.find((d) => String(d._id) === String(discId));
          const inc = await Discount.updateOne(
            {
              _id: discId,
              $or: [
                { usageLimit: null },
                { usageLimit: { $lte: 0 } },
                { $expr: { $lt: [{ $ifNull: ["$usageCount", 0] }, "$usageLimit"] } },
              ],
            },
            { $inc: { usageCount: 1 } },
          );
          if (inc.matchedCount) discountsIncremented.push(discId);
          if (!inc.matchedCount) {
            throw new TxAbort(400, {
              success: false,
              code: "DISCOUNT_LIMIT_REACHED",
              message: `The discount "${discDoc?.name || ""}" has reached its usage limit. Please update your cart.`,
            });
          }
        }

        // 3) Order number (atomic counter) + order
        const seq = await nextSeq("order", { seed: orderSeed });
        const [created] = await Order.create([{
          shipping_method,
          order_number: formatNumber("ORD-", seq, 5),
          user_id: req.user._id,
          checkout_draft_id: checkoutDraftId,
          idempotency_key: idempotencyKey,
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
          bundle_ids: Array.from(uniqueBundleIds),
          total_bundle_savings: orderItems.reduce((sum, i) => sum + (i.bundle_savings || 0), 0),
        }]);

        // 4) Complete all active drafts for this user (same transaction)
        await CheckoutDraft.updateOne(
          { user_id: req.user._id },
          {
            $set: {
              "drafts.$[draft].status": "completed",
              "drafts.$[draft].order_id": created._id,
              "drafts.$[draft].updatedAt": new Date(),
            },
          },
          { arrayFilters: [{ "draft.status": { $ne: "completed" } }] },
        );
        return created;
      }));
    } catch (txError) {
      if (txError instanceof TxAbort) return res.status(txError.status).json(txError.body);
      // Do concurrent submits same Idempotency-Key ke sath → doosra unique index par
      // fail; pehle wala order hi lautao (double order nahi).
      if (txError?.code === 11000 && idempotencyKey && /idempotency_key/.test(String(txError.message || ""))) {
        const existing = await Order.findOne({ user_id: req.user._id, idempotency_key: idempotencyKey }).lean();
        if (existing) return res.status(200).json({ success: true, data: existing, replayed: true });
      }
      throw txError;
    }

    // ✅ Commit ke BAAD hi events (rollback hua order kabhi broadcast na ho)
    if (stockTouchedOnOrder.length > 0) {
      emitStockEvent({ variants: stockTouchedOnOrder, source: "order_placed" });
    }
    emitOrderEvent("order:created", { success: true, data: order });
    emitOrderEvent("order:updated", { success: true, data: order });
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    log.error("❌ [placeOrder] Error:", error);
    res.status(500).json({ success: false, message: "Could not place your order. Please try again." });
  }
};

// ==========================================
// GET /api/orders/my/summary — account stats (counts only, §9.2)
const getMyOrdersSummary = async (req, res) => {
  try {
    const rows = await Order.aggregate([
      { $match: { user_id: req.user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byStatus = {};
    let total = 0;
    for (const row of rows) {
      byStatus[row._id] = row.count;
      total += row.count;
    }
    const active = total
      - (byStatus.delivered || 0)
      - (byStatus.cancelled || 0);
    return res.status(200).json({
      success: true,
      data: { total, active, byStatus },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/orders/my — Meri orders (optional server-side pagination)
// ✅ Non-breaking: agar ?limit= nahi bheja to purana full-array response
// ==========================================
const getMyOrders = async (req, res) => {
  try {
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 0; // 0 = legacy mode
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const status = String(req.query.status || "all").trim();
    const search = String(req.query.search || "").trim();
    const sort = String(req.query.sort || "newest");
    const timeRange = String(req.query.timeRange || "all");

    const filter = { user_id: req.user._id };

    // Status filter
    if (status && status !== "all" && status !== "draft") {
      filter.status = status;
    }

    // Search filter
    if (search) {
      const rx = { $regex: search, $options: "i" };
      filter.$or = [
        { order_number: rx },
        { "items.name": rx },
      ];
    }

    // Time range filter
    if (timeRange && timeRange !== "all") {
      const days = Number(timeRange);
      if (Number.isFinite(days) && days > 0) {
        const cutoff = new Date(Date.now() - days * 86400000);
        filter.created_at = { $gte: cutoff };
      }
    }

    // ---- LEGACY MODE (no limit) → hard-capped (§4.5) ----
    if (!limit) {
      const { legacyCap } = require("../utils/legacyListCap");
      let query = Order.find(filter).limit(legacyCap(0, 50));
      if (sort === "oldest") query = query.sort({ created_at: 1 });
      else if (sort === "total_high") query = query.sort({ total: -1 });
      else if (sort === "total_low") query = query.sort({ total: 1 });
      else query = query.sort({ created_at: -1 });

      const orders = await query.lean();
      return res.status(200).json({ success: true, data: orders });
    }

    // ---- PAGINATED MODE ----
    const total = await Order.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages || 1);
    const skip = (safePage - 1) * limit;

    let query = Order.find(filter);
    // Sort
    if (sort === "oldest") query = query.sort({ created_at: 1 });
    else if (sort === "total_high") query = query.sort({ total: -1 });
    else if (sort === "total_low") query = query.sort({ total: 1 });
    else query = query.sort({ created_at: -1 }); // newest (default)

    const orders = await query.skip(skip).limit(limit).lean();

    // Status counts (for filter chips)
    const counts = await Order.aggregate([
      { $match: { user_id: req.user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const statusCounts = {};
    counts.forEach((c) => { statusCounts[c._id] = c.count; });
    const totalOrders = counts.reduce((s, c) => s + c.count, 0);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: safePage,
        limit,
        pages,
        hasNext: safePage < pages,
        hasPrev: safePage > 1,
      },
      counts: statusCounts,
      totalOrders,
    });
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
// ✅ FIX: Search text ko safe regex banane ke liye — warna ".", "[", "(" jaise
//    special characters query ko bigaad dete hain (ya crash/slow kar dete hain).
const { escapeRegex } = require("../utils/escapeRegex");

// ==========================================
// ✅ SHARED ADMIN ORDER FILTER
//    List + summary dono isi builder se filters lete hain — is liye
//    product filter ke saath status/payment/shipping/time/search
//    hamesha ek jaise lagte hain.
// ==========================================
// ✅ Strict check — sirf 24-char hex ObjectId. Random/garbage ids gracefully reject hoti hain
//    (Types.ObjectId.isValid 12-char strings ko bhi "valid" maan leta hai).
const isValidProductId = (value) =>
  Boolean(value) && mongoose.isObjectIdOrHexString(String(value));

const buildAdminOrderFilter = ({
  status = "all",
  search = "",
  payment = "all",
  shipping = "all",
  dateRange = "all",
  productId = "",
} = {}) => {
  const query = {};

  if (status && status !== "all") {
    query.status = status;
  }

  // ✅ Payment / shipping ab bhi query me hain (pehle sirf frontend pe filter hote the)
  if (payment && payment !== "all") {
    query["payment.status"] = payment;
  }

  if (shipping && shipping !== "all") {
    query.shipping_method = shipping;
  }

  // ✅ Product filter — order match hoga agar KISI BHI line item ka product_id match kare.
  //    Invalid id par crash nahi hoga: query me kuch nahi jodenge (empty result).
  if (isValidProductId(productId)) {
    query["items.product_id"] = new mongoose.Types.ObjectId(String(productId));
  }

  if (dateRange && dateRange !== "all") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (dateRange === "today") {
      query.created_at = { $gte: startOfToday };
    } else if (dateRange === "yesterday") {
      const y = new Date(startOfToday);
      y.setDate(y.getDate() - 1);
      query.created_at = { $gte: y, $lt: startOfToday };
    } else if (dateRange === "7d") {
      const c = new Date(startOfToday);
      c.setDate(c.getDate() - 7);
      query.created_at = { $gte: c };
    } else if (dateRange === "30d") {
      const c = new Date(startOfToday);
      c.setDate(c.getDate() - 30);
      query.created_at = { $gte: c };
    }
  }

  if (search && String(search).trim()) {
    // ✅ FIX: escaped regex — "." ya "[" jaise characters search ko break nahi karenge
    const rx = new RegExp(escapeRegex(String(search).trim()), "i");
    query.$or = [
      { order_number: rx },
      { "address_snapshot.full_name": rx },
      { "address_snapshot.phone": rx },
    ];
  }

  return query;
};

// ==========================================
// 🌐 LOCALE + SLIM HELPERS — admin orders (brand/banner admin lists ka pattern)
//    Response me sirf FRONT data: populated product/variant ki sirf selected
//    locale translation, aur internals (checkout_draft_id, address_id,
//    translation_source/status, __v) payload se bahar.
// ==========================================
const parseOrderLocale = (value) => {
  const requestedLocale = String(value || "en").trim().toLowerCase();
  return /^[a-z]{2}$/.test(requestedLocale) ? requestedLocale : "en";
};

// ✅ Populated ref ki translations sirf selected locale tak trim karo
const slimRefTranslations = (doc, field, locale) => {
  if (!doc || locale === "en") return null;
  const value = doc.translations?.[field]?.[locale];
  if (typeof value !== "string" || !value.trim()) return null;
  return { [field]: { [locale]: value } };
};

const slimOrderItem = (item, locale) => {
  if (!item) return item;
  return {
    ...item,
    ...(item.product_id && typeof item.product_id === "object"
      ? {
          product_id: {
            _id: item.product_id._id,
            name: item.product_id.name,
            ...(slimRefTranslations(item.product_id, "name", locale) && {
              translations: slimRefTranslations(item.product_id, "name", locale),
            }),
          },
        }
      : {}),
    ...(item.variant_id && typeof item.variant_id === "object"
      ? {
          variant_id: {
            _id: item.variant_id._id,
            title: item.variant_id.title,
            ...(slimRefTranslations(item.variant_id, "title", locale) && {
              translations: slimRefTranslations(item.variant_id, "title", locale),
            }),
          },
        }
      : {}),
  };
};

// ✅ Order ki notes/cancel_reason translations sirf selected locale ki
const slimOrderTranslations = (order, locale) => {
  if (locale === "en" || !order.translations) return null;
  const out = {};
  ["notes", "cancel_reason"].forEach((field) => {
    const value = order.translations?.[field]?.[locale];
    if (typeof value === "string" && value.trim()) out[field] = { [locale]: value };
  });
  return Object.keys(out).length ? out : {};
};

// ✅ List/detail rows me sirf wahi fields jate hain jo front par dikhte hain
//    (table + mobile card + expand preview + detail page). createdby jaise
//    internals + translation metadata response me leak nahi hoti.
const mapFrontOrder = (order, locale) => ({
  _id: order._id,
  order_number: order.order_number,
  user_id: order.user_id && typeof order.user_id === "object"
    ? { _id: order.user_id._id, name: order.user_id.name, email: order.user_id.email, phone: order.user_id.phone }
    : order.user_id ?? null,
  items: (order.items || []).map((item) => slimOrderItem(item, locale)),
  address_snapshot: order.address_snapshot,
  shipping_method: order.shipping_method,
  payment: { method: order.payment?.method, status: order.payment?.status },
  subtotal: order.subtotal,
  shipping: order.shipping,
  tax: order.tax,
  total: order.total,
  status: order.status,
  notes: order.notes ?? "",
  cancel_reason: order.cancel_reason ?? "",
  deal_ids: order.deal_ids,
  bundle_ids: order.bundle_ids,
  total_deal_savings: order.total_deal_savings,
  total_bundle_savings: order.total_bundle_savings,
  created_at: order.created_at,
  updated_at: order.updated_at,
  ...(slimOrderTranslations(order, locale) && { translations: slimOrderTranslations(order, locale) }),
});

// ✅ Server-side sorting whitelist — frontend sort key -> DB field
const ORDER_SORT_FIELDS = {
  order_number: "order_number",
  customer: "address_snapshot.full_name",
  total: "total",
  payment: "payment.method",
  status: "status",
  created_at: "created_at",
};

// GET /api/orders/admin/all — Get All Orders (Admin Only)
// ==========================================
const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const query = buildAdminOrderFilter(req.query);
    const locale = parseOrderLocale(req.query.locale);

    // ✅ Invalid productId -> koi crash nahi, empty result + explicit flag
    //    (frontend "No orders found for this product." empty state dikhata hai)
    if (req.query.productId && !isValidProductId(req.query.productId)) {
      return res.status(200).json({
        success: true,
        data: [],
        invalidProductId: true,
        counts: { total: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0 },
        pagination: { total: 0, page: 1, limit: Number(limit) || 15, pages: 1, totalPages: 1, hasNext: false, hasPrev: false },
      });
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 15));

    // ✅ Sorting bhi server par hoti hai (whitelist ke ilawa koi custom field nahi).
    //    Default: created_at desc (legacy jaisa) — ties par _id stable order.
    const sortKeyRaw = String(req.query.sort || "").trim();
    const hasSort = Boolean(ORDER_SORT_FIELDS[sortKeyRaw]);
    const sortField = hasSort ? ORDER_SORT_FIELDS[sortKeyRaw] : "created_at";
    const rawOrder = String(req.query.order || "").trim().toLowerCase();
    const sortOrder = hasSort ? (rawOrder === "asc" ? 1 : -1) : -1;

    const total = await Order.countDocuments(query);
    const pages = Math.max(1, Math.ceil(total / limitNum));
    const safePage = Math.min(pageNum, pages);

    // ✅ Stat card counts — pehle 5 alag count queries jaisa behaviour:
    //    sirf status + product filter, baaki filters counts me nahi lagte
    const countsQuery = buildAdminOrderFilter({ productId: req.query.productId });

    const [orders, totalOrders, pendingOrders, shippedOrders, deliveredOrders, cancelledOrders] =
      await Promise.all([
        Order.find(query)
          .populate("user_id", "name email phone")
          .populate("items.product_id", "name translations")
          .populate("items.variant_id", "title translations")
          .sort({ [sortField]: sortOrder, _id: 1 })
          .skip((safePage - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        Order.countDocuments(countsQuery),
        Order.countDocuments({ ...countsQuery, status: "pending" }),
        Order.countDocuments({ ...countsQuery, status: "shipped" }),
        Order.countDocuments({ ...countsQuery, status: "delivered" }),
        Order.countDocuments({ ...countsQuery, status: "cancelled" }),
      ]);

    res.status(200).json({
      success: true,
      data: orders.map((order) => mapFrontOrder(order, locale)),
      counts: {
        total: totalOrders,
        pending: pendingOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
      },
      pagination: {
        total,
        page: safePage,
        limit: limitNum,
        pages,
        totalPages: pages, // backward-compatible key
        hasNext: safePage < pages,
        hasPrev: safePage > 1,
      }
    });
  } catch (error) {
    log.error("❌ [getAllOrders] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// GET /api/orders/admin/product-summary?productId=...
//    Selected product ka poora history — total orders, units, revenue,
//    first/latest order date aur status-wise breakdown.
//    ✅ Cancelled orders LIST me rehti hain, lekin units + revenue se
//       exclude hoti hain (cancelledUnits / cancelledRevenue alag se bhejte hain
//       taake UI par clear note dikh sake).
// ==========================================
const SUMMARY_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

const getProductSummary = async (req, res) => {
  try {
    const { productId } = req.query;

    const empty = (extra = {}) => ({
      productId: productId || "",
      totalOrders: 0,
      unitsSold: 0,
      revenue: 0,
      cancelledOrders: 0,
      cancelledUnits: 0,
      cancelledRevenue: 0,
      firstOrderDate: null,
      lastOrderDate: null,
      byStatus: SUMMARY_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {}),
      ...extra,
    });

    // ✅ Invalid / missing productId -> crash nahi, empty summary
    if (!isValidProductId(productId)) {
      return res.status(200).json({
        success: true,
        data: empty({ invalidProductId: Boolean(productId) }),
      });
    }

    const match = buildAdminOrderFilter(req.query);
    const oid = new mongoose.Types.ObjectId(String(productId));

    const [totals] = await Order.aggregate([
      { $match: match },
      // Sirf is product ki line items nikalo
      {
        $project: {
          created_at: 1,
          status: 1,
          matchedItems: {
            $filter: {
              input: "$items",
              as: "it",
              cond: { $eq: ["$$it.product_id", oid] },
            },
          },
        },
      },
      {
        $project: {
          created_at: 1,
          status: 1,
          matchedQty: { $sum: "$matchedItems.qty" },
          matchedRevenue: {
            $sum: {
              $map: {
                input: "$matchedItems",
                as: "it",
                in: { $multiply: ["$$it.price", "$$it.qty"] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          firstOrderDate: { $min: "$created_at" },
          lastOrderDate: { $max: "$created_at" },
          // ✅ Cancelled exclude
          unitsSold: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 0, "$matchedQty"] },
          },
          revenue: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 0, "$matchedRevenue"] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          cancelledUnits: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, "$matchedQty", 0] },
          },
          cancelledRevenue: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, "$matchedRevenue", 0] },
          },
        },
      },
    ]);

    const statusRows = await Order.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const byStatus = SUMMARY_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    statusRows.forEach((r) => {
      if (r._id && r._id in byStatus) byStatus[r._id] = r.count;
    });

    if (!totals) {
      return res.status(200).json({ success: true, data: empty() });
    }

    res.status(200).json({
      success: true,
      data: {
        productId: String(productId),
        totalOrders: totals.totalOrders || 0,
        unitsSold: totals.unitsSold || 0,
        revenue: Math.round(totals.revenue || 0),
        cancelledOrders: totals.cancelledOrders || 0,
        cancelledUnits: totals.cancelledUnits || 0,
        cancelledRevenue: Math.round(totals.cancelledRevenue || 0),
        firstOrderDate: totals.firstOrderDate || null,
        lastOrderDate: totals.lastOrderDate || null,
        byStatus,
      },
    });
  } catch (error) {
    log.error("❌ [getProductSummary] Error:", error);
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

    // ✅ FIX: Cancel hone par stock WAPAS restore (modal me yahi likha hai).
    //    Yahi logic deleteOrder() me pehle se tha — ab consistent hai.
    //    Double restore se bacha gaya hai: sirf tab jab pehle cancelled nahi tha.
    const previousStatus = order.status;
    const shouldRestoreStock = status === "cancelled" && previousStatus !== "cancelled";

      order.status = status;
    if (notes) order.notes = notes;
    if (status === "cancelled" && cancel_reason) order.cancel_reason = cancel_reason;

    // 🔒 Atomic claim: do concurrent "cancel" requests dono ne previousStatus
    // "pending" padha to dono stock wapas kar dete (double restore). Ab sirf wo
    // request restore karti hai jiska conditional update kamyab hua.
    let restoreClaimed = false;
    if (shouldRestoreStock) {
      const claim = await Order.updateOne({ _id: order._id, status: { $ne: "cancelled" } }, { $set: { status: "cancelled" } });
      restoreClaimed = claim.modifiedCount === 1;
    }

    await order.save();

    if (restoreClaimed) {
      const restoredVariants = [];
      for (const item of order.items || []) {
        if (!item.variant_id) continue;
        const restoreQty = (Number(item.qty) || 0) + (Number(item.free_items) || 0);
        await Variant.updateOne(
          { _id: item.variant_id },
          { $inc: { quantity: restoreQty } }
        );
        restoredVariants.push({ variant_id: item.variant_id, change: restoreQty });
      }
      // ✅ Live update — stock restore hote hi manage-stock page khud refresh
      if (restoredVariants.length > 0) {
        emitStockEvent({ variants: restoredVariants, source: "order_cancelled" });
      }
    }

    emitOrderEvent("order:updated", { success: true, data: order });
    emitOrderEvent("order:statusChanged", { success: true, data: order });
    res.status(200).json({ success: true, message: `Order status updated to ${status}`, data: order });
  } catch (error) {
    log.error("❌ [updateOrderStatus] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// PUT /api/orders/:id/edit — Edit Pending Order (Qty + Address)
// ✅ FIXED: Supports address_override for "order only" mode
// ==========================================
// Paid + free units. Stock isi farq se chalta hai (free paid qty ke UPAR hai).
const lineUnits = (item) => (Number(item.qty) || 0) + (Number(item.free_items) || 0);

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

    const $set = {};
    // delta > 0 matlab shelf se aur units chahiye
    const stockDeltas = [];

    // ✅ Update Quantities. Tax product.tax se snapshot (tax_rate) par. Pehle
    // item.tax padha jata tha jo schema me hai hi nahi, is liye tax 0 ho jata tha,
    // aur qty badalne par stock bilkul nahi hilta tha.
    if (Array.isArray(items) && items.length) {
      const missingProductIds = [];
      for (const item of order.items) {
        if (item.tax_rate == null && item.product_id) missingProductIds.push(item.product_id);
      }
      const rateByProduct = new Map();
      if (missingProductIds.length) {
        const products = await Product.find({ _id: { $in: missingProductIds } }).select("tax").lean();
        for (const product of products) rateByProduct.set(String(product._id), Number(product.tax) || 0);
      }

      const oldUnits = new Map();
      for (const item of order.items) {
        if (!item.variant_id) continue;
        const key = String(item.variant_id);
        oldUnits.set(key, (oldUnits.get(key) || 0) + lineUnits(item));
      }

      let subtotal = 0;
      let knownTax = 0;
      let unresolved = false;
      const nextItems = order.items.map((item) => {
        const plain = item.toObject();
        const updated = items.find((i) => String(i._id || i.id) === String(item._id));
        const newQty = updated ? Math.max(1, Math.floor(Number(updated.qty) || 1)) : item.qty;

        let freeItems = Number(item.free_items) || 0;
        if (item.deal_type === "buy_x_get_y" && item.deal_buy_quantity && item.deal_get_quantity) {
          freeItems = Math.floor(newQty / item.deal_buy_quantity) * item.deal_get_quantity;
          plain.deal_savings = freeItems * item.price;
        }

        plain.qty = newQty;
        plain.payable_items = newQty;
        plain.free_items = freeItems;

        let rate = item.tax_rate == null ? null : Number(item.tax_rate);
        if (rate == null && item.product_id && rateByProduct.has(String(item.product_id))) {
          rate = rateByProduct.get(String(item.product_id));
          plain.tax_rate = rate;
        }
        if (plain.tax_rate == null) delete plain.tax_rate;
        const lineTotal = item.price * newQty;
        subtotal += lineTotal;
        if (rate == null) unresolved = true;
        else knownTax += lineTotal * (rate / 100);
        return plain;
      });

      subtotal = Math.round(subtotal * 100) / 100;
      const tax = unresolved
        ? (order.subtotal > 0 ? Math.round(order.tax * (subtotal / order.subtotal)) : order.tax)
        : Math.round(knownTax);

      const newUnits = new Map();
      const names = new Map();
      for (const item of nextItems) {
        if (!item.variant_id) continue;
        const key = String(item.variant_id);
        newUnits.set(key, (newUnits.get(key) || 0) + lineUnits(item));
        if (!names.has(key)) names.set(key, item.name || "item");
      }
      for (const key of new Set([...oldUnits.keys(), ...newUnits.keys()])) {
        const delta = (newUnits.get(key) || 0) - (oldUnits.get(key) || 0);
        if (delta !== 0) stockDeltas.push({ variant_id: key, delta, name: names.get(key) || "item" });
      }

      $set.items = nextItems;
      $set.subtotal = subtotal;
      $set.tax = tax;
      $set.total = subtotal + order.shipping + tax;
      $set.total_deal_savings = nextItems.reduce((sum, item) => sum + (Number(item.deal_savings) || 0), 0);
    }

    // ✅ Update Address — address book untouched when the customer sends an override
    if (address_override && typeof address_override === "object") {
      $set.address_snapshot = {
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
      if (address_id) $set.address_id = address_id;
    } else if (address_id) {
      const address = await Address.findOne({ _id: address_id, user_id: req.user._id });
      if (!address) {
        return res.status(400).json({ success: false, message: "Address not found" });
      }
      $set.address_id = address._id;
      $set.address_snapshot = {
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

    if (!Object.keys($set).length) {
      return res.status(200).json({ success: true, message: "Order updated successfully", data: order });
    }

    // 🔒 Stock delta + order update ek transaction. Doosri request same updated_at
    // par fail (409) — warna dono qty barha kar stock do dafa kaat leti.
    const seenUpdatedAt = order.updated_at;
    const applied = [];
    let saved;
    try {
      ({ result: saved } = await withTx(async () => {
        applied.length = 0;
        for (const change of stockDeltas) {
          const inc = -change.delta;
          const result = change.delta > 0
            ? await Variant.updateOne(
              { _id: change.variant_id, quantity: { $gte: change.delta } },
              { $inc: { quantity: inc } },
            )
            : await Variant.updateOne({ _id: change.variant_id }, { $inc: { quantity: inc } });
          if (change.delta > 0 && !result.modifiedCount) {
            throw new TxAbort(400, { success: false, message: `Insufficient stock for "${change.name}". Please refresh and try again.` });
          }
          if (result.modifiedCount) applied.push({ variant_id: change.variant_id, change: inc });
        }
        const updated = await Order.findOneAndUpdate(
          { _id: order._id, user_id: req.user._id, status: "pending", updated_at: seenUpdatedAt },
          { $set },
          { returnDocument: "after", runValidators: true },
        );
        if (!updated) {
          throw new TxAbort(409, { success: false, code: "ORDER_CHANGED", message: "This order was changed at the same time. Refresh and try again." });
        }
        return updated;
      }));
    } catch (txError) {
      if (txError instanceof TxAbort) return res.status(txError.status).json(txError.body);
      throw txError;
    }

    if (applied.length) {
      emitStockEvent({ variants: applied.map((row) => ({ variant_id: row.variant_id, change: row.change })), source: "order_edited" });
    }
    emitOrderEvent("order:updated", { success: true, data: saved });
    res.status(200).json({ success: true, message: "Order updated successfully", data: saved });
  } catch (error) {
    log.error("❌ [editOrder] Error:", error);
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

    // 🔒 Pehle atomic delete (owner + pending shart ke sath), PHIR stock restore.
    // Pehle restore pehle hota tha → do concurrent delete requests dono stock
    // wapas kar deti thi. Ab sirf jis request ne asal me delete kiya wahi restore.
    const deletedOrder = await Order.findOneAndDelete({ _id: order._id, user_id: req.user._id, status: "pending" });
    if (!deletedOrder) {
      return res.status(409).json({ success: false, message: "Order was already changed or deleted" });
    }

    // ✅ Stock wapas restore = PAID + FREE (total jo ship hone wala tha)
    const restoredVariants = [];
    for (const item of deletedOrder.items) {
      if (item.variant_id) {
        await Variant.updateOne(
          { _id: item.variant_id },
          { $inc: { quantity: item.qty + (item.free_items || 0) } }
        );
        restoredVariants.push({ variant_id: item.variant_id, change: item.qty + (item.free_items || 0) });
      }
    }

    // ✅ Live update — stock restore hote hi manage-stock page apne aap refresh
    if (restoredVariants.length > 0) {
      emitStockEvent({ variants: restoredVariants, source: "order_deleted" });
    }

    emitOrderEvent("order:deleted", { success: true, data: { id: req.params.id } });
    emitOrderEvent("order:updated", { success: true, data: { id: req.params.id, deleted: true } });
    res.status(200).json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    log.error("❌ [deleteOrder] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// GET /api/orders/admin/:id — Admin single order
// getBanner/detail ka pattern: populate sirf display info ke liye, response me
// sirf front + audit fields, aur translations sirf selected locale ki.
// ==========================================
const getOrderByIdAdmin = async (req, res) => {
  try {
    const locale = parseOrderLocale(req.query.locale);
    const order = await Order.findById(req.params.id)
      .populate("user_id", "name email phone")
      .populate("items.product_id", "name translations")
      .populate("items.variant_id", "title translations")
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // ✅ mapFrontOrder sirf front-visible fields rakhta hai — checkout_draft_id,
    //    address_id, translation_source/status, __v response me nahi jate.
    res.status(200).json({ success: true, data: mapFrontOrder(order, locale) });
  } catch (error) {
    log.error("❌ [getOrderByIdAdmin] Error:", error);
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
    log.error("❌ [updatePaymentStatus] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  placeOrder,
  getMyOrdersSummary,
  getMyOrders,
  getOrderById,
  getAllOrders,
  getProductSummary,
  updateOrderStatus,
  editOrder,
  deleteOrder,
  getOrderByIdAdmin,
  updatePaymentStatus,
};
