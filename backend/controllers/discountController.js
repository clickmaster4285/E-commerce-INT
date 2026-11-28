const Discount = require("../models/Discount");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const { emitSocketEvent } = require("../utils/emitSocketEvent");
const { escapeRegex } = require("../utils/escapeRegex");
const log = require("../utils/logger");
const { queueTranslationSync } = require("../utils/translationService");

// createdBy/updatedBy creator User ya Employee dono ho sakta hai.
// Model ref sirf User hai, isliye populate fail hone par Employee se resolve karo.
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

// =====================================================
// HELPER
// =====================================================

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean);
};

// ✅ TARGET NORMALIZATION — discount sirf usi type ke targets rakhta hai jis par wo apply hota hai.
//    Pehle stale ids bachte thay: e.g. "Specific Brands" → "Specific Products" switch karne par
//    purane brands DB me rehte the aur detail page par "Selected Brands" dikhte the, jabki wo
//    discount un par apply hi nahi karta. Ab non-matching arrays hamesha clear hoti hain.
//    Partial updates (jaise sirf status toggle) me matching array bachi rahti hai.
const resolveTargetArrays = (applyTo, incoming = {}, existing = {}) => {
  const pick = (incomingKey, existingKey) =>
    incoming[incomingKey] !== undefined
      ? normalizeArray(incoming[incomingKey])
      : normalizeArray(existing[existingKey]);

  return {
    selectedProducts: applyTo === "specific_products" ? pick("selected_product_ids", "selectedProducts") : [],
    selectedCategories: applyTo === "specific_categories" ? pick("selected_category_ids", "selectedCategories") : [],
    selectedBrands: applyTo === "specific_brands" ? pick("selected_brand_ids", "selectedBrands") : [],
    selectedTags: applyTo === "specific_tags" ? pick("selected_tag_ids", "selectedTags") : [],
    selectedSizes: applyTo === "specific_sizes" ? pick("selected_size_ids", "selectedSizes") : [],
  };
};

// ✅ Numeric fields 0 se kam kabhi nahi — pehla invalid field ka label return karta hai
const findNegativeField = (entries) => {
  for (const [label, raw] of entries) {
    if (raw === undefined || raw === null || raw === "") continue;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return label;
  }
  return "";
};

const getApplyTo = (targetType) => {
  switch (targetType) {
    case "all_products":
    case "all":
      return "all";
    case "product":
    case "specific_product":
    case "specific_products":
      return "specific_products";
    case "category":
    case "specific_category":
    case "specific_categories":
      return "specific_categories";
    case "brand":
    case "specific_brand":
    case "specific_brands":
      return "specific_brands";
    case "tag":
    case "specific_tag":
    case "specific_tags":
      return "specific_tags";
    case "size":
    case "specific_size":
    case "specific_sizes":
      return "specific_sizes";
    case "price_range":
      return "price_range";
    default:
      return "all";
  }
};

const getDiscountType = (valueType) => {
  switch (valueType) {
    case "fixed_amount":
    case "fixed":
      return "fixed";
    case "fixed_price":
      return "fixed_price";
    case "percentage":
    default:
      return "percentage";
  }
};

// =====================================================
// CREATE DISCOUNT
// =====================================================

exports.createDiscount = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      target_type,
      value_type,
      value,
      max_discount,
      selected_product_ids,
      selected_category_ids,
      selected_brand_ids,
      selected_tag_ids,
      selected_size_ids,
      price_min,
      price_max,
      min_order_amount,
      min_quantity,
      start_at,
      end_at,
      usage_limit,
      usage_per_customer,
      priority,
      is_stackable,
      status,
    } = req.body;

    // ===================================================
    // VALIDATION
    // ===================================================

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Discount name is required" });
    }

    if (value === undefined || value === null || value === "") {
      return res.status(400).json({ message: "Discount value is required" });
    }

    // ✅ Negative discount value allowed nahi — value kabhi 0 se kam nahi ho sakti
    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
      return res.status(400).json({
        message: "Discount value cannot be less than 0",
      });
    }

    // ✅ FIXED: Percentage validation updated to allow up to 100%
    if (value_type === "percentage" && Number(value) > 100) {
      return res.status(400).json({
        message: "Percentage discount must be between 0 and 100",
      });
    }

    // ✅ Limits / amounts bhi 0 se kam nahi ho sakte
    const negativeField = findNegativeField([
      ["Minimum order amount", min_order_amount],
      ["Minimum quantity", min_quantity],
      ["Usage limit", usage_limit],
      ["Per customer limit", usage_per_customer],
      ["Max discount", max_discount],
    ]);

    if (negativeField) {
      return res.status(400).json({
        message: `${negativeField} cannot be less than 0`,
      });
    }

    // ===================================================
    // TARGET
    // ===================================================
    const applyTo = getApplyTo(target_type);

    // ===================================================
    // TARGET VALIDATION
    // ===================================================
    if (applyTo === "specific_products" && normalizeArray(selected_product_ids).length === 0) {
      return res.status(400).json({ message: "Please select at least one product" });
    }
    if (applyTo === "specific_categories" && normalizeArray(selected_category_ids).length === 0) {
      return res.status(400).json({ message: "Please select at least one category" });
    }
    if (applyTo === "specific_brands" && normalizeArray(selected_brand_ids).length === 0) {
      return res.status(400).json({ message: "Please select at least one brand" });
    }
    if (applyTo === "specific_tags" && normalizeArray(selected_tag_ids).length === 0) {
      return res.status(400).json({ message: "Please select at least one tag" });
    }
    if (applyTo === "specific_sizes" && normalizeArray(selected_size_ids).length === 0) {
      return res.status(400).json({ message: "Please select at least one size" });
    }

    // ===================================================
    // PRICE RANGE VALIDATION
    // ===================================================
    if (applyTo === "price_range") {
      if (price_min === undefined || price_min === "" || price_max === undefined || price_max === "") {
        return res.status(400).json({ message: "Minimum and maximum price are required" });
      }
      if (Number(price_min) > Number(price_max)) {
        return res.status(400).json({ message: "Minimum price cannot be greater than maximum price" });
      }
    }

    // ===================================================
    // DATE VALIDATION
    // ===================================================
    if (start_at && end_at) {
      const startDate = new Date(start_at);
      const endDate = new Date(end_at);
      if (startDate >= endDate) {
        return res.status(400).json({ message: "Start date must be before end date" });
      }
    }

    // ===================================================
    // STATUS
    // ===================================================
    const finalStatus = status || "draft";
    const isActive = finalStatus === "active";

    // ===================================================
    // CREATE DATA
    // ===================================================
    const discountData = {
      code: code && code.trim() ? code.trim().toUpperCase() : `DISC-${Date.now().toString().slice(-6)}`,
      name: name.trim(),
      description: description || "",
      type: getDiscountType(value_type),
      value: Number(value),
      maxDiscountAmount: max_discount !== undefined && max_discount !== null && max_discount !== "" ? Number(max_discount) : null,
      applyTo,
      // ✅ Sirf matching target type ki ids save hoti hain
      ...resolveTargetArrays(applyTo, {
        selected_product_ids,
        selected_category_ids,
        selected_brand_ids,
        selected_tag_ids,
        selected_size_ids,
      }),
      priceMin: applyTo === "price_range" ? Number(price_min) : null,
      priceMax: applyTo === "price_range" ? Number(price_max) : null,
      minOrderValue: min_order_amount !== undefined && min_order_amount !== null && min_order_amount !== "" ? Number(min_order_amount) : 0,
      minQuantity: min_quantity !== undefined && min_quantity !== null && min_quantity !== "" ? Number(min_quantity) : null,
      startDate: start_at ? new Date(start_at) : new Date(),
      endDate: end_at ? new Date(end_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      usageLimit: usage_limit !== undefined && usage_limit !== null && usage_limit !== "" ? Number(usage_limit) : null,
      perUserLimit: usage_per_customer !== undefined && usage_per_customer !== null && usage_per_customer !== "" ? Number(usage_per_customer) : 1,
      priority: priority !== undefined && priority !== "" ? Number(priority) : 1,
      isStackable: Boolean(is_stackable),
      status: finalStatus,
      isActive,
      createdBy: req.user?._id || req.user?.id,
    };

    // ===================================================
    // CREATED BY CHECK (401 Prevention)
    // ===================================================
    if (!discountData.createdBy) {
      return res.status(401).json({
        message: "Authenticated user not found. Please ensure auth middleware is applied to this route.",
      });
    }

    // ===================================================
    // DUPLICATE CODE CHECK
    // ===================================================
    const normalizedCode = discountData.code;
    if (normalizedCode) {
      const existing = await Discount.findOne({ code: normalizedCode, is_deleted: false });
      if (existing) {
        return res.status(400).json({ message: "This discount code already exists. Please use a different code." });
      }
    }

    // ===================================================
    // SAVE
    // ===================================================
    const newDiscount = await Discount.create(discountData);
    queueTranslationSync(Discount, newDiscount._id);

    // ===================================================
    // SOCKET
    // ===================================================
    emitSocketEvent("discount:created", newDiscount);

    return res.status(201).json({
      message: "Discount created successfully",
      data: newDiscount,
    });
  } catch (error) {
    log.error("Create Discount Error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(", ") });
    }

    if (error.code === 11000) {
      return res.status(400).json({ message: "This discount code already exists. Please use a different code." });
    }

    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// =====================================================
// GET ALL DISCOUNTS
// =====================================================

exports.getDiscounts = async (req, res) => {
  try {
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 0; // 0 = legacy mode
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all").trim();
    const applyTo = String(req.query.applyTo || "").trim();
    const locale = /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(String(req.query.locale || "en"))
      ? String(req.query.locale).split("-")[0]
      : "en";

    const filter = { is_deleted: false };
    const andClauses = [];

    if (search) {
      andClauses.push({
        $or: [
          { name: { $regex: escapeRegex(search), $options: "i" } },
          { code: { $regex: escapeRegex(search), $options: "i" } },
        ],
      });
    }

    const targetAliases = {
      all_products: "all",
      product: "specific_products",
      category: "specific_categories",
      brand: "specific_brands",
    };
    const normalizedTarget = targetAliases[applyTo] || applyTo;
    if (normalizedTarget) andClauses.push({ applyTo: normalizedTarget });

    // ✅ Frontend sirf Active/Inactive model use karta hai (getDiscountStatus) —
    //    neeche wale clauses uski EXACT copy hain taake filter aur badge kabhi
    //    disagree na karein (pehle mix show hota tha):
    //    inactive = isActive false YA status list me YA expired, baaki sab active.
    //    Purani exact values (draft/scheduled/disabled) backward-compat ke liye waise hi.
    const now = new Date();
    const INACTIVE_STATUSES = ["inactive", "disabled", "draft", "scheduled", "expired"];
    const notExpiredClause = { $or: [{ endDate: { $gte: now } }, { endDate: null }] };
    const statusClauseFor = (s) => {
      if (s === "active") {
        return {
          $and: [
            { isActive: { $ne: false } },
            { status: { $nin: INACTIVE_STATUSES } },
            notExpiredClause,
          ],
        };
      }
      if (s === "inactive") {
        return {
          $or: [
            { isActive: false },
            { status: { $in: INACTIVE_STATUSES } },
            { endDate: { $lt: now } },
          ],
        };
      }
      if (s && s !== "all") return { status: s };
      return null;
    };
    const listClause = statusClauseFor(status);
    if (listClause) andClauses.push(listClause);

    if (andClauses.length) filter.$and = andClauses;

    // ✅ Server-side stats — poore dataset par (search respect, status se independent),
    //    taake stat cards current page tak mehdood na hon
    const baseAnd = andClauses.filter((c) => c !== listClause);
    const baseQuery = { is_deleted: false, ...(baseAnd.length ? { $and: baseAnd } : {}) };
    const withStatus = (s) => {
      const c = statusClauseFor(s);
      const all = [...baseAnd, ...(c ? [c] : [])];
      return { is_deleted: false, ...(all.length ? { $and: all } : {}) };
    };

    // ---- LEGACY MODE (no limit) → hard-capped (§4.5) ----
    if (!limit) {
      const { legacyCap } = require("../utils/legacyListCap");
      const discounts = await Discount.find(filter)
        .populate("selectedProducts", "name translations sku selling_price")
        .populate("selectedCategories", "name translations")
        .populate("selectedBrands", "name translations")
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .sort({ createdAt: -1 })
        .limit(legacyCap(0, 50));
      return res.status(200).json(discounts);
    }

    // ---- PAGINATED MODE ----
    const total = await Discount.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages || 1);
    const skip = (safePage - 1) * limit;

    const [baseTotal, activeCount, inactiveCount, discounts] = await Promise.all([
      Discount.countDocuments(baseQuery),
      Discount.countDocuments(withStatus("active")),
      Discount.countDocuments(withStatus("inactive")),
      (() => {
        const query = Discount.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
        if (req.query.admin_list === "1") {
          return query.select(["name", "code", `translations.name.${locale}`, "applyTo", "type", "value", "isActive", "status", "endDate", "selectedProducts", "selectedCategories", "selectedBrands"].join(" ")).lean();
        }
        return query
          .populate("selectedProducts", "name translations sku selling_price")
          .populate("selectedCategories", "name translations")
          .populate("selectedBrands", "name translations")
          .populate("createdBy", "name email")
          .populate("updatedBy", "name email");
      })(),
    ]);

    return res.status(200).json({
      success: true,
      data: discounts,
      // ✅ Stat cards inhi numbers par bante hain (poora dataset, sirf current page nahi)
      stats: {
        total: baseTotal,
        active: activeCount,
        inactive: inactiveCount,
      },
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
    log.error("Get Discounts Error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// =====================================================
// ✅ SHARED RESPONSE BUILDER (populate + Employee fallback)
// =====================================================
// createdBy/updatedBy ka ref "User" hai lekin admin accounts Employee collection
// mein hote hain — aise case mein .populate(...) null deta hai. GET aur PUT dono
// ek hi resolved payload dein taake UI ko "Updated By" ke liye refresh na karna
// pade (PUT/socket response pehle raw ObjectId de raha tha).
const buildDiscountResponse = async (id) => {
  // Raw ids — populate fail hone par fallback ke liye.
  const raw = await Discount.findOne({ _id: id, is_deleted: false })
    .select("createdBy updatedBy")
    .lean();

  const discount = await Discount.findOne({ _id: id, is_deleted: false })
    .populate("selectedProducts", "name translations sku selling_price")
    .populate("selectedCategories", "name translations")
    .populate("selectedBrands", "name translations")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!discount) return null;

  // Creator/editor Employee hai to populate null deta hai — properly resolve karo.
  const obj = discount.toObject();
  if (!obj.createdBy) {
    obj.createdBy = await resolveCreatorInfo(raw?.createdBy);
  }
  if (!obj.updatedBy) {
    obj.updatedBy = await resolveCreatorInfo(raw?.updatedBy);
  }
  return obj;
};

// =====================================================
// GET SINGLE DISCOUNT
// =====================================================

exports.getDiscountById = async (req, res) => {
  try {
    if (req.query.admin_detail === "1") {
      const locale = /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(String(req.query.locale || "en"))
        ? String(req.query.locale).split("-")[0]
        : "en";
      const discount = await Discount.findOne({ _id: req.params.id, is_deleted: false })
        .select(["name", "code", "description", `translations.name.${locale}`, `translations.description.${locale}`, "applyTo", "type", "value", "minOrderValue", "minQuantity", "startDate", "endDate", "usageLimit", "perUserLimit", "status", "isActive", "selectedProducts", "selectedCategories", "selectedBrands", "createdBy", "updatedBy", "createdAt", "updatedAt"].join(" "))
        .lean();
      if (!discount) return res.status(404).json({ message: "Discount not found" });
      const [createdBy, updatedBy] = await Promise.all([
        resolveCreatorInfo(discount.createdBy),
        resolveCreatorInfo(discount.updatedBy),
      ]);
      return res.status(200).json({ ...discount, createdBy, updatedBy });
    }
    const obj = await buildDiscountResponse(req.params.id);

    if (!obj) {
      return res.status(404).json({ message: "Discount not found" });
    }

    return res.status(200).json(obj);
  } catch (error) {
    log.error("Get Discount By ID Error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// Paginated, minimal target rows for the admin discount detail page.
exports.getDiscountTargets = async (req, res) => {
  try {
    const discount = await Discount.findOne({ _id: req.params.id, is_deleted: false })
      .select("applyTo selectedProducts selectedCategories selectedBrands")
      .lean();
    if (!discount) return res.status(404).json({ message: "Discount not found" });

    const targetType = String(req.query.type || "");
    const locale = /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(String(req.query.locale || "en"))
      ? String(req.query.locale).split("-")[0]
      : "en";
    const config = {
      products: { key: "selectedProducts", Model: Product, fields: ["name", `translations.name.${locale}`, "sku"].join(" ") },
      categories: { key: "selectedCategories", Model: Category, fields: ["name", `translations.name.${locale}`].join(" ") },
      brands: { key: "selectedBrands", Model: Brand, fields: ["name", `translations.name.${locale}`].join(" ") },
    }[targetType];
    if (!config) return res.status(400).json({ message: "Invalid target type" });

    const ids = Array.isArray(discount[config.key]) ? discount[config.key] : [];
    const limitValue = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : 10;
    const requestedPage = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const total = ids.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, pages);
    const pageIds = ids.slice((page - 1) * limit, page * limit);
    const records = pageIds.length
      ? await config.Model.find({ _id: { $in: pageIds } }).select(config.fields).lean()
      : [];
    const byId = new Map(records.map((record) => [String(record._id), record]));
    const data = pageIds.map((id) => byId.get(String(id))).filter(Boolean);

    return res.status(200).json({
      success: true,
      data,
      pagination: { total, page, limit, pages, hasNext: page < pages, hasPrev: page > 1 },
    });
  } catch (error) {
    log.error("Get Discount Targets Error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// =====================================================
// UPDATE DISCOUNT
// =====================================================

exports.updateDiscount = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      target_type,
      value_type,
      value,
      max_discount,
      selected_product_ids,
      selected_category_ids,
      selected_brand_ids,
      selected_tag_ids,
      selected_size_ids,
      price_min,
      price_max,
      min_order_amount,
      min_quantity,
      start_at,
      end_at,
      usage_limit,
      usage_per_customer,
      priority,
      is_stackable,
      status,
    } = req.body;

    // ===================================================
    // FIND DISCOUNT
    // ===================================================
    const discount = await Discount.findOne({
      _id: req.params.id,
      is_deleted: false,
    });

    if (!discount) {
      return res.status(404).json({ message: "Discount not found" });
    }

    // ===================================================
    // TARGET
    // ===================================================
    const applyTo = getApplyTo(target_type || discount.applyTo);

    // ===================================================
    // UPDATE BASIC
    // ===================================================
    if (name !== undefined) discount.name = name.trim();
    if (code !== undefined) discount.code = code.trim().toUpperCase();
    if (description !== undefined) discount.description = description;

    // ===================================================
    // VALUE
    // ===================================================
    if (value_type !== undefined) {
      discount.type = getDiscountType(value_type);
    }

    if (value !== undefined) {
      // ✅ Update par bhi negative discount value allowed nahi
      if (value === null || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) {
        return res.status(400).json({
          message: "Discount value cannot be less than 0",
        });
      }
      discount.value = Number(value);
    }

    // ✅ FIXED: Percentage validation for Update also updated to 100%
    if (discount.type === "percentage" && (discount.value < 0 || discount.value > 100)) {
      return res.status(400).json({
        message: "Percentage discount must be between 0 and 100",
      });
    }

    if (max_discount !== undefined) {
      discount.maxDiscountAmount = max_discount === "" || max_discount === null ? null : Number(max_discount);
    }

    // ===================================================
    // TARGET ARRAYS
    // ===================================================
    discount.applyTo = applyTo;
    // ✅ Target type change par purane (stale) ids clear ho jaate hain — sirf matching
    //    type ki selection bachti hai. Partial update me existing ids safe rehti hain.
    Object.assign(
      discount,
      resolveTargetArrays(
        applyTo,
        {
          selected_product_ids,
          selected_category_ids,
          selected_brand_ids,
          selected_tag_ids,
          selected_size_ids,
        },
        discount
      )
    );

    // ===================================================
    // PRICE RANGE
    // ===================================================
    if (applyTo === "price_range") {
      if (price_min !== undefined) discount.priceMin = Number(price_min);
      if (price_max !== undefined) discount.priceMax = Number(price_max);

      if (discount.priceMin !== null && discount.priceMax !== null && discount.priceMin > discount.priceMax) {
        return res.status(400).json({ message: "Minimum price cannot be greater than maximum price" });
      }
    } else {
      discount.priceMin = null;
      discount.priceMax = null;
    }

    // ===================================================
    // CONDITIONS & DATES & USAGE & RULES & STATUS
    // ===================================================

    // ✅ Update mein bhi limits / amounts 0 se kam nahi ho sakte
    const negativeField = findNegativeField([
      ["Minimum order amount", min_order_amount],
      ["Minimum quantity", min_quantity],
      ["Usage limit", usage_limit],
      ["Per customer limit", usage_per_customer],
      ["Max discount", max_discount],
    ]);

    if (negativeField) {
      return res.status(400).json({
        message: `${negativeField} cannot be less than 0`,
      });
    }

    if (min_order_amount !== undefined) {
      discount.minOrderValue = min_order_amount === "" || min_order_amount === null ? 0 : Number(min_order_amount);
    }
    if (min_quantity !== undefined) {
      discount.minQuantity = min_quantity === "" || min_quantity === null ? null : Number(min_quantity);
    }
    if (start_at !== undefined) discount.startDate = new Date(start_at);
    if (end_at !== undefined) discount.endDate = new Date(end_at);

    // ===================================================
    // DATE VALIDATION
    // ===================================================
    if (discount.startDate && discount.endDate && discount.startDate >= discount.endDate) {
      return res.status(400).json({ message: "Start date must be before end date" });
    }
    
    if (usage_limit !== undefined) {
      discount.usageLimit = usage_limit === "" || usage_limit === null ? null : Number(usage_limit);
    }
    if (usage_per_customer !== undefined) discount.perUserLimit = Number(usage_per_customer);
    if (priority !== undefined) discount.priority = Number(priority);
    if (is_stackable !== undefined) discount.isStackable = Boolean(is_stackable);
    
    if (status !== undefined) {
      discount.status = status;
      discount.isActive = status === "active";
    }

    // ===================================================
    // UPDATED BY
    // ===================================================
    const userId = req.user?._id || req.user?.id;
    if (userId) {
      discount.updatedBy = userId;
    }

    // ===================================================
    // DUPLICATE CODE CHECK (UPDATE)
    // ===================================================
    if (discount.isModified("code") && discount.code) {
      const existing = await Discount.findOne({ code: discount.code, is_deleted: false, _id: { $ne: discount._id } });
      if (existing) {
        return res.status(400).json({ message: "This discount code already exists. Please use a different code." });
      }
    }

    // ===================================================
    // SAVE
    // ===================================================
    const updatedDiscount = await discount.save();
    queueTranslationSync(Discount, updatedDiscount._id);

    // ===================================================
    // SOCKET
    // ===================================================
    // ✅ Wahi resolved payload (populated + Employee fallback) emit/return karo
    // jo GET deta hai — pehle raw doc jata tha jisme updatedBy sirf ObjectId
    // hota tha, isliye UI "Updated By" refresh ke baghair dikha nahi paata tha.
    const payload = (await buildDiscountResponse(updatedDiscount._id)) || updatedDiscount.toObject();

    emitSocketEvent("discount:updated", payload);

    return res.status(200).json({
      message: "Discount updated successfully",
      data: payload,
    });
  } catch (error) {
    log.error("Update Discount Error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(", ") });
    }

    if (error.code === 11000) {
      return res.status(400).json({ message: "This discount code already exists. Please use a different code." });
    }

    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// =====================================================
// DELETE DISCOUNT
// =====================================================

exports.deleteDiscount = async (req, res) => {
  try {
    const deletedDiscount = await Discount.findOneAndUpdate(
      { _id: req.params.id, is_deleted: false },
      { is_deleted: true },
      { returnDocument: "after" }
    );

    if (!deletedDiscount) {
      return res.status(404).json({ message: "Discount not found" });
    }

    emitSocketEvent("discount:deleted", req.params.id);

    return res.status(200).json({ message: "Discount deleted successfully" });
  } catch (error) {
    log.error("Delete Discount Error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};
// =====================================================
// GET ACTIVE DISCOUNTS (PUBLIC - NO AUTH)
// =====================================================

exports.getPublicDiscounts = async (req, res) => {
  try {
    const now = new Date();

    // Badge/pricing fields only — no code, usageLimit, perUserLimit, minOrderValue (§9.2)
    const discounts = await Discount.find({
      is_deleted: false,
      isActive: true,
      status: "active",
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .populate("selectedProducts", "_id name")
      .populate("selectedCategories", "_id name")
      .populate("selectedBrands", "_id name")
      .select("_id name type value applyTo selectedProducts selectedCategories selectedBrands selectedTags priority startDate endDate isActive status isStackable translations.name")
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: discounts,
    });
  } catch (error) {
    log.error("Get Public Discounts Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};
