const Brand = require("../models/Brand");
const Product = require("../models/Product");
const createBrand = async (req, res) => {
    try{
        const brand = await Brand.create(req.body);
         res.status(201).json(brand);
    } catch (error) {
  res.status(400).json({
    message: error.message,
  });
}
};  
const getBrands = async (req, res) => {
  try {
const brands = await Brand.find().select("-__v");
res.status(200).json(brands);
  } catch (error) {
  res.status(500).json({
    message: error.message,
  });
}
};
const getBrandById = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id).select("-__v");

    if (!brand) {
      return res.status(404).json({
        message: "Brand not found",
      });
    }

    res.status(200).json(brand);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
const getBrandWithProducts = async (req, res) => {
  try {
    const brand = await Brand.findById(req.params.id).select("-__v");

    if (!brand) {
      return res.status(404).json({
        message: "Brand not found",
      });
    }

    const products = await Product.find({
      brand_id: req.params.id,
    })
      .select("-__v")
      .populate("category_id", "category_code name");

    res.status(200).json({
      brand,
      products,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
const updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    ).select("-__v");

    if (!brand) {
      return res.status(404).json({
        message: "Brand not found",
      });
    }

    res.status(200).json(brand);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};
const deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);

    if (!brand) {
      return res.status(404).json({
        message: "Brand not found",
      });
    }

    res.status(200).json({
      message: "Brand deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
module.exports = {createBrand,getBrands,getBrandById, getBrandWithProducts,updateBrand,deleteBrand};