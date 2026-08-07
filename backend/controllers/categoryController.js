const Category = require("../models/Category");
const { getNextCategoryCode } = require("../utils/categoryCodeHelper");

// ==========================================
// GET NEXT CATEGORY CODE
// ==========================================
const getNextCode = async (req, res) => {
  try {
    const nextCode = await getNextCategoryCode();
    res.status(200).json({ nextCode });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// CREATE CATEGORY
// ==========================================
const createCategory = async (req, res) => {
  try {
    // Agar frontend ne code bheja hai toh wo use karo, warna generate karo
    let categoryCode = req.body.category_code;
    if (!categoryCode) {
      categoryCode = await getNextCategoryCode();
    }

    const category = await Category.create({
      category_code: categoryCode,
      name: req.body.name,
      description: req.body.description || "",
      createdby: req.user?._id || null,
      updatedby: req.user?._id || null,
      is_deleted: false,
    });

    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ==========================================
// GET ALL CATEGORIES
// ==========================================
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      is_deleted: false,
    })
      .select("-__v")
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// GET CATEGORY BY ID
// ==========================================
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      is_deleted: false,
    })
      .select("-__v")
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// UPDATE CATEGORY
// ==========================================
const updateCategory = async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      is_deleted: false,
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // User code ko change bhi kar sake isliye ye line add ki hai
    category.category_code = req.body.category_code ?? category.category_code;
    category.name = req.body.name ?? category.name;
    category.description = req.body.description ?? category.description;
    category.updatedby = req.user?._id || null;

    await category.save();

    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ==========================================
// SOFT DELETE CATEGORY
// ==========================================
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      is_deleted: false,
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    category.is_deleted = true;
    category.deleted_at = new Date();
    category.deletedby = req.user?._id || null;

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getNextCode,
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};