const mongoose = require("mongoose");
const log = require("../utils/logger");
const { withoutProtected } = require("../utils/sanitizeBody"); // mass assignment guard
const Category = require("../models/Category");
const { computeAncestors, rebuildDescendantAncestors } = require("../utils/categoryAncestors");
const Attribute = require("../models/Attribute");
const User = require("../models/User");
const Employee = require("../models/Employee");
const { getNextCategoryCode, peekNextCategoryCode } = require("../utils/categoryCodeHelper");
const { getIO } = require("../utils/socket");
const { emitSocketEvent } = require("../utils/emitSocketEvent");
const { escapeRegex } = require("../utils/escapeRegex");
const { getChanges } = require("../utils/activityHelper");
const { queueTranslationSync } = require("../utils/translationService");
const { countProductsUsingCategory } = require("../services/referentialCleanup");
const { hydrate } = require("../utils/hydrate");
const { getTree: getCachedCategoryTree, invalidateTree: invalidateCategoryTree } = require("../utils/categoryTreeCache");

// Populated attribute ke saath `translations` zaroori — attribute ka `name`
// translate hota hai aur options ke labels `values[].label_translations` me
// hote hain. Inke bina frontend hamesha English fallback dikha raha hota.
const ATTRIBUTE_POPULATE_SELECT =
  "name code description data_type values variant_allowed is_active translations";

const getRequestedLocale = (value) => {
  const locale = String(value || "en").trim().toLowerCase();
  return /^[a-z]{2}$/.test(locale) ? locale : "en";
};

const localizedMap = (map, locale) => {
  if (locale === "en" || !map?.[locale]) return undefined;
  return { [locale]: map[locale] };
};

const trimAttributeForLocale = (attribute, locale) => {
  if (!attribute || typeof attribute !== "object") return attribute;
  const result = Object.fromEntries([
    "_id", "name", "code", "description", "data_type", "values", "variant_allowed",
    "is_active", "translations", "parent_attribute_id", "sort_order",
  ].filter((key) => attribute[key] !== undefined).map((key) => [key, attribute[key]]));
  if (result.translations) {
    result.translations = {
      ...(localizedMap(result.translations.name, locale) && { name: localizedMap(result.translations.name, locale) }),
      ...(localizedMap(result.translations.description, locale) && { description: localizedMap(result.translations.description, locale) }),
    };
  }
  if (Array.isArray(result.values)) {
    result.values = result.values.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const value = { ...entry };
      if (value.label_translations) {
        value.label_translations = localizedMap(value.label_translations, locale) || {};
      }
      return value;
    });
  }
  return result;
};

const trimCategoryForLocale = (category, locale) => {
  if (!category) return category;
  const result = Object.fromEntries([
    "_id", "name", "category_code", "description", "slug", "category_type", "is_active",
    "parent_category_id", "attributes", "created_at", "updated_at", "createdby", "updatedby",
    "translations",
  ].filter((key) => category[key] !== undefined).map((key) => [key, category[key]]));
  if (result.translations) {
    result.translations = {
      ...(localizedMap(result.translations.name, locale) && { name: localizedMap(result.translations.name, locale) }),
      ...(localizedMap(result.translations.description, locale) && { description: localizedMap(result.translations.description, locale) }),
    };
  }
  if (result.parent_category_id && typeof result.parent_category_id === "object") {
    result.parent_category_id = trimCategoryForLocale(result.parent_category_id, locale);
  }
  if (Array.isArray(result.attributes)) {
    result.attributes = result.attributes.map((config) => ({
      is_required: config.is_required,
      is_visible: config.is_visible,
      is_filterable: config.is_filterable,
      is_searchable: config.is_searchable,
      is_variant_option: config.is_variant_option,
      sort_order: config.sort_order,
      value: config.value,
      attribute_id: trimAttributeForLocale(config.attribute_id, locale),
    }));
  }
  return result;
};

// createdby/updatedby creator User ya Employee dono ho sakta hai.
// Model ref Employee hai, isliye populate fail hone par User se resolve karo.
const resolveCreatorInfo = async (rawId) => {
  if (!rawId) return null;
  try {
    const user = await User.findById(rawId).select("name email").lean();
    if (user) return user;
    const employee = await Employee.findById(rawId).select("name email").lean();
    if (employee) return employee;
    return null;
  } catch (_) {
    return null;
  }
};

const normalizeObjectId = (value) => {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const slugify = (str) =>
  String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const SEED_TYPE_TO_DATA_TYPE = {
  boolean: "boolean",
  "multi-select": "multi_select",
  multi_select: "multi_select",
};

const ensureSeedAttributeByCode = async ({ code, name: label, type, options }) => {
  if (!code) return null;
  const safeCode = slugify(code);
  const existing = await Attribute.findOne({ code: safeCode, is_deleted: { $ne: true } });
  if (existing) return existing;

  const values = Array.isArray(options)
    ? options.map((opt, idx) => ({
        label: String(opt),
        value: String(opt),
        sort_order: idx,
        is_active: true,
      }))
    : [];

  const dataType = SEED_TYPE_TO_DATA_TYPE[type] || "text";

  try {
    const created = await Attribute.create({
      name: label || safeCode,
      code: safeCode,
      data_type: dataType,
      values,
      variant_allowed: true,
      filterable: dataType === "multi_select",
      searchable: true,
      visible: true,
      is_active: true,
      is_deleted: false,
    });
    return created;
  } catch (error) {
    if (error.code === 11000) {
      return Attribute.findOne({ code: safeCode, is_deleted: { $ne: true } });
    }
    throw error;
  }
};

const resolveSeedAttribute = async (item) => {
  if (item.attribute_id && mongoose.Types.ObjectId.isValid(String(item.attribute_id))) {
    return Attribute.findOne({ _id: item.attribute_id, is_deleted: { $ne: true } }).lean();
  }
  if (item.seed_code) {
    const safeCode = slugify(item.seed_code);
    const attr = await Attribute.findOne({ code: safeCode, is_deleted: { $ne: true } }).lean();
    if (attr) return attr;

    const created = await ensureSeedAttributeByCode({
      code: safeCode,
      name: item.seed_name || safeCode,
      type: item.seed_type || "text",
      options: item.seed_options || [],
    });
    return created ? created.toObject() : null;
  }
  return null;
};

// ✅ UPDATED: validateAttributePayload no longer checks tenant_id
const validateAttributePayload = async (attributes) => {
  if (!Array.isArray(attributes)) return [];

  const cleaned = [];
  const seen = new Set();

  for (let index = 0; index < attributes.length; index += 1) {
    const item = attributes[index];

    const attribute = await resolveSeedAttribute(item);
    if (!attribute) {
      throw new Error("Invalid attribute or access denied");
    }

    const attributeId = String(attribute._id);
    if (seen.has(attributeId)) {
      throw new Error(`Duplicate attribute assignment: ${attributeId}`);
    }
    seen.add(attributeId);

    let normalizedValue = "";
    if (item.value !== undefined && item.value !== null && item.value !== "") {
      if (attribute.data_type === "multi_select") {
        const arr = Array.isArray(item.value) ? item.value : [item.value];
        const cleanedArr = arr
          .map((v) => String(v).trim())
          .filter((v) => v.length > 0);
        normalizedValue = Array.from(new Set(cleanedArr));
      } else {
        normalizedValue = Array.isArray(item.value)
          ? String(item.value[0] || "").trim()
          : String(item.value).trim();
      }
    }

    cleaned.push({
      attribute_id: attribute._id,
      is_required: Boolean(item.is_required),
      is_visible: item.is_visible !== false,
      is_filterable: Boolean(item.is_filterable),
      is_searchable: Boolean(item.is_searchable),
      is_variant_option: Boolean(item.is_variant_option),
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : index,
      // ✅ FIX: Preserve user-supplied default value (array for multi_select)
      value: normalizedValue,
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

  // ✅ NEW: Parent category restriction — jo category already child categories
  // rakhti hai wo kisi doosri category ke neeche assign nahi ho sakti.
  // (Sirf update par apply hota hai kyunke create ke waqt nayi category ke
  // children exist hi nahi karte.)
  const hasChildren = await Category.exists({
    parent_category_id: categoryId,
    is_deleted: false,
  });

  if (hasChildren) {
    throw new Error(
      "Cannot assign this category as a child because it is already a parent category."
    );
  }
};

// ✅ NEW: Naam-based root restriction — agar diya gaya Category Name kisi aisi
// existing category se match karta hai (case-insensitive) jiske apne child
// categories hain, to ye category root (Parent = None) honi chahiye. Kisi aur
// category ka child assign karna allowed nahi.
// (Hardcoded nahi — ye rule har existing category par apply hota hai.)
const assertNameForcesRootParent = async ({ name, parentId, categoryId = null }) => {
  // ✅ UPDATED: Parent None (ya missing) hone par bhi check hota hai — taake
  // frontend bypass karke bhi koi existing Parent Category ke naam par nayi
  // category create/update na ho sake.
  const trimmedName = String(name || "").trim();
  if (!trimmedName) return;

  const query = {
    name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" },
    is_deleted: false,
  };
  // Edit mein khud ko exclude karo (same name wali category = ye wali category)
  if (categoryId) query._id = { $ne: categoryId };

  const sameNameCategory = await Category.findOne(query).select("_id name").lean();
  if (!sameNameCategory) return;

  const hasChildren = await Category.exists({
    parent_category_id: sameNameCategory._id,
    is_deleted: false,
  });

  if (hasChildren) {
    // ✅ NEW: Final validation — Parent None par bhi existing Parent Category
    // (jiske child categories hain) ke naam se create/update reject.
    if (!parentId) {
      throw new Error(
        `${sameNameCategory.name} already has child categories and cannot be assigned under another category.`
      );
    }

    throw new Error(
      `Parent category must be None because a category named "${sameNameCategory.name}" already exists with subcategories.`
    );
  }
};

// ✅ UPDATED: getCategoryAttributesList no longer checks tenant_id
// ✅ UPDATED: Returns hierarchical structure (Main Attribute → Sub-Attribute → Values)
const getCategoryAttributesList = async (categoryId, paginationOptions = null) => {
  // ✅ FIX: Removed tenant_id filter
  const category = await Category.findOne({
    _id: categoryId,
    is_deleted: false,
  }).select("attributes").lean();

  if (!category) return [];

  const allConfigs = (category.attributes || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  let configs = allConfigs;
  let pagination = null;
  if (paginationOptions) {
    const limit = Math.min(100, Math.max(1, Number.parseInt(paginationOptions.limit, 10) || 10));
    const requestedPage = Math.max(1, Number.parseInt(paginationOptions.page, 10) || 1);
    const pages = Math.max(1, Math.ceil(allConfigs.length / limit));
    const page = Math.min(requestedPage, pages);
    configs = allConfigs.slice((page - 1) * limit, page * limit);
    pagination = {
      total: allConfigs.length,
      page,
      limit,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
      variantAttributes: allConfigs.filter((config) => config.is_variant_option).length,
    };
  }
  const attributeIds = configs.map((c) => c.attribute_id);

  // ✅ FIX: Removed tenant_id filter
  const attributes = await Attribute.find({
    _id: { $in: attributeIds },
    is_deleted: false,
  }).lean();

  const attributeMap = new Map(attributes.map((item) => [String(item._id), item]));

  const decorate = (config, attribute) => ({
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
  });

  // ✅ Return all assigned attributes (including sub-attributes) so the frontend
  // can use parent_attribute_id to render the proper Main → Sub → Values hierarchy.
  const result = configs
    .map((config) => {
      const attribute = attributeMap.get(String(config.attribute_id));
      if (!attribute) return null;
      return decorate(config, attribute);
    })
    .filter(Boolean);
  return pagination ? { data: result, pagination } : result;
};

// ✅ NEW: Returns hierarchical structure (Main → Sub-Attributes → Values) for a category
const getCategoryAttributesHierarchy = async (categoryId) => {
  const flat = await getCategoryAttributesList(categoryId);

  const byId = new Map();
  flat.forEach((attr) => byId.set(String(attr._id), { ...attr, sub_attributes: [] }));

  const mains = [];
  flat.forEach((attr) => {
    const node = byId.get(String(attr._id));
    const parentId = attr.parent_attribute_id ? String(attr.parent_attribute_id) : null;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId).sub_attributes.push(node);
    } else {
      mains.push(node);
    }
  });

  return mains;
};

const getNextCode = async (req, res) => {
  try {
    // Preview only — createCategory calls getNextCategoryCode() when assigning.
    const nextCode = await peekNextCategoryCode();
    res.status(200).json({ success: true, nextCode });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createCategory = async (req, res) => {
  try {

    const {
      name,
      description = "",
      parent_category_id = null,
      image_url = "",
      sort_order = 0,
      category_type = "",
      attributes = [],
      is_active = true,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    const categoryCode = req.body.category_code || (await getNextCategoryCode());

    // ✅ NEW: Naam match (children wali existing category) → parent None compulsory
    await assertNameForcesRootParent({ name, parentId: parent_category_id });

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
      category_code: categoryCode,
      name: name.trim(),
      description: description.trim(),
      parent_category_id: normalizeObjectId(parent_category_id),
      ancestors: await computeAncestors(Category, normalizeObjectId(parent_category_id)), // §4.4
      category_type: String(category_type || "").trim(),
      image_url: image_url.trim(),
      sort_order,
      is_active: Boolean(is_active),
      attributes: cleanedAttributes,
      createdby: req.user?._id || null,
      updatedby: null,
    });

    // 🌍 Urdu + Arabic translation background me generate (response block nahi hota)
    queueTranslationSync(Category, category._id);

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();



    emitSocketEvent("categoryCreated", category.toObject());
    invalidateCategoryTree(req.store?._id);

    return res.status(201).json({ success: true, message: "Category created successfully", data: category });
  } catch (error) {
    log.error("Create category error:", error);
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
};

const getCategories = async (req, res) => {
  try {

    const { legacyCap } = require("../utils/legacyListCap");
    const categories = await Category.find({ is_deleted: false })
      .select("-__v -createdby -updatedby")
      .populate("parent_category_id", "name category_code translations")
      .populate("attributes.attribute_id", ATTRIBUTE_POPULATE_SELECT)
      .sort({ sort_order: 1, created_at: -1 })
      .limit(legacyCap(req.query.limit, 200))
      .lean();

    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const locale = getRequestedLocale(req.query.locale);
    // ✅ FIX: Find by ID globally — populate attribute_id so frontend gets full attribute data
    let categoryQuery = Category.findOne({
      _id: req.params.id,
      is_deleted: false,
    })
      .select(req.query.includeAttributes === "true" ? "-__v" : "-__v -attributes")
      .populate("parent_category_id", "name category_code translations")
      .populate("createdby", "name email")
      .populate("updatedby", "name email");
    if (req.query.includeAttributes === "true") {
      categoryQuery = categoryQuery.populate("attributes.attribute_id", ATTRIBUTE_POPULATE_SELECT);
    }
    const category = await categoryQuery.lean();

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Creator Employee nahi balki User ho to populate null deta hai —
    // actual user name properly resolve karo (Employee -> User fallback).
    if (!category.createdby || !category.updatedby) {
      const raw = await Category.findById(req.params.id).select("createdby updatedby").lean();
      if (!category.createdby) {
        category.createdby = await resolveCreatorInfo(raw?.createdby);
      }
      if (!category.updatedby) {
        category.updatedby = await resolveCreatorInfo(raw?.updatedby);
      }
    }

    return res.status(200).json({ success: true, data: trimCategoryForLocale(category, locale) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ... (upar wala code same rahega, sirf updateCategory function ko replace karo)

const updateCategory = async (req, res) => {
  try {
    // Get existing category to compare actual changes
    const existingCategory = await Category.findOne({
      _id: req.params.id,
      is_deleted: false,
    });

    if (!existingCategory) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const updateData = withoutProtected(req.body);

    delete updateData._id;
    delete updateData.ancestors; // sirf server maintain karta hai (§4.4)
    delete updateData.created_at;
    delete updateData.createdby;
    delete updateData.updatedby;
    delete updateData.updated_at;
    delete updateData.__v;

    if (Object.prototype.hasOwnProperty.call(req.body, "is_active")) {
      updateData.is_active = Boolean(req.body.is_active);
    }

    // ✅ NEW: Parent category restriction — parent sirf tab validate hota hai jab
    // wo actually change ho raha ho, taa ke same value dobara bhejne par
    // existing valid relationship break na ho.
    const parentProvided = Object.prototype.hasOwnProperty.call(req.body, "parent_category_id");
    const nameProvided = Object.prototype.hasOwnProperty.call(req.body, "name") && req.body.name !== undefined;
    const effectiveName = nameProvided ? req.body.name : existingCategory.name;
    const nameChanged =
      String(effectiveName || "").trim() !== String(existingCategory.name || "").trim();

    let nextAncestors = null; // parent badalne par hi set hota hai (§4.4)
    if (parentProvided) {
      const nextParentId = req.body.parent_category_id || null;
      const currentParentId = existingCategory.parent_category_id
        ? String(existingCategory.parent_category_id)
        : "";

      const parentChanged = String(nextParentId || "") !== currentParentId;

      // ✅ UPDATED: Naam change ho ya parent change ho — dono par final
      // validation (Parent None par bhi), taa ke koi bhi invalid
      // create/update bypass na ho sake.
      if (parentChanged || nameChanged) {
        await assertNameForcesRootParent({
          name: effectiveName,
          parentId: nextParentId,
          categoryId: existingCategory._id,
        });
      }

      if (parentChanged) {
        await assertValidParent({
          categoryId: existingCategory._id,
          parentId: nextParentId,
        });
        nextAncestors = await computeAncestors(Category, normalizeObjectId(nextParentId));
      }

      updateData.parent_category_id = normalizeObjectId(nextParentId);
    } else if (nameChanged) {
      // ✅ UPDATED: Parent field na bheja ho tab bhi naam-change par same rule
      await assertNameForcesRootParent({
        name: effectiveName,
        parentId: existingCategory.parent_category_id || null,
        categoryId: existingCategory._id,
      });
    }

    // Check if there are any actual changes before setting updatedby
    // ✅ FIX: Robust change detection that properly handles boolean fields like is_active
    const fieldsToCompare = Object.keys(updateData);
    const hasActualChanges = fieldsToCompare.some((key) => {
      const newVal = updateData[key];
      const oldVal = existingCategory[key];
      
      // Handle array comparison for attributes
      if (Array.isArray(newVal) && Array.isArray(oldVal)) {
        return JSON.stringify(newVal) !== JSON.stringify(oldVal);
      }
      
      // ✅ FIX: Handle boolean fields explicitly - critical for is_active changes
      if (typeof newVal === "boolean" && typeof oldVal === "boolean") {
        return newVal !== oldVal;
      }
      
      // Handle null/undefined edge cases
      if (newVal === undefined && oldVal === undefined) return false;
      if (newVal === null && oldVal === null) return false;
      if (newVal === undefined && oldVal === null) return false;
      if (newVal === null && oldVal === undefined) return false;
      
      // If new value is explicitly provided in request body, compare properly
      if (key in req.body) {
        // For non-primitive values, use JSON stringify
        if (typeof newVal === "object" || typeof oldVal === "object") {
          return JSON.stringify(newVal) !== JSON.stringify(oldVal);
        }
        return String(newVal) !== String(oldVal);
      }
      return false;
    });

    if (!hasActualChanges) {
      // No actual changes, don't set updatedby, just return existing
      return res.status(200).json({
        success: true,
        message: "No changes to update",
        data: existingCategory,
      });
    }

    // Only set updatedby when there are actual changes
    updateData.updatedby = req.user?._id || null;
    if (nextAncestors) updateData.ancestors = nextAncestors;

    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { returnDocument: "after", runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Parent badla to descendants ki ancestors bhi dobara set karo
    if (nextAncestors) {
      await rebuildDescendantAncestors(Category, updatedCategory._id, nextAncestors);
    }

    // 🌍 English change → hash badla → translation dobara generate hogi
    queueTranslationSync(Category, updatedCategory._id);

    emitSocketEvent("categoryUpdated", updatedCategory.toObject());
    invalidateCategoryTree(req.store?._id);

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory
    });
  } catch (error) {
    log.error("Update error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ... (baaki functions same rahenge)
const getCategoryAttributes = async (req, res) => {
  try {
    
    // ✅ FIX: Get attributes globally
    const locale = getRequestedLocale(req.query.locale);
    const paginationRequested = req.query.page !== undefined || req.query.limit !== undefined;
    const result = await getCategoryAttributesList(
      req.params.id,
      paginationRequested ? { page: req.query.page, limit: req.query.limit } : null
    );
    const attributes = Array.isArray(result) ? result : result.data;
    return res.status(200).json({
      success: true,
      data: attributes.map((attribute) => trimAttributeForLocale(attribute, locale)),
      ...(Array.isArray(result) ? {} : { pagination: result.pagination }),
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
};

// ✅ NEW: Returns hierarchical structure (Main Attribute → Sub-Attributes → Values)
// Used by the Product Variant form to render the proper hierarchical dropdowns.
const getCategoryAttributesHierarchical = async (req, res) => {
  try {
    const locale = getRequestedLocale(req.query.locale);
    const attributes = await getCategoryAttributesHierarchy(req.params.id);
    const trimTree = (attribute) => ({
      ...trimAttributeForLocale(attribute, locale),
      sub_attributes: (attribute.sub_attributes || []).map(trimTree),
    });
    return res.status(200).json({ success: true, data: attributes.map(trimTree) });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
};

const assignCategoryAttributes = async (req, res) => {
  try {

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

    // Only set updatedby if attributes actually changed
    const newAttributesStr = JSON.stringify(attributes);
    const oldAttributesStr = JSON.stringify(category.attributes || []);
    const attributesChanged = newAttributesStr !== oldAttributesStr;

    category.attributes = attributes;
    if (attributesChanged) {
      category.updatedby = req.user?._id || null;
    }
    await category.save();

    const io = req.io || getIO();
    emitSocketEvent("categoryAttributesUpdated", {
      categoryId: String(category._id),
      attributes,
    });



    return res.status(200).json({ success: true, message: "Category attributes updated successfully", data: attributes });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {

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

    // ✅ Products abhi is category me hon to delete block (§3.7)
    const inUse = await countProductsUsingCategory(category._id);
    if (inUse > 0) {
      return res.status(409).json({
        success: false,
        message: `Category is used by ${inUse} product(s). Reassign them first.`,
      });
    }

    category.is_deleted = true;
    category.deleted_at = new Date();
    category.deletedby = req.user?._id || null;
    category.updatedby = req.user?._id || null;
    await category.save();

    emitSocketEvent("categoryDeleted", { id: String(category._id) });
    invalidateCategoryTree(req.store?._id);

    return res.status(200).json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
};

// ==========================================
// Routes se shift kiye hue handlers (§5.1) — routes file ab sirf path + middleware
// ==========================================

// ✅ PUBLIC — Bina login ke categories (User GUI ke liye)
const getPublicCategories = async (req, res) => {
  try {
    // ⚠️ `is_active` filter ZAROORI hai — deactivate hui category storefront se gayab honi chahiye
    // §4.4 Redis/memory tree cache (invalidate on create/update/delete)
    const categories = await getCachedCategoryTree(req.store?._id, "public", () =>
      Category.find({ is_deleted: false, is_active: true })
        .select("name description parent_category_id category_type sort_order created_at translations")
        .sort({ sort_order: 1, name: 1 })
        .lean(),
    );

    res.status(200).json({ success: true, data: categories, count: categories.length });
  } catch (error) {
    log.error("❌ Public categories fetch error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
};

const CATEGORY_SORT_FIELDS = {
  code: "category_code",
  name: "name",
  created: "created_at",
};

// ⚠️ `translations` zaroori hain: frontend `nameOf()` / `descriptionOf()` inhi se localized value padhte hain
const CATEGORY_LIST_SELECT =
  "name category_code description parent_category_id category_type is_active sort_order translations";

const selectedLocale = (value) => {
  const locale = String(value || "en").trim().toLowerCase();
  return /^[a-z]{2}$/.test(locale) ? locale : "en";
};

const categoryListItem = (category, locale) => {
  const translatedName = locale === "en" ? "" : category.translations?.name?.[locale];
  const translatedDescription = locale === "en" ? "" : category.translations?.description?.[locale];
  const parentDoc = category.parent_category_id && typeof category.parent_category_id === "object"
    ? category.parent_category_id
    : null;
  const parent = parentDoc ? {
    _id: parentDoc._id,
    name: parentDoc.name,
    category_code: parentDoc.category_code,
    ...(locale !== "en" && {
      translations: {
        name: parentDoc.translations?.name?.[locale]
          ? { [locale]: parentDoc.translations.name[locale] }
          : {},
      },
    }),
  } : category.parent_category_id;
  return {
    _id: category._id,
    name: category.name,
    category_code: category.category_code,
    description: category.description,
    ...(locale !== "en" && {
      translations: {
        name: translatedName ? { [locale]: translatedName } : {},
        description: translatedDescription ? { [locale]: translatedDescription } : {},
      },
    }),
    parent_category_id: parent,
    category_type: category.category_type,
    is_active: category.is_active,
    sort_order: category.sort_order,
  };
};

// Parent selector ke liye compact list — paginated response me repeat nahi hoti
const getCategoryOptions = async (req, res) => {
  try {
    const locale = selectedLocale(req.query.locale);
    const categories = await getCachedCategoryTree(req.store?._id, "options", () =>
      Category.find({ is_deleted: false })
        .select("name category_code parent_category_id translations")
        .sort({ sort_order: 1, name: 1 })
        .lean(),
    );
    const data = categories.map((category) => ({
      _id: category._id,
      name: category.name,
      category_code: category.category_code,
      parent_category_id: category.parent_category_id,
      ...(locale !== "en" && {
        translations: {
          name: category.translations?.name?.[locale]
            ? { [locale]: category.translations.name[locale] }
            : {},
        },
      }),
    }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    log.error("Error fetching category options:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch category options" });
  }
};

// Server-side pagination; bina page/limit ke purana FULL list (products page isi par depend karta hai)
const getAdminCategories = async (req, res) => {
  try {
    const wantsPagination =
      req.query.page !== undefined || req.query.limit !== undefined;

    /* ---------- LEGACY: full list (attributes ke sath) ---------- */
    if (!wantsPagination) {
      let categories = await Category.find({ is_deleted: false })
        .select(CATEGORY_LIST_SELECT)
        .populate("attributes.attribute_id", ATTRIBUTE_POPULATE_SELECT)
        .sort({ created_at: -1 })
        .lean();
      categories = await hydrate(categories, { field: "createdby", model: Employee, select: "name email" });
      categories = await hydrate(categories, { field: "updatedby", model: Employee, select: "name email" });

      return res.status(200).json({ success: true, data: categories, count: categories.length });
    }

    /* ---------- SERVER SIDE PAGINATION ---------- */
    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const locale = selectedLocale(req.query.locale);

    const search = String(req.query.search || "").trim();
    const parent = String(req.query.parent || "all").trim().toLowerCase();

    const filter = { is_deleted: false };

    // Search: category name ya category code
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: rx }, { category_code: rx }];
    }

    // Parent filter — root (koi parent nahi) / child (parent mojood)
    if (parent === "root") filter.parent_category_id = null;
    else if (parent === "child") filter.parent_category_id = { $ne: null };

    // Sorting bhi server par
    const sortKeyRaw = String(req.query.sort || "").trim();
    const hasSort = Boolean(CATEGORY_SORT_FIELDS[sortKeyRaw]);
    const sortField = hasSort ? CATEGORY_SORT_FIELDS[sortKeyRaw] : "created_at";
    const rawOrder = String(req.query.order || "").trim().toLowerCase();
    const sortOrder = hasSort
      ? (rawOrder === "desc" ? -1 : 1)
      : (rawOrder === "asc" ? 1 : -1);

    const activeFilter = { is_deleted: false };
    const total = await Category.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, pages);

    const [items, totalCategories, rootCategories, withAttributes] = await Promise.all([
      Category.find(filter)
        .select(CATEGORY_LIST_SELECT)
        .populate("parent_category_id", "name category_code translations")
        .sort({ [sortField]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Category.countDocuments(activeFilter),
      Category.countDocuments({ ...activeFilter, parent_category_id: null }),
      Category.countDocuments({ ...activeFilter, "attributes.0": { $exists: true } }),
    ]);
    const pageItems = items.map((item) => categoryListItem(item, locale));

    res.status(200).json({
      success: true,
      data: pageItems,
      counts: {
        total: totalCategories,
        root: rootCategories,
        child: Math.max(0, totalCategories - rootCategories),
        withAttributes,
      },
      pagination: {
        total,
        page,
        limit,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    log.error("Error fetching admin categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category tree",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
};

module.exports = {
  getPublicCategories,
  getCategoryOptions,
  getAdminCategories,
  getNextCode,
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryAttributes,
  getCategoryAttributesHierarchical,
  assignCategoryAttributes,
};
