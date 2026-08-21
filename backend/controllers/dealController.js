const Deal = require("../models/Deal");

// ==========================================
// CREATE DEAL
// ==========================================

const createDeal = async (req, res) => {
  try {
    const deal = await Deal.create({
      ...req.body,
      createdBy: req.user?._id || req.user?.id || null,
      updatedBy: req.user?._id || req.user?.id || null,
    });

    res.status(201).json({
      success: true,
      message: "Deal created successfully",
      data: deal,
    });
  } catch (error) {
    console.error("Create Deal Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create deal",
    });
  }
};

// ==========================================
// GET ALL DEALS
// ==========================================

const getDeals = async (req, res) => {
  try {
    const {
      search = "",
      status = "all",
      type = "all",
      applyTo = "all",
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    // ==========================================
    // SEARCH
    // ==========================================

    if (search.trim()) {
      query.$or = [
        {
          name: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          description: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    // ==========================================
    // TYPE FILTER
    // ==========================================

    if (type !== "all") {
      query.type = type;
    }

    // ==========================================
    // APPLY TO FILTER
    // ==========================================

    if (applyTo !== "all") {
      query.applyTo = applyTo;
    }

    // ==========================================
    // STATUS FILTER
    // ==========================================

    const now = new Date();

    if (status === "active") {
      query.isActive = true;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    }

    if (status === "upcoming") {
      query.startDate = { $gt: now };
    }

    if (status === "expired") {
      query.endDate = { $lt: now };
    }

    if (status === "disabled") {
      query.isActive = false;
    }

    // ==========================================
    // PAGINATION
    // ==========================================

    const currentPage = Math.max(Number(page) || 1, 1);
    const perPage = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const skip = (currentPage - 1) * perPage;

    // ==========================================
    // GET DATA
    // ==========================================

    const [deals, total] = await Promise.all([
      Deal.find(query)
        .populate("productIds", "name sku images selling_price")
        .populate("categoryIds", "name code")
        .populate("brandIds", "name")
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .sort({
          priority: -1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(perPage)
        .lean(),

      Deal.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: deals,
      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        totalPages: Math.ceil(total / perPage),
        hasNextPage: currentPage < Math.ceil(total / perPage),
        hasPreviousPage: currentPage > 1,
      },
    });
  } catch (error) {
    console.error("Get Deals Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch deals",
    });
  }
};

// ==========================================
// GET SINGLE DEAL
// ==========================================

const getDealById = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await Deal.findById(id)
      .populate("productIds", "name sku images selling_price cost_price")
      .populate("categoryIds", "name code")
      .populate("brandIds", "name")
      .populate("customerIds", "name email")
      .populate("bundleProducts.product", "name sku images selling_price")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    res.status(200).json({
      success: true,
      data: deal,
    });
  } catch (error) {
    console.error("Get Deal By ID Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch deal",
    });
  }
};

// ==========================================
// UPDATE DEAL
// ==========================================

const updateDeal = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await Deal.findById(id);

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    Object.assign(deal, req.body);

    deal.updatedBy =
      req.user?._id ||
      req.user?.id ||
      deal.updatedBy ||
      null;

    await deal.save();

    const updatedDeal = await Deal.findById(id)
      .populate("productIds", "name sku images selling_price")
      .populate("categoryIds", "name code")
      .populate("brandIds", "name")
      .populate("bundleProducts.product", "name sku images selling_price");

    res.status(200).json({
      success: true,
      message: "Deal updated successfully",
      data: updatedDeal,
    });
  } catch (error) {
    console.error("Update Deal Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to update deal",
    });
  }
};

// ==========================================
// DELETE DEAL
// ==========================================

const deleteDeal = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await Deal.findById(id);

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    await Deal.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Deal deleted successfully",
    });
  } catch (error) {
    console.error("Delete Deal Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete deal",
    });
  }
};

// ==========================================
// TOGGLE DEAL STATUS
// ==========================================

const toggleDealStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await Deal.findById(id);

    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal not found",
      });
    }

    deal.isActive = !deal.isActive;

    deal.updatedBy =
      req.user?._id ||
      req.user?.id ||
      deal.updatedBy ||
      null;

    await deal.save();

    res.status(200).json({
      success: true,
      message: deal.isActive
        ? "Deal activated successfully"
        : "Deal disabled successfully",
      data: deal,
    });
  } catch (error) {
    console.error("Toggle Deal Status Error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to update deal status",
    });
  }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  createDeal,
  getDeals,
  getDealById,
  updateDeal,
  deleteDeal,
  toggleDealStatus,
};