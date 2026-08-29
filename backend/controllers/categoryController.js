const mongoose = require("mongoose");
const Category = require("../models/Category");
const Attribute = require("../models/Attribute");
const { getNextCategoryCode } = require("../utils/categoryCodeHelper");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity, getChanges } = require("../utils/activityHelper");

// ❌ REMOVED: getTenantId helper function

const emitSocketEvent = (event, data) => {
  try {
    const io = getIO();
    if (io) io.emit(event, data);
  } catch (error) {
    console.warn(`Socket emit failed for ${event}:`, error.message);
  }
};

const normalizeObjectId = (value) => {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

// ✅ UPDATED: validateAttributePayload no longer checks tenant_id
const validateAttributePayload = async (attributes) => {
  if (!Array.isArray(attributes)) return [];

  const cleaned = [];
  const seen = new Set();

  for (let index = 0; index < attributes.length; index += 1) {
    const item = attributes[index];
    if (!item.attribute_id) throw new Error("attribute_id is required");

    const attributeId = String(item.attribute_id);
    if (!mongoose.Types.ObjectId.isValid(attributeId)) {
      throw new Error(`Invalid attribute ID: ${attributeId}`);
    }
    if (seen.has(attributeId)) {
      throw new Error(`Duplicate attribute assignment: ${attributeId}`);
    }
    seen.add(attributeId);

    // ✅ FIX: Removed tenant_id filter from attribute validation
    const attribute = await Attribute.findOne({
      _id: attributeId,
      is_deleted: false,
      is_active: true,
    }).lean();

    if (!attribute) {
      throw new Error("Invalid attribute or access denied");
    }

    cleaned.push({
      attribute_id: attribute._id,
      is_required: Boolean(item.is_required),
      is_visible: item.is_visible !== false,
      is_filterable: Boolean(item.is_filterable),
      is_searchable: Boolean(item.is_searchable),
      is_variant_option: Boolean(item.is_variant_option),
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : index,
      // ✅ FIX: Preserve user-supplied default value
      value: item.value !== undefined ? item.value : "",
    });
  }
  return cleaned;
};

// ✅ UPDATED: assertValidParent no longer checks tenant_id
const assertValidParent = async ({ categoryId, parentId }) => {
  if (!parentId) return;
  if (!mongoose.Types.ObjectId.isValid(parentId)) {
    throw new Error("Invalid parent category ID");
  }
  if (categoryId && String(categoryId) === String(parentId)) {
    throw new Error("A category cannot be its own parent");
  }

  // ✅ FIX: Removed tenant_id filter
  const parent = await Category.findOne({
    _id: parentId,
    is_deleted: false,
  }).lean();

  if (!parent) throw new Error("Parent category not found");
  if (!categoryId) return;

  const visited = new Set();
  let currentId = parent._id;

  while (currentId) {
    const currentKey = String(currentId);
    if (visited.has(currentKey)) throw new Error("Circular category hierarchy detected");
    visited.add(currentKey);
    if (currentKey === String(categoryId)) throw new Error("Circular category hierarchy detected");

    // ✅ FIX: Removed tenant_id filter
    const current = await Category.findOne({
      _id: currentId,
      is_deleted: false,
    }).select("parent_category_id").lean();

    currentId = current?.parent_category_id || null;
  }
};

// ✅ UPDATED: getCategoryAttributesList no longer checks tenant_id
const getCategoryAttributesList = async (categoryId) => {
  // ✅ FIX: Removed tenant_id filter
  const category = await Category.findOne({
    _id: categoryId,
    is_deleted: false,
  }).lean();

  if (!category) return [];

  const configs = (category.attributes || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const attributeIds = configs.map((c) => c.attribute_id);

  // ✅ FIX: Removed tenant_id filter
  const attributes = await Attribute.find({
    _id: { $in: attributeIds },
    is_deleted: false,
    is_active: true,
  }).lean();

  const attributeMap = new Map(attributes.map((item) => [String(item._id), item]));

  return configs
    .map((config) => {
      const attribute = attributeMap.get(String(config.attribute_id));
      if (!attribute) return null;
      return {
        ...attribute,
        category_config: {
          attribute_id: config.attribute_id,
          is_required: Boolean(config.is_required),
          is_visible: config.is_visible !== false,
          is_filterable: Boolean(config.is_filterable),
          is_searchable: Boolean(config.is_searchable),
          is_variant_option: Boolean(config.is_variant_option),
          sort_order: config.sort_order || 0,
          // ✅ FIX: Surface the category-level attribute value so product
          // forms can pre-fill the same value/details automatically.
          value: config.value !== undefined && config.value !== null ? config.value : "",
        },
      };
    })
    .filter(Boolean);
};

const getNextCode = async (req, res) => {
  try {
    const nextCode = await getNextCategoryCode();
    res.status(200).json({ success: true, nextCode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    // ❌ REMOVED: const tenantId = getTenantId(req);

    const {
      name,
      description = "",
      parent_category_id = null,
      image_url = "",
      sort_order = 0,
      category_type = "",
      attributes = [],
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    const categoryCode = req.body.category_code || (await getNextCategoryCode());

    // ✅ FIX: Pass null or skip tenantId in helper
    await assertValidParent({ parentId: parent_category_id }); 

    // ✅ FIX: Skip tenantId in validation
    const cleanedAttributes = await validateAttributePayload(attributes);

    // ✅ FIX: Check duplicate code globally
    const duplicate = await Category.findOne({
      category_code: categoryCode.toUpperCase(),
      is_deleted: false,
    });

    if (duplicate) {
      return res.status(409).json({ success: false, message: "Category code already exists" });
    }

    const category = await Category.create({
      // tenant_id: tenantId, //  REMOVED
      category_code: categoryCode,
      name: name.trim(),
      description: description.trim(),
      parent_category_id: normalizeObjectId(parent_category_id),
      category_type: String(category_type || "").trim(),
      image_url: image_url.trim(),
      sort_order,
      attributes: cleanedAttributes,
      createdby: req.user?._id || null,
      updatedby: req.user?._id || null,
    });

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    await pushGlobalActivity(io, {
      action: `${performerName} created category "${category.name}"`,
      category: "Category Management",
      performedBy: performerId,
      performedByName: performerName,
      details: {
        categoryCode: category.category_code,
        categoryName: category.name,
        parentCategoryId: category.parent_category_id,
      },
    }, performerId);

    emitSocketEvent("categoryCreated", category.toObject());

    return res.status(201).json({ success: true, message: "Category created successfully", data: category });
  } catch (error) {
    console.error("Create category error:", error);
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
};

const getCategories = async (req, res) => {
  try {
    // ❌ REMOVED: const tenantId = getTenantId(req);

    // ✅ FIX: Fetch all categories globally
    const categories = await Category.find({ is_deleted: false })
      .select("-__v")
      .populate("parent_category_id", "name category_code")
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .sort({ sort_order: 1, created_at: -1 })
      .lean();

    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const getCategoryById = async (req, res) => {
  try {
    // ❌ REMOVED: const tenantId = getTenantId(req);

    // ✅ FIX: Find by ID globally
    const category = await Category.findOne({
      _id: req.params.id,
      is_deleted: false,
    })
      .select("-__v")
      .populate("parent_category_id", "name category_code")
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .lean();

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    return res.status(200).json({ success: true, data: category });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    // ❌ REMOVED: const tenantId = getTenantId(req);

    // ✅ FIX: Find by ID globally
    const category = await Category.findOne({
      _id: req.params.id,
      is_deleted: false,
    });

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const oldData = category.toObject();

    const nextParentId = Object.prototype.hasOwnProperty.call(req.body, "parent_category_id")
      ? req.body.parent_category_id || null
      : category.parent_category_id;

    // ✅ FIX: Skip tenantId in parent validation
    await assertValidParent({ categoryId: category._id, parentId: nextParentId });

    if (req.body.name !== undefined) {
      if (!req.body.name.trim()) {
        return res.status(400).json({ success: false, message: "Category name is required" });
      }
      category.name = req.body.name.trim();
    }

    if (req.body.category_code !== undefined) {
      category.category_code = req.body.category_code.trim().toUpperCase();
    }

    if (req.body.description !== undefined) {
      category.description = req.body.description.trim();
    }

    // ✅ FIX: Persist category_type on update
    if (req.body.category_type !== undefined) {
      category.category_type = String(req.body.category_type || "").trim();
    }

    if (req.body.image_url !== undefined) {
      category.image_url = req.body.image_url.trim();
    }

    if (req.body.sort_order !== undefined) {
      category.sort_order = Number(req.body.sort_order) || 0;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "parent_category_id")) {
      category.parent_category_id = normalizeObjectId(nextParentId);
    }

    if (Array.isArray(req.body.attributes)) {
      // ✅ FIX: Skip tenantId in attribute validation
      category.attributes = await validateAttributePayload(req.body.attributes);
    }

    category.updatedby = req.user?._id || null;
    await category.save();

    const changes = getChanges(oldData, category.toObject(), [
      "name", "category_code", "description", "parent_category_id", "attributes",
    ]);

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    await pushGlobalActivity(io, {
      action: `${performerName} updated category "${category.name}"`,
      category: "Category Management",
      performedBy: performerId,
      performedByName: performerName,
      details: { changes, categoryId: category._id },
    }, performerId);

    emitSocketEvent("categoryUpdated", category.toObject());

    return res.status(200).json({ success: true, message: "Category updated successfully", data: category });
  } catch (error) {
    console.error("Update category error:", error);
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
};

const getCategoryAttributes = async (req, res) => {
  try {
    // ❌ REMOVED: const tenantId = getTenantId(req);
    
    // ✅ FIX: Get attributes globally
    const attributes = await getCategoryAttributesList(req.params.id);
    return res.status(200).json({ success: true, data: attributes });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
};

const assignCategoryAttributes = async (req, res) => {
  try {
    // ❌ REMOVED: const tenantId = getTenantId(req);

    // ✅ FIX: Find by ID globally
    const category = await Category.findOne({
      _id: req.params.id,
      is_deleted: false,
    });

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // ✅ FIX: Skip tenantId in validation
    const attributes = await validateAttributePayload(req.body.attributes || []);

    category.attributes = attributes;
    category.updatedby = req.user?._id || null;
    await category.save();

    const io = req.io || getIO();
    emitSocketEvent("categoryAttributesUpdated", {
      categoryId: String(category._id),
      attributes,
    });

    await pushGlobalActivity(io, {
      action: `Admin updated attributes for category "${category.name}"`,
      category: "Category Management",
      performedBy: req.user?._id || null,
      performedByName: req.user?.name || "Admin",
      details: { categoryId: category._id, attributeCount: attributes.length },
    }, req.user?._id || null);

    return res.status(200).json({ success: true, message: "Category attributes updated successfully", data: attributes });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    // ❌ REMOVED: const tenantId = getTenantId(req);

    // ✅ FIX: Find by ID globally
    const category = await Category.findOne({
      _id: req.params.id,
      is_deleted: false,
    });

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // ✅ FIX: Check children globally
    const childExists = await Category.exists({
      parent_category_id: category._id,
      is_deleted: false,
    });

    if (childExists) {
      return res.status(409).json({ success: false, message: "Move or delete child categories first" });
    }

    category.is_deleted = true;
    category.deleted_at = new Date();
    category.deletedby = req.user?._id || null;
    category.updatedby = req.user?._id || null;
    await category.save();

    emitSocketEvent("categoryDeleted", { id: String(category._id) });

    return res.status(200).json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getNextCode,
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryAttributes,
  assignCategoryAttributes,
};