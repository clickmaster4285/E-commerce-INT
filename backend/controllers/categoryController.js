const Category = require("../models/Category");

// CREATE CATEGORY
const createCategory = async (req, res) => {
  try {
    const category = await Category.create({
      ...req.body,
      createdby: req.user?._id || null,
      updatedby: req.user?._id || null,
    });

    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

// GET ALL CATEGORIES
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .select("-__v")
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET CATEGORY BY ID
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .select("-__v")
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// UPDATE CATEGORY
const updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedby: req.user?._id || null,
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-__v");

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    res.status(200).json(category);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

// DELETE CATEGORY
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    category.deletedby = req.user?._id || null;
    await category.save();

    await Category.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Category deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};