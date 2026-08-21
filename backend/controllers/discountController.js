const Discount = require("../models/Discount");

// =====================================================
// HELPER
// =====================================================

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean);
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

    // ✅ UPDATED: Percentage validation (Max 50%)
    if (value_type === "percentage" && Number(value) > 50) {
      return res.status(400).json({
        message: "Percentage discount cannot be greater than 50",
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
      selectedProducts: normalizeArray(selected_product_ids),
      selectedCategories: normalizeArray(selected_category_ids),
      selectedBrands: normalizeArray(selected_brand_ids),
      selectedTags: normalizeArray(selected_tag_ids),
      selectedSizes: normalizeArray(selected_size_ids),
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
      createdBy: req.user?._id || req.user?.id, // Auth middleware se aayega
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
    // SAVE
    // ===================================================
    const newDiscount = await Discount.create(discountData);

    // ===================================================
    // SOCKET
    // ===================================================
    if (req.io) {
      req.io.emit("discount:created", newDiscount);
      req.io.emit("discountCreated", newDiscount);
    }

    return res.status(201).json({
      message: "Discount created successfully",
      data: newDiscount,
    });
  } catch (error) {
    console.error("Create Discount Error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(", ") });
    }

    if (error.code === 11000) {
      return res.status(400).json({ message: "Discount code already exists." });
    }

    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// =====================================================
// GET ALL DISCOUNTS
// =====================================================

exports.getDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find({ is_deleted: false })
      .populate("selectedProducts", "name sku selling_price")
      .populate("selectedCategories", "name")
      .populate("selectedBrands", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json(discounts);
  } catch (error) {
    console.error("Get Discounts Error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// =====================================================
// GET SINGLE DISCOUNT
// =====================================================

exports.getDiscountById = async (req, res) => {
  try {
    const discount = await Discount.findOne({
      _id: req.params.id,
      is_deleted: false,
    })
      .populate("selectedProducts", "name sku selling_price")
      .populate("selectedCategories", "name")
      .populate("selectedBrands", "name");

    if (!discount) {
      return res.status(404).json({ message: "Discount not found" });
    }

    return res.status(200).json(discount);
  } catch (error) {
    console.error("Get Discount By ID Error:", error);
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
      discount.value = Number(value);
    }

    // ✅ UPDATED: Percentage validation for Update (Max 50%)
    if (discount.type === "percentage" && discount.value > 50) {
      return res.status(400).json({
        message: "Percentage discount cannot be greater than 50",
      });
    }

    if (max_discount !== undefined) {
      discount.maxDiscountAmount = max_discount === "" || max_discount === null ? null : Number(max_discount);
    }

    // ===================================================
    // TARGET ARRAYS
    // ===================================================
    discount.applyTo = applyTo;
    if (selected_product_ids !== undefined) discount.selectedProducts = normalizeArray(selected_product_ids);
    if (selected_category_ids !== undefined) discount.selectedCategories = normalizeArray(selected_category_ids);
    if (selected_brand_ids !== undefined) discount.selectedBrands = normalizeArray(selected_brand_ids);
    if (selected_tag_ids !== undefined) discount.selectedTags = normalizeArray(selected_tag_ids);
    if (selected_size_ids !== undefined) discount.selectedSizes = normalizeArray(selected_size_ids);

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
    if (min_order_amount !== undefined) {
      discount.minOrderValue = min_order_amount === "" || min_order_amount === null ? 0 : Number(min_order_amount);
    }
    if (min_quantity !== undefined) {
      discount.minQuantity = min_quantity === "" || min_quantity === null ? null : Number(min_quantity);
    }
    if (start_at !== undefined) discount.startDate = new Date(start_at);
    if (end_at !== undefined) discount.endDate = new Date(end_at);
    
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
    // SAVE
    // ===================================================
    const updatedDiscount = await discount.save();

    // ===================================================
    // SOCKET
    // ===================================================
    if (req.io) {
      req.io.emit("discount:updated", updatedDiscount);
      req.io.emit("discountUpdated", updatedDiscount);
    }

    return res.status(200).json({
      message: "Discount updated successfully",
      data: updatedDiscount,
    });
  } catch (error) {
    console.error("Update Discount Error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(", ") });
    }

    if (error.code === 11000) {
      return res.status(400).json({ message: "Discount code already exists." });
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
      { new: true }
    );

    if (!deletedDiscount) {
      return res.status(404).json({ message: "Discount not found" });
    }

    if (req.io) {
      req.io.emit("discount:deleted", req.params.id);
      req.io.emit("discountDeleted", req.params.id);
    }

    return res.status(200).json({ message: "Discount deleted successfully" });
  } catch (error) {
    console.error("Delete Discount Error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};