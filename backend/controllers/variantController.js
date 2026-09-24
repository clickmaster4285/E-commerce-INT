const Variant = require("../models/Variant");
const Tag = require("../models/Tag");
const { getNextSku } = require("../utils/skuHelper");
const { deleteImageFile } = require("../utils/uploadHelpers");

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
    if (tags.length > 0) {
      await resolveTags(tags, req.user?._id);
    }

    const variant = await Variant.create({
      product_id: req.body.product_id,
      sku: req.body.sku,
      title: req.body.title,
      description: req.body.description || "",
      cost_price: Number(req.body.cost_price || 0),
      selling_price: Number(req.body.selling_price || 0),
      quantity: Number(req.body.quantity || 0),
      min_qnt: Number(req.body.min_qnt || 0),
      max_qnt: Number(req.body.max_qnt || 0),
      attributes,
      tags, // ✅ Tags saved here
      images: req.savedImages || [],
      createdby: req.user?._id || null,
      updatedby: req.user?._id || null,
    });

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
    const sku = await getNextSku();
    res.status(200).json({ sku });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL VARIANTS
const getVariants = async (req, res) => {
  try {
    const variants = await Variant.find()
      .select("-__v")
      .populate("product_id", "name")
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    res.status(200).json(variants);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    if (req.body.selling_price !== undefined) variant.selling_price = Number(req.body.selling_price);
    if (req.body.quantity !== undefined) variant.quantity = Number(req.body.quantity);
    if (req.body.min_qnt !== undefined) variant.min_qnt = Number(req.body.min_qnt);
    if (req.body.max_qnt !== undefined) variant.max_qnt = Number(req.body.max_qnt);

    if (req.body.attributes !== undefined) {
      variant.attributes = typeof req.body.attributes === "string"
        ? JSON.parse(req.body.attributes)
        : req.body.attributes;
    }

    if (req.body.status !== undefined) {
      variant.status = req.body.status === "inactive" ? "inactive" : "active";
    }

    // ✅ Update tags agar request mein aaye hain
    if (req.body.tags !== undefined) {
      const parsedTags = typeof req.body.tags === "string"
        ? JSON.parse(req.body.tags)
        : req.body.tags;
      const variantTagList = Array.isArray(parsedTags) ? parsedTags : [];
      // Ensure Tag docs exist so Created By is tracked for variant tags too
      if (variantTagList.length > 0) {
        await resolveTags(variantTagList, req.user?._id);
      }
      variant.tags = variantTagList;
    }

    // Agar new images upload hui hain
    if (req.savedImages?.length) {
      for (const image of variant.images) {
        await deleteImageFile(image.img_url);
      }
      variant.images = req.savedImages;
    }

    variant.updatedby = req.user?._id || null;
    await variant.save();

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

    // Physical images delete
    for (const image of variant.images) {
      await deleteImageFile(image.img_url);
    }

    await Variant.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Variant deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createVariant,
  getVariants,
  getVariantById,
  updateVariant,
  deleteVariant,
  getNextSkuNumber,
};