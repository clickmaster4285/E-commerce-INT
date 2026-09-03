// backend/controllers/attributeController.js
const Attribute = require("../models/Attribute");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity } = require("../utils/activityHelper");

// ❌ REMOVED: const getTenantId = (req) => req.user?.tenant_id || req.user?.storeId;

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

const VALID_DATA_TYPES = ["text", "number", "decimal", "multi_select"];

// Legacy data types that previously existed in the system. Treat them as
// multi_select so the existing records continue to work as dropdowns after
// the data_type list was restricted.
const LEGACY_DATA_TYPE_MAP = {
  select: "multi_select",
  color: "multi_select",
  boolean: "text",
  date: "text",
  datetime: "text",
  url: "text",
  measurement: "decimal",
};

const sanitizePayload = (body) => {
  const allowed = [
    "name", "code", "data_type", "unit", "description", "values",
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

const getAttributes = async (req, res) => {
  try {
    // const tenantId = getTenantId(req); // ❌ Removed
    const { search } = req.query;

    // ✅ FIX: Removed tenant_id from filter
    const filter = { is_deleted: { $ne: true } };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    const attributes = await Attribute.find(filter).sort({ name: 1 }).lean();
    res.status(200).json({ success: true, data: attributes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createAttribute = async (req, res) => {
  try {
    // const tenantId = getTenantId(req); // ❌ Removed
    const data = sanitizePayload(req.body || {});

    if (!data.name || !data.code) {
      return res.status(400).json({ success: false, message: "Name and Code are required" });
    }

    const attribute = await Attribute.create({
      ...data,
      // tenant_id: tenantId, // ❌ Removed
      createdby: req.user?._id || null,
    });

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
    // const tenantId = getTenantId(req); // ❌ Removed
    const data = sanitizePayload(req.body || {});

    // ✅ FIX: Removed tenant_id from findOneAndUpdate filter
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

module.exports = { getAttributes, createAttribute, updateAttribute };