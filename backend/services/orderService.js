// Order placement ka core (§4.2) — controller sirf HTTP wrapper hai.
// placeOrderCore `{ status, body }` lautata hai (res ko touch nahi karta) taake testable rahe.
// Business logic / error codes / response shapes pehle jaise hain.
const mongoose = require("mongoose");
const { roundMoney } = require("../utils/roundMoney");
const Order = require("../models/Order");
const CheckoutDraft = require("../models/CheckoutDraft");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Address = require("../models/Address");
const Discount = require("../models/Discount");
const Deal = require("../models/Deal");
const Bundle = require("../models/Bundle");
const log = require("../utils/logger");
const { nextSeq, ensureSeeded, formatNumber, maxNumericSuffix } = require("../utils/counter");
const { priceCheckout } = require("./pricing/checkout"); // server-side cart pricing
const { withTx, TxAbort } = require("../utils/tx"); // one transaction per checkout
const { upsertCustomerForUser } = require("../utils/linkUserCustomer");
const loyalty = require("../utils/loyaltyService");
const LoyaltyTransaction = require("../models/LoyaltyTransaction");
const stock = require("./stock");

const reply = (status, body) => ({ status, body });

const emitOrderEvent = (event, data) => {
  try {
    const io = require("../utils/socket").getIO();
    if (io) io.emit(event, data);
  } catch (e) {}
};

// ✅ Live stock sync — order par stock kam hone par manage-stock page socket se refresh ho jata hai
const emitStockEvent = (data) => {
  emitOrderEvent("stockUpdated", data);
};

/**
 * @param {{ body: object, user: object, store?: object, idempotencyHeader?: string }} ctx
 * @returns {Promise<{status:number, body:object}>}
 */
async function placeOrderCore({ body, user, store, idempotencyHeader }) {
  const {
    items,
    address_id,
    payment_method,
    notes,
    checkout_draft_id: rawCheckoutDraftId,
    shipping_method: reqShippingMethod,
    bank_sender_name,
    bank_transaction_ref,
    loyalty_points,
  } = body;
  const checkoutDraftId = mongoose.isValidObjectId(rawCheckoutDraftId)
    ? rawCheckoutDraftId
    : null;

  if (!items || !items.length) {
    return reply(400, { success: false, message: "Cart is empty" });
  }

  // 🔁 IDEMPOTENCY — ek checkout attempt = ek key (frontend Idempotency-Key header).
  // Double click / network retry same key ke sath aaye to naya order NAHI,
  // pehle wala order lautao (unique index {storeId, idempotency_key}).
  const rawIdemKey = String(idempotencyHeader || body?.idempotency_key || "").trim();
  const idempotencyKey = /^[A-Za-z0-9_-]{8,100}$/.test(rawIdemKey) ? rawIdemKey : undefined;
  if (idempotencyKey) {
    const existing = await Order.findOne({ user_id: user._id, idempotency_key: idempotencyKey }).lean();
    if (existing) return reply(200, { success: true, data: existing, replayed: true });
  }
  if (!["cod", "bank", "card"].includes(payment_method)) {
    return reply(400, { success: false, message: "Invalid payment method" });
  }

  // 🔒 PCI: raw PAN / CVV / expiry kabhi accept nahi (optimizeplan.md §2.2).
  // payment_method "card" ab sirf intent hai; charged provider token flow baad me.
  if (
    body?.card_number != null
    || body?.card_cvv != null
    || body?.card_expiry != null
    || body?.card_holder_name != null
  ) {
    return reply(400, {
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
      return reply(400, {
        success: false,
        message: "Sender name is required for bank transfer",
      });
    }
    if (!trimmedTransactionRef) {
      return reply(400, {
        success: false,
        message: "Transaction ID / Reference is required for bank transfer",
      });
    }
  }

  const address = await Address.findOne({ _id: address_id, user_id: user._id });
  if (!address) {
    return reply(400, { success: false, message: "Address not found" });
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
      return reply(400, {
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
      return reply(400, { success: false, message: "Variant not found" });
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
        return reply(400, {
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
        return reply(400, {
          success: false,
          message: `"${item.name}" has an invalid deal. Please remove it and try again.`,
        });
      }
      dealDoc = await Deal.findById(dealId).select(DEAL_PRICING_FIELDS).lean();
      if (!dealDoc || !dealDoc.isActive) {
        return reply(400, {
          success: false,
          message: `The deal for "${item.name}" is no longer available. Please update your cart.`,
        });
      }
      const minQty = Number(dealDoc.minQuantity) || 1;
      const buyQty = dealDoc.type === "buy_x_get_y" ? Number(dealDoc.buyQuantity) || 0 : 0;
      const threshold = Math.max(minQty, buyQty);
      if (qty < threshold) {
        const remaining = threshold - qty;
        return reply(400, {
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
    return reply(400, { success: false, code: first.code, message: messages[first.code] || "Your cart needs an update." });
  }
  const pricingMode = String(process.env.PRICING_MODE || "enforce").toLowerCase();
  if (mismatches.length) {
    log.warn({ mismatches: mismatches.slice(0, 20), mode: pricingMode }, "[placeOrder] client prices differ from server pricing");
    if (pricingMode !== "log") {
      return reply(409, {
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
  subtotal = roundMoney(subtotal);

  // ✅ Stock check TOTAL (paid + free) par — free items ab server se pata hain
  for (const [index, oi] of orderItems.entries()) {
    const lineVariant = pricingLines[index].variant;
    if (Number(lineVariant.quantity) < oi.qty + oi.free_items) {
      return reply(400, {
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
    const { calculateShipping } = require("../controllers/shippingController");
    const quote = await calculateShipping({
      // Shipping rules ke liye category / brand DB product se (client ke bheje ids nahi)
      items: shippingItems,
      method: shipping_method,
      subtotal,
    });
    shipping = quote.fee;
  }

  const tax = Math.round(taxTotal);

  // ✅ Loyalty points — order banne se PEHLE kaat lo (atomic). orderId pehle
  //    se bana lete hain taake order/tx fail ho to points wapas ho saken.
  const orderId = new mongoose.Types.ObjectId();
  let redemption = { points: 0, discount: 0 };
  if (Number(loyalty_points) > 0) {
    try {
      redemption = await loyalty.redeemForCheckout(user._id, {
        requested: loyalty_points,
        subtotal,
        orderId,
      });
    } catch (err) {
      return reply(err.status || 400, { success: false, message: err.message });
    }
  }

  const total = subtotal + shipping + tax - redemption.discount;

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

      // 1) Stock — services/stock.js (stock_levels + Variant dual-write)
      for (const oi of orderItems) {
        const need = oi.qty + (oi.free_items || 0);
        const result = await stock.adjust({
          variant_id: oi.variant_id,
          qty_delta: -need,
          kind: "sale",
          ref_type: "order",
          reason: "checkout",
          explanation: `Order line ${oi.name || ""}`,
        });
        if (!result.ok) {
          throw new TxAbort(400, { success: false, message: `Insufficient stock for "${oi.name}". Please refresh your cart.` });
        }
        stockTouchedOnOrder.push({ variant_id: oi.variant_id, change: -need });
      }

      // 2) Deal usage — global usageLimit (atomic conditional $inc) + perUserLimit
      for (const dId of uniqueDealIds) {
        const dealDoc = pricingLines.find((l) => l.dealDoc && String(l.dealDoc._id) === String(dId))?.dealDoc;
        const perUserLimit = Number(dealDoc?.perUserLimit) || 0;
        if (perUserLimit > 0) {
          const used = await Order.countDocuments({ user_id: user._id, deal_ids: dId, status: { $ne: "cancelled" } });
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

      // 3) Order number (atomic counter) + order (fixed _id so redeem source_key matches)
      const seq = await nextSeq("order", { seed: orderSeed });
      const [created] = await Order.create([{
        _id: orderId,
        shipping_method,
        order_number: formatNumber("ORD-", seq, 5),
        user_id: user._id,
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
        loyalty_points_redeemed: redemption.points,
        loyalty_discount: redemption.discount,
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
        { user_id: user._id },
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
    // Order/tx nahi bana → kaate hue points wapas
    if (redemption.points > 0) {
      await loyalty.rollbackRedemption(user._id, orderId);
    }
    if (txError instanceof TxAbort) return reply(txError.status, txError.body);
    // Do concurrent submits same Idempotency-Key ke sath → doosra unique index par
    // fail; pehle wala order hi lautao (double order nahi).
    if (txError?.code === 11000 && idempotencyKey && /idempotency_key/.test(String(txError.message || ""))) {
      const existing = await Order.findOne({ user_id: user._id, idempotency_key: idempotencyKey }).lean();
      if (existing) return reply(200, { success: true, data: existing, replayed: true });
    }
    throw txError;
  }

  // Redeem txn par order number likh do + earn points pending
  if (redemption.points > 0) {
    await LoyaltyTransaction.updateOne(
      { source_key: `redeem:${order._id}` },
      { $set: { order_number: order.order_number, note: `Order ${order.order_number}` } },
    ).catch(() => {});
  }
  await loyalty.addOrderEarn(order);

  // ✅ Commit ke BAAD hi events (rollback hua order kabhi broadcast na ho)
  if (store?._id && user) {
    await upsertCustomerForUser({
      storeId: store._id,
      user: user,
      addressSnapshot: address,
    }).catch((err) => log.warn("upsertCustomerForUser after order:", err?.message || err));
  }
  if (stockTouchedOnOrder.length > 0) {
    emitStockEvent({ variants: stockTouchedOnOrder, source: "order_placed" });
  }
  emitOrderEvent("order:created", { success: true, data: order });
  emitOrderEvent("order:updated", { success: true, data: order });
  const itemQty = (order.items || []).reduce((sum, line) => sum + Math.max(0, Number(line.qty) || 0), 0);
  setImmediate(() => {
    try {
      const { bumpStoreDaily } = require("./storeStats");
      bumpStoreDaily({ revenue: Number(order.total) || 0, orders: 1, items: itemQty });
    } catch (_) { /* fire-and-forget */ }
  });
  return reply(201, { success: true, data: order });
}

module.exports = { placeOrderCore, emitOrderEvent, emitStockEvent };
