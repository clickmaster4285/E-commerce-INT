const Variant = require("../models/Variant");
const StockHistory = require("../models/StockHistory");
const { getIO } = require("../utils/socket");
const {
  pushGlobalActivity,
} = require("../utils/activityHelper");

/* =========================================================
   SOCKET HELPER
========================================================= */

const emitSocketEvent = (event, data) => {
  try {
    const io = getIO();

    if (io) {
      io.emit(event, data);
    }
  } catch (error) {
    console.warn(
      `⚠️ Socket emit failed for ${event}:`,
      error.message
    );
  }
};

/* =========================================================
   GET STOCK OVERVIEW
   ✅ FIX: Sirf wo products show honge jin ka is_deleted = false
========================================================= */

const getStockOverview = async (req, res) => {
  try {
    const variants = await Variant.find({
      is_deleted: { $ne: true },
    })
      .populate({
        path: "product_id",
        select: "name is_deleted",
        // ✅ Deleted products ko exclude karo
        match: { is_deleted: { $ne: true } },
      })
      .select(
        "sku title quantity min_qnt max_qnt product_id"
      )
      .sort({ created_at: -1 })
      .lean();

    const items = variants
      // ✅ Deleted product wale variants yahan null hote hain,
      //    is liye ye filter unhe hata deta hai
      .filter((v) => v.product_id)
      .map((v) => ({
        _id: v._id,

        sku: v.sku || "",

        title: v.title || "",

        quantity: v.quantity ?? 0,

        min_qnt: v.min_qnt ?? 0,

        max_qnt: v.max_qnt ?? 0,

        product_id:
          v.product_id?._id || null,

        product_name:
          v.product_id?.name ||
          "Unknown Product",
      }));

    res.status(200).json(items);
  } catch (error) {
    console.error(
      "Get stock overview error:",
      error
    );

    res.status(500).json({
      message: error.message,
    });
  }
};

/* =========================================================
   ADJUST STOCK
   type: "add" | "remove" | "set"
========================================================= */

const adjustStock = async (req, res) => {
  try {
    const {
      variant_id,
      type,
      quantity,
      reason,
    } = req.body;

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!variant_id) {
      return res.status(400).json({
        message: "Variant is required",
      });
    }

    if (
      !["add", "remove", "set"].includes(
        type
      )
    ) {
      return res.status(400).json({
        message:
          "Adjustment type must be add, remove or set",
      });
    }

    if (
      !Number.isInteger(Number(quantity)) ||
      Number(quantity) < 0
    ) {
      return res.status(400).json({
        message:
          "Quantity must be a valid non-negative whole number",
      });
    }

    const qty = Number(quantity);

    if (type !== "set" && qty === 0) {
      return res.status(400).json({
        message:
          "Quantity must be greater than 0 for add or remove",
      });
    }

    const variant = await Variant.findOne({
      _id: variant_id,
      is_deleted: { $ne: true },
    }).populate({
      path: "product_id",
      select: "name is_deleted",
      // ✅ Deleted product ka stock adjust nahi ho sakta
      match: { is_deleted: { $ne: true } },
    });

    if (!variant || !variant.product_id) {
      return res.status(404).json({
        message: "Variant not found",
      });
    }

    const previousQuantity =
      variant.quantity ?? 0;

    let newQuantity = previousQuantity;

    if (type === "add") {
      newQuantity =
        previousQuantity + qty;
    } else if (type === "remove") {
      if (qty > previousQuantity) {
        return res.status(400).json({
          message: `Cannot remove ${qty} units. Only ${previousQuantity} in stock.`,
        });
      }

      newQuantity =
        previousQuantity - qty;
    } else {
      newQuantity = qty;
    }

    /* =====================================================
       UPDATE VARIANT QUANTITY
    ===================================================== */

    variant.quantity = newQuantity;

    variant.updatedby =
      req.user?._id || null;

    await variant.save();

    /* =====================================================
       SAVE HISTORY
    ===================================================== */

    const performerName =
      req.user?.name || "Admin";

    const performerId =
      req.user?._id || null;

    const history = await StockHistory.create(
      {
        variant_id: variant._id,

        product_id:
          variant.product_id?._id ||
          variant.product_id ||
          null,

        product_name:
          variant.product_id?.name || "",

        sku: variant.sku || "",

        variant_title: variant.title || "",

        previous_quantity:
          previousQuantity,

        new_quantity: newQuantity,

        change_quantity:
          newQuantity - previousQuantity,

        adjustment_type: type,

        reason: reason || "",

        performed_by: performerId,

        performed_by_name:
          performerName,
      }
    );

    /* =====================================================
       ACTIVITY LOG
    ===================================================== */

    const io = req.io || getIO();

    await pushGlobalActivity(
      io,
      {
        action: `${performerName} adjusted stock for "${variant.product_id?.name || "Unknown Product"} - ${variant.title}" (${type} ${qty})`,

        category: "Stock Management",

        performedBy: performerId,

        performedByName:
          performerName,

        details: {
          variantId: variant._id,

          sku: variant.sku,

          previousQuantity,

          newQuantity,

          adjustmentType: type,

          reason: reason || "",
        },
      },
      performerId
    );

    /* =====================================================
       SOCKET — realtime sync for all browsers
    ===================================================== */

    emitSocketEvent("stockAdjusted", history);

    emitSocketEvent("stockUpdated", {
      variantId: variant._id,

      productId:
        variant.product_id?._id ||
        variant.product_id ||
        null,

      quantity: newQuantity,
    });

    res.status(200).json({
      success: true,

      message:
        "Stock adjusted successfully",

      item: {
        _id: variant._id,

        sku: variant.sku,

        title: variant.title,

        quantity: variant.quantity,

        min_qnt: variant.min_qnt,

        max_qnt: variant.max_qnt,

        product_id:
          variant.product_id?._id || null,

        product_name:
          variant.product_id?.name || "",
      },

      history,
    });
  } catch (error) {
    console.error(
      "Adjust stock error:",
      error
    );

    res.status(400).json({
      success: false,

      message: error.message,
    });
  }
};

/* =========================================================
   GET STOCK HISTORY
========================================================= */

const getStockHistory = async (req, res) => {
  try {
    const filter = {};

    if (req.query.variant_id) {
      filter.variant_id =
        req.query.variant_id;
    }

    const limit = Math.min(
      parseInt(req.query.limit, 10) || 200,
      500
    );

    const history = await StockHistory.find(
      filter
    )
      .select("-__v")
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    res.status(200).json(history);
  } catch (error) {
    console.error(
      "Get stock history error:",
      error
    );

    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  getStockOverview,
  adjustStock,
  getStockHistory,
};