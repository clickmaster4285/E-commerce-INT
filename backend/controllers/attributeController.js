const Attribute = require("../models/Attribute");
const Category = require("../models/Category");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity } = require("../utils/activityHelper");

const emitSocket = (event, data) => {
  try {
    const io = getIO();
    if (io) io.emit(event, data);
  } catch (e) {}
};

const normalizeValues = (rawValues) => {
  if (!Array.isArray(rawValues)) return [];
  const seen = new Set();
  const out = [];
  for (const v of rawValues) {
    if (!v) continue;
    const label = String(v.label || v.value || "").trim();
    const value = String(v.value || v.label || "").trim();
    if (!value) continue;
    if (seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push({
      label: label || value,
      value,
      sort_order: Number.isFinite(Number(v.sort_order)) ? Number(v.sort_order) : out.length,
      is_active: v.is_active === false ? false : true,
    });
  }
  return out;
};

const VALID_DATA_TYPES = ["text", "number", "decimal", "multi_select", "boolean"];

const LEGACY_DATA_TYPE_MAP = {
  select: "multi_select",
  color: "multi_select",
  date: "text",
  datetime: "text",
  url: "text",
  measurement: "decimal",
};

const sanitizePayload = (body) => {
  const allowed = [
    "name", "code", "data_type", "unit", "description", "values", "category",
    "variant_allowed", "filterable", "searchable", "visible", "is_active",
  ];
  const out = {};
  for (const k of allowed) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  if (out.code) out.code = String(out.code).toLowerCase().trim();
  if (out.name) out.name = String(out.name).trim();
  if (out.data_type !== undefined) {
    const normalized = String(out.data_type).toLowerCase().trim();
    if (VALID_DATA_TYPES.includes(normalized)) {
      out.data_type = normalized;
    } else if (LEGACY_DATA_TYPE_MAP[normalized]) {
      out.data_type = LEGACY_DATA_TYPE_MAP[normalized];
    } else {
      out.data_type = "text";
    }
  }
  if (out.unit !== undefined) out.unit = String(out.unit || "").trim();
  if (out.description !== undefined) out.description = String(out.description || "").trim();
  if (out.values !== undefined) out.values = normalizeValues(out.values);
  if (out.variant_allowed !== undefined) out.variant_allowed = Boolean(out.variant_allowed);
  if (out.filterable !== undefined) out.filterable = Boolean(out.filterable);
  if (out.searchable !== undefined) out.searchable = Boolean(out.searchable);
  if (out.visible !== undefined) out.visible = out.visible !== false;
  if (out.is_active !== undefined) out.is_active = out.is_active !== false;
  return out;
};

const getAttributeById = async (req, res) => {
  try {
    const attribute = await Attribute.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    }).lean();
    if (!attribute) {
      return res.status(404).json({ success: false, message: "Attribute not found" });
    }
    res.status(200).json({ success: true, data: attribute });
  } catch (error) {
    console.error("Error in getAttributeById:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAttributes = async (req, res) => {
  try {
    const { search, category } = req.query;
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 0; // 0 = legacy mode
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const filter = { is_deleted: { $ne: true } };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    // ✅ Safely filter by category if provided
    if (category) {
      filter.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    // ---- LEGACY MODE (no limit) → exact old behavior ----
    if (!limit) {
      const attributes = await Attribute.find(filter).sort({ sort_order: 1, name: 1 }).lean();
      return res.status(200).json({ success: true, data: attributes });
    }

    // ---- PAGINATED MODE ----
    const total = await Attribute.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages || 1);
    const skip = (safePage - 1) * limit;

    const attributes = await Attribute.find(filter).sort({ sort_order: 1, name: 1 }).skip(skip).limit(limit).lean();
    return res.status(200).json({
      success: true,
      data: attributes,
      pagination: {
        total,
        page: safePage,
        limit,
        pages,
        hasNext: safePage < pages,
        hasPrev: safePage > 1,
      },
    });
  } catch (error) {
    console.error("Error in getAttributes:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createAttribute = async (req, res) => {
  try {
    const data = sanitizePayload(req.body || {});
    if (!data.name || !data.code) {
      return res.status(400).json({ success: false, message: "Name and Code are required" });
    }
    const attribute = await Attribute.create({ ...data, createdby: req.user?._id || null });
    emitSocket("attributeCreated", attribute.toObject());

    const io = req.io || getIO();
    await pushGlobalActivity(
      io,
      {
        action: `${req.user?.name || "Admin"} created attribute "${attribute.name}"`,
        category: "Category Management",
        performedBy: req.user?._id || null,
        performedByName: req.user?.name || "Admin",
        details: { attributeId: attribute._id, code: attribute.code },
      },
      req.user?._id || null
    );
    res.status(201).json({ success: true, data: attribute });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Attribute code already exists" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateAttribute = async (req, res) => {
  try {
    const data = sanitizePayload(req.body || {});
    const attribute = await Attribute.findOneAndUpdate(
      { _id: req.params.id, is_deleted: { $ne: true } },
      { ...data, updatedby: req.user?._id || null },
      { new: true }
    );
    if (!attribute) {
      return res.status(404).json({ success: false, message: "Attribute not found" });
    }
    emitSocket("attributeUpdated", attribute.toObject());
    res.status(200).json({ success: true, data: attribute });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAttributeCategories = async (req, res) => {
  try {
    const attribute = await Attribute.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    }).lean();

    if (!attribute) {
      return res.status(404).json({ success: false, message: "Attribute not found" });
    }

    const categories = await Category.find({
      is_deleted: false,
      "attributes.attribute_id": attribute._id,
    })
      .select("name category_code category_type attributes")
      .lean();

    const result = categories.map((cat) => {
      const attrConfig = (cat.attributes || []).find(
        (a) => String(a.attribute_id) === String(attribute._id)
      );
      return {
        _id: cat._id,
        name: cat.name,
        category_code: cat.category_code,
        category_type: cat.category_type,
        config: attrConfig
          ? {
              is_required: Boolean(attrConfig.is_required),
              is_visible: attrConfig.is_visible !== false,
              is_filterable: Boolean(attrConfig.is_filterable),
              is_searchable: Boolean(attrConfig.is_searchable),
              is_variant_option: Boolean(attrConfig.is_variant_option),
              sort_order: attrConfig.sort_order || 0,
              value: attrConfig.value !== undefined ? attrConfig.value : "",
            }
          : null,
      };
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error in getAttributeCategories:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateAttributeCategories = async (req, res) => {
  try {
    const attributeId = req.params.id;
    const { category_ids } = req.body;

    if (!Array.isArray(category_ids)) {
      return res.status(400).json({ success: false, message: "category_ids must be an array" });
    }

    const attribute = await Attribute.findOne({
      _id: attributeId,
      is_deleted: { $ne: true },
    }).lean();

    if (!attribute) {
      return res.status(404).json({ success: false, message: "Attribute not found" });
    }

    const validCategoryIds = category_ids.filter((id) =>
      require("mongoose").Types.ObjectId.isValid(id)
    );

    const allCategories = await Category.find({
      is_deleted: false,
    }).lean();

    for (const cat of allCategories) {
      const hasAttribute = (cat.attributes || []).some(
        (a) => String(a.attribute_id) === String(attributeId)
      );
      const shouldBeAssigned = validCategoryIds.includes(String(cat._id));

      if (!hasAttribute && shouldBeAssigned) {
        await Category.updateOne(
          { _id: cat._id },
          {
            $push: {
              attributes: {
                attribute_id: attributeId,
                is_required: false,
                is_visible: true,
                is_filterable: false,
                is_searchable: false,
                is_variant_option: false,
                sort_order: (cat.attributes || []).length,
                value: "",
              },
            },
          }
        );
      } else if (hasAttribute && !shouldBeAssigned) {
        await Category.updateOne(
          { _id: cat._id },
          {
            $pull: {
              attributes: { attribute_id: new (require("mongoose").Types.ObjectId)(attributeId) },
            },
          }
        );
      }
    }

    const updatedCategories = await Category.find({
      is_deleted: false,
      "attributes.attribute_id": attributeId,
    })
      .select("name category_code category_type")
      .lean();

    const io = req.io || getIO();
    try {
      if (io) io.emit("attributeUpdated", { _id: attributeId });
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: "Category assignments updated successfully",
      data: updatedCategories,
    });
  } catch (error) {
    console.error("Error in updateAttributeCategories:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAttributeById, getAttributes, createAttribute, updateAttribute, getAttributeCategories, updateAttributeCategories };