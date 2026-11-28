const Variant = require("../models/Variant");
const Tag = require("../models/Tag");
const { getNextSku, peekNextSku } = require("../utils/skuHelper");
const { deleteImageFile } = require("../utils/uploadHelpers");
const { isSameValue, isSameList } = require("../utils/activityHelper");
const { refreshAsync: refreshProductSummary } = require("../services/productSummary");
const { adjustVariantQuantityToTarget } = require("../utils/variantQuantityAdjust");
const { emitSocketEvent } = require("../utils/emitSocketEvent");
const { escapeRegex } = require("../utils/escapeRegex");

// ⭐ TAG RESOLVER (Find or Create): ensures each tag name has a Tag document
// (with createdby tracked) so the Tags tab can show who created it.
const resolveTags = async (tagNames, userId) => {
  if (!Array.isArray(tagNames) || tagNames.length === 0) return [];

  const cleanNames = [...new Set(
    tagNames
      .map(n => String(n).trim().toLowerCase())
      .filter(Boolean)
  )];

  if (cleanNames.length === 0) return [];

  // Look up regardless of soft-delete; restore soft-deleted docs instead of
  // re-creating (avoids the unique `name` index E11000).
  const existingTags = await Tag.find({ name: { $in: cleanNames } }).lean();
  const existingMap = new Map(existingTags.map(t => [t.name, t]));
  const finalTagIds = [];

  for (const name of cleanNames) {
    const found = existingMap.get(name);
    if (found) {
      if (found.is_deleted) {
        await Tag.updateOne({ _id: found._id }, { $set: { is_deleted: false } });
      }
      finalTagIds.push(found._id);
    } else {
      const newTag = await Tag.create({ name, createdby: userId, updatedby: userId });
      finalTagIds.push(newTag._id);
    }
  }

  return finalTagIds;
};

/** body.tag_ids (array / JSON string) → valid ObjectId list; na aaye to null (legacy string-tags path) */
const parseTagIds = (raw) => {
  if (raw === undefined || raw === null || raw === "") return null;
  let list = raw;
  if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch { return null; }
  }
  if (!Array.isArray(list)) return null;
  return [...new Set(list.map(String).filter((id) => require("mongoose").isValidObjectId(id)))];
};

// CREATE VARIANT
const createVariant = async (req, res) => {
  try {
    let attributes = req.body.attributes || {};
    if (typeof attributes === "string") {
      attributes = JSON.parse(attributes);
    }

    // ✅ Parse tags agar string mein aaye hain
    let tags = [];
    if (req.body.tags) {
      tags = typeof req.body.tags === "string" ? JSON.parse(req.body.tags) : req.body.tags;
    }
    if (!Array.isArray(tags)) tags = [];

    // Ensure Tag docs exist so Created By is tracked for variant tags too
    // tag_ids (§3.7): Tag refs; body.tag_ids aaye to wahi (string tags nahi likhte), warna names se resolve
    let tagIds = [];
    const bodyTagIds = parseTagIds(req.body.tag_ids);
    if (bodyTagIds) {
      tagIds = bodyTagIds;
      tags = [];
    } else if (tags.length > 0) {
      tagIds = await resolveTags(tags, req.user?._id);
    }

    const variant = await Variant.create({
      product_id: req.body.product_id,
      sku: req.body.sku,
      title: req.body.title,
      description: req.body.description || "",
      cost_price: Number(req.body.cost_price || 0),
      selling_price: Number(req.body.selling_price || 0),
      expiry_after_delivery: Math.max(0, Number(req.body.expiry_after_delivery) || 0),
      expiry_after_delivery_unit: req.body.expiry_after_delivery_unit || "days",
      // ✅ Stock poore units mein — fractional value truncate ho jati hai
      quantity: Math.trunc(Number(req.body.quantity || 0)) || 0,
      min_qnt: Number(req.body.min_qnt || 0),
      max_qnt: Number(req.body.max_qnt || 0),
      topup: Number(req.body.topup) || 0,
      attributes,
      tags, // ✅ Tags saved here (legacy string tags — tag_ids aaye to khaali)
      tag_ids: tagIds,
      images: req.savedImages || [],
      createdby: req.user?._id || null,
      // A newly-created variant has no editor yet. Set this only on a real edit.
      updatedby: null,
    });

    emitSocketEvent("productUpdated", { _id: variant.product_id, variantUpdated: true });
    refreshProductSummary(variant.product_id);

    res.status(201).json({
      message: "Variant created successfully",
      variant,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

const getNextSkuNumber = async (req, res) => {
  try {
    // Preview only — create paths call getNextSku() when they actually need a number.
    const sku = await peekNextSku();
    res.status(200).json({ sku });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL VARIANTS
const getVariants = async (req, res) => {
  try {
    const { legacyCap } = require("../utils/legacyListCap");
    const variants = await Variant.find({ is_deleted: { $ne: true } })
      .select("-__v -cost_price")
      .populate("product_id", "name translations.name")
      .sort({ created_at: -1 })
      .limit(legacyCap(req.query.limit, 50))
      .lean();

    res.status(200).json(variants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /variants/picker — quote/invoice/PO dropdowns (§9.3)
const getVariantPicker = async (req, res) => {
  try {
    const { legacyCap } = require("../utils/legacyListCap");
    const search = String(req.query.search || "").trim();
    const limit = legacyCap(req.query.limit, 20);
    const filter = { is_deleted: { $ne: true }, status: { $ne: "inactive" } };
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ sku: rx }, { title: rx }];
    }
    const variants = await Variant.find(filter)
      .select("_id sku title selling_price quantity images product_id")
      .populate("product_id", "_id name")
      .sort({ updated_at: -1, _id: -1 })
      .limit(limit)
      .lean();
    const data = variants.map((v) => ({
      _id: v._id,
      sku: v.sku || "",
      title: v.title || "",
      selling_price: Number(v.selling_price) || 0,
      quantity: Number(v.quantity) || 0,
      image: v.images?.[0]?.img_url || "",
      product: v.product_id
        ? { _id: v.product_id._id || v.product_id, name: v.product_id.name || "" }
        : null,
    }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET VARIANT BY ID
const getVariantById = async (req, res) => {
  try {
    const variant = await Variant.findById(req.params.id)
      .select("-__v")
      .populate("product_id", "name");

    if (!variant) {
      return res.status(404).json({ message: "Variant not found" });
    }

    res.status(200).json(variant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE VARIANT
const updateVariant = async (req, res) => {
  try {
    const variant = await Variant.findById(req.params.id);

    if (!variant) {
      return res.status(404).json({ message: "Variant not found" });
    }

    if (req.body.sku !== undefined) variant.sku = req.body.sku;
    if (req.body.title !== undefined) variant.title = req.body.title;
    if (req.body.description !== undefined) variant.description = req.body.description;
    if (req.body.cost_price !== undefined) variant.cost_price = Number(req.body.cost_price);
    if (req.body.expiry_after_delivery !== undefined) {
      variant.expiry_after_delivery = Math.max(0, Number(req.body.expiry_after_delivery) || 0);
    }
    if (req.body.expiry_after_delivery_unit !== undefined) {
      variant.expiry_after_delivery_unit = req.body.expiry_after_delivery_unit;
    }
    let stockChanged = false;
    let productIdForSummary = variant.product_id?._id || variant.product_id || null;
    if (req.body.selling_price !== undefined) variant.selling_price = Number(req.body.selling_price);
    // ✅ Stock — direct overwrite nahi; $inc + StockHistory (§4.1)
    if (req.body.quantity !== undefined) {
      const rawQuantity = Number(req.body.quantity);
      if (!Number.isFinite(rawQuantity) || !Number.isInteger(rawQuantity) || rawQuantity < 0) {
        return res.status(400).json({
          message: "Quantity must be a valid non-negative whole number",
        });
      }
      const performerName = req.user?.name || "Admin";
      const performerId = req.user?._id || null;
      const qtyResult = await adjustVariantQuantityToTarget({
        variant,
        newQty: rawQuantity,
        performerId,
        performerName,
        reason: "variant_update",
        explanation: `Stock set to ${rawQuantity} via variant edit`,
      });
      if (!qtyResult.ok) {
        return res.status(qtyResult.status || 400).json({ message: qtyResult.message });
      }
      stockChanged = qtyResult.changed;
      productIdForSummary = qtyResult.productId || productIdForSummary;
      // quantity DB me $inc se ho chuki — save() se dobara overwrite na ho
      variant.unmarkModified("quantity");
    }
    if (req.body.min_qnt !== undefined) variant.min_qnt = Number(req.body.min_qnt);
    if (req.body.max_qnt !== undefined) variant.max_qnt = Number(req.body.max_qnt);
    if (req.body.topup !== undefined) variant.topup = Number(req.body.topup);

    if (req.body.attributes !== undefined) {
      const nextAttributes = typeof req.body.attributes === "string"
        ? JSON.parse(req.body.attributes)
        : req.body.attributes;
      // ✅ FIX: same attributes dobara assign karne se variant "modified" ho jata
      // tha -> ghalat "Variant Updated" audit event
      if (!isSameValue(variant.attributes ?? {}, nextAttributes)) {
        variant.attributes = nextAttributes;
      }
    }

    if (req.body.status !== undefined) {
      variant.status = req.body.status === "inactive" ? "inactive" : "active";
    }

    // ✅ Update tags agar request mein aaye hain
    const updateTagIds = parseTagIds(req.body.tag_ids);
    if (updateTagIds) {
      // tag_ids diye gaye → refs update, string tags ko haath nahi lagate
      variant.tag_ids = updateTagIds;
    } else if (req.body.tags !== undefined) {
      const parsedTags = typeof req.body.tags === "string"
        ? JSON.parse(req.body.tags)
        : req.body.tags;
      const variantTagList = Array.isArray(parsedTags) ? parsedTags : [];
      // Ensure Tag docs exist so Created By is tracked for variant tags too
      const resolvedIds = variantTagList.length > 0 ? await resolveTags(variantTagList, req.user?._id) : [];
      // ✅ FIX: tags waqai badle hon to hi assign karo
      if (!isSameList(variant.tags, variantTagList)) {
        variant.tags = variantTagList;
        variant.tag_ids = resolvedIds; // string tags ke saath refs bhi sync
      }
    }

    // Agar new images upload hui hain
    // ⚠️ Purani files DB save ke BAAD delete hongi (§5.6 delete-after-write) —
    // save fail ho to purani images disk par bachi rehti hain.
    let oldImageUrls = [];
    if (req.savedImages?.length) {
      oldImageUrls = variant.images.map((image) => image.img_url);
      variant.images = req.savedImages;
    }

    // ✅ FIX: Variant ke audit fields (updated_at / updatedby) sirf tab update karo
    // jab kuch waqai badla ho — warna bina change save karne par bhi Activity
    // timeline mein ghalat "Variant Updated" event ban jata tha.
    if (variant.isModified()) {
      variant.updatedby = req.user?._id || null;
      await variant.save();

      // ✅ Save kamyab — ab purani image files hatao (best-effort)
      for (const url of oldImageUrls) {
        try { await deleteImageFile(url); } catch (_) { /* orphan reh jana behtar */ }
      }

      if (req.savedImages?.length) {
        emitSocketEvent("productUpdated", {
          _id: variant.product_id,
          variantUpdated: true,
        });
      }
    }

    if (stockChanged) {
      emitSocketEvent("stockUpdated", {
        variant_id: variant._id,
        product_id: productIdForSummary,
        quantity: variant.quantity ?? 0,
        source: "variant_update",
      });
      refreshProductSummary(productIdForSummary);
    }

    res.status(200).json({
      message: "Variant updated successfully",
      variant,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

// DELETE VARIANT
const deleteVariant = async (req, res) => {
  try {
    const variant = await Variant.findById(req.params.id);

    if (!variant) {
      return res.status(404).json({ message: "Variant not found" });
    }

    const productId = variant.product_id;

    // Physical images delete
    for (const image of variant.images) {
      await deleteImageFile(image.img_url);
    }

    await Variant.findByIdAndDelete(req.params.id);

    emitSocketEvent("productUpdated", { _id: productId, variantUpdated: true });
    refreshProductSummary(productId);

    res.status(200).json({ message: "Variant deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// Routes se shift kiye hue middleware (§5.1) — image upload se pehle product id chahiye
// ==========================================

// CREATE: product id body se
const setCreateProductId = (req, res, next) => {
  req.productId = req.body.product_id;
  next();
};

// UPDATE: product id existing variant se
const setUpdateProductId = async (req, res, next) => {
  try {
    const variant = await Variant.findById(req.params.id);

    if (!variant) {
      return res.status(404).json({ message: "Variant not found" });
    }

    req.productId = variant.product_id;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  setCreateProductId,
  setUpdateProductId,
  createVariant,
  getVariants,
  getVariantPicker,
  getVariantById,
  updateVariant,
  deleteVariant,
  getNextSkuNumber,
};
