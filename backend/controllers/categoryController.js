const Category = require("../models/Category");
const { getNextCategoryCode } = require("../utils/categoryCodeHelper");
const { getIO } = require("../utils/socket");
const {
  pushGlobalActivity,
  getChanges,
} = require("../utils/activityHelper");

/* =========================================================
   SOCKET HELPER
========================================================= */

const emitSocketEvent = (event, data) => {
  try {
    const io = getIO();

    if (io) {
      io.emit(event, data);
      console.log(`📡 Socket emitted: ${event}`);
    }
  } catch (error) {
    console.warn(
      `⚠️ Socket emit failed for ${event}:`,
      error.message
    );
  }
};

/* =========================================================
   GET NEXT CATEGORY CODE
========================================================= */

const getNextCode = async (req, res) => {
  try {
    const nextCode = await getNextCategoryCode();

    res.status(200).json({
      nextCode,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

/* =========================================================
   CREATE CATEGORY
========================================================= */

const createCategory = async (req, res) => {
  try {
    let categoryCode = req.body.category_code;

    if (!categoryCode) {
      categoryCode = await getNextCategoryCode();
    }

    const category = await Category.create({
      category_code: categoryCode,

      name: req.body.name,

      description: req.body.description || "",

      /*
       * IMPORTANT
       * Save selected parent category
       */
      parent_category_id:
        req.body.parent_category_id || null,

      createdby: req.user?._id || null,

      updatedby: req.user?._id || null,

      is_deleted: false,
    });

    /* =====================================================
       LOG ACTIVITY
    ===================================================== */

    const performerName =
      req.user?.name || "Admin";

    const performerId =
      req.user?._id || null;

    const io = req.io || getIO();

    await pushGlobalActivity(
      io,
      {
        action: `${performerName} created category "${category.name}"`,

        category: "Category Management",

        performedBy: performerId,

        performedByName: performerName,

        details: {
          categoryCode: categoryCode,

          categoryName: category.name,

          parentCategoryId:
            category.parent_category_id,
        },
      },
      performerId
    );

    /* =====================================================
       SOCKET
    ===================================================== */

    emitSocketEvent(
      "categoryCreated",
      category
    );

    res.status(201).json(category);
  } catch (error) {
    console.error(
      "Create category error:",
      error
    );

    res.status(400).json({
      message: error.message,
    });
  }
};

/* =========================================================
   GET ALL CATEGORIES
========================================================= */

const getCategories = async (req, res) => {
  try {
    const categories =
      await Category.find({
        is_deleted: false,
      })
        .select("-__v")

        /*
         * IMPORTANT
         * Populate parent category
         */
        .populate(
          "parent_category_id",
          "name category_code"
        )

        .populate(
          "createdby",
          "name email"
        )

        .populate(
          "updatedby",
          "name email"
        )

        .sort({
          created_at: -1,
        });

    res.status(200).json(categories);
  } catch (error) {
    console.error(
      "Get categories error:",
      error
    );

    res.status(500).json({
      message: error.message,
    });
  }
};

/* =========================================================
   GET CATEGORY BY ID
========================================================= */

const getCategoryById = async (req, res) => {
  try {
    const category =
      await Category.findOne({
        _id: req.params.id,

        is_deleted: false,
      })
        .select("-__v")

        /*
         * IMPORTANT
         * Populate parent category
         */
        .populate(
          "parent_category_id",
          "name category_code"
        )

        .populate(
          "createdby",
          "name email"
        )

        .populate(
          "updatedby",
          "name email"
        );

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    res.status(200).json(category);
  } catch (error) {
    console.error(
      "Get category by ID error:",
      error
    );

    res.status(500).json({
      message: error.message,
    });
  }
};

/* =========================================================
   UPDATE CATEGORY
========================================================= */

const updateCategory = async (req, res) => {
  try {
    const category =
      await Category.findOne({
        _id: req.params.id,

        is_deleted: false,
      });

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    /* =====================================================
       OLD DATA
    ===================================================== */

    const oldData =
      category.toObject();

    /* =====================================================
       UPDATE BASIC FIELDS
    ===================================================== */

    category.category_code =
      req.body.category_code ??
      category.category_code;

    category.name =
      req.body.name ??
      category.name;

    category.description =
      req.body.description ??
      category.description;

    /* =====================================================
       IMPORTANT
       UPDATE PARENT CATEGORY
    ===================================================== */

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "parent_category_id"
      )
    ) {
      category.parent_category_id =
        req.body.parent_category_id || null;
    }

    /* =====================================================
       UPDATED BY
    ===================================================== */

    category.updatedby =
      req.user?._id || null;

    /* =====================================================
       SAVE
    ===================================================== */

    await category.save();

    /* =====================================================
       ACTIVITY
    ===================================================== */

    const trackedFields = [
      "name",
      "category_code",
      "description",
      "parent_category_id",
    ];

    const changes = getChanges(
      oldData,
      category.toObject(),
      trackedFields
    );

    const performerName =
      req.user?.name || "Admin";

    const performerId =
      req.user?._id || null;

    const io =
      req.io || getIO();

    const changedFields =
      changes
        .map((c) => c.field)
        .join(", ");

    const actionMsg =
      changes.length > 0
        ? `${performerName} updated ${changedFields} for category "${category.name}"`
        : `${performerName} updated category "${category.name}"`;

    await pushGlobalActivity(
      io,
      {
        action: actionMsg,

        category:
          "Category Management",

        performedBy:
          performerId,

        performedByName:
          performerName,

        details: {
          changes,

          categoryId:
            category._id,
        },
      },
      performerId
    );

    /* =====================================================
       SOCKET
    ===================================================== */

    emitSocketEvent(
      "categoryUpdated",
      category
    );

    res.status(200).json(category);
  } catch (error) {
    console.error(
      "Update category error:",
      error
    );

    res.status(400).json({
      message: error.message,
    });
  }
};

/* =========================================================
   SOFT DELETE CATEGORY
========================================================= */

const deleteCategory = async (req, res) => {
  try {
    const category =
      await Category.findOne({
        _id: req.params.id,

        is_deleted: false,
      });

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    category.is_deleted = true;

    category.deleted_at =
      new Date();

    category.deletedby =
      req.user?._id || null;

    await category.save();

    /* =====================================================
       ACTIVITY
    ===================================================== */

    const performerName =
      req.user?.name || "Admin";

    const performerId =
      req.user?._id || null;

    const io =
      req.io || getIO();

    await pushGlobalActivity(
      io,
      {
        action: `${performerName} deleted category "${category.name}"`,

        category:
          "Category Management",

        performedBy:
          performerId,

        performedByName:
          performerName,

        details: {
          categoryId:
            category._id,

          categoryName:
            category.name,
        },
      },
      performerId
    );

    /* =====================================================
       SOCKET
    ===================================================== */

    emitSocketEvent(
      "categoryDeleted",
      {
        id: req.params.id,
      }
    );

    res.status(200).json({
      success: true,

      message:
        "Category deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete category error:",
      error
    );

    res.status(500).json({
      success: false,

      message:
        error.message,
    });
  }
};

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  getNextCode,

  createCategory,

  getCategories,

  getCategoryById,

  updateCategory,

  deleteCategory,
};