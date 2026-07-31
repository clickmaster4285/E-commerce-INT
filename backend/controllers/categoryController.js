const Category = require("../models/Category");

const createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body);

    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find();

    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getCategoryById = async (req, res) => {
try {
  const category = await Category.findById(req.params.id).select("-__v") 
  if(!category) {
    return res.status(404).json({
      message: "category not found",  
    });
  }
  res.status(200).json(category);
} catch(error){
  res.status(500).json({
    message: error.message,
  })
}
};
const updateCategory = async (req, res)=>{
try{
  const category = await Category.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true,});
  if(!category){
    return res.status(404).json({
      message: "category not found",
    });
  }
  res.status(200).json(category);
}catch(error){
res.status(400).json({
  message: error.message,
})
}
};

const deleteCategory = async (req, res)=> {
try{
  const category = await Category.findByIdAndDelete(req.params.id);
  if(!category){
    return res.status(404).json({
      message: "Category not found",  
    }); 
  }
  res.status(200).json({
    message: "category delete sucussfully"
  });
}catch(error){
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