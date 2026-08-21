const Tag = require("../models/Tag");

// Helper function to generate slug from name
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")     // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-");  // Replace multiple - with single -
};

// ✅ GET ALL TAGS
const getAllTags = async (req, res) => {
  try {
    const tags = await Tag.find({ is_deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json(tags);
  } catch (error) {
    console.error("❌ [getAllTags] Error:", error);
    return res.status(500).json({ message: "Failed to fetch tags" });
  }
};

// ✅ CREATE NEW TAG
const createTag = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Tag name is required" });
    }

    const cleanName = String(name).trim();
    const slug = generateSlug(cleanName);

    // Check duplicate by name OR slug
    const existing = await Tag.findOne({ 
      $or: [
        { name: { $regex: new RegExp(`^${cleanName}$`, 'i') } }, 
        { slug: slug }
      ], 
      is_deleted: { $ne: true } 
    });

    if (existing) {
      return res.status(409).json({ message: "Tag already exists" });
    }

    const newTag = await Tag.create({
      name: cleanName,
      slug: slug, // ✅ Saving generated slug
      createdby: req.user?._id || null,
      updatedby: req.user?._id || null,
      is_deleted: false,
    });

    return res.status(201).json(newTag);
  } catch (error) {
    console.error("❌ [createTag] Error:", error);
    // Handle duplicate key error specifically if it slips through
    if (error.code === 11000) {
      return res.status(409).json({ message: "Tag already exists (Duplicate Slug)" });
    }
    return res.status(500).json({ message: "Failed to create tag" });
  }
};

// ✅ UPDATE TAG
const updateTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Tag name is required" });
    }

    const cleanName = String(name).trim();
    const slug = generateSlug(cleanName);

    // Check if another tag has same name/slug
    const duplicate = await Tag.findOne({ 
      _id: { $ne: id }, 
      $or: [{ name: { $regex: new RegExp(`^${cleanName}$`, 'i') } }, { slug: slug }],
      is_deleted: { $ne: true } 
    });

    if (duplicate) {
      return res.status(409).json({ message: "Another tag with this name already exists" });
    }

    const updatedTag = await Tag.findByIdAndUpdate(
      id,
      { 
        name: cleanName, 
        slug: slug, // ✅ Updating slug as well
        updatedby: req.user?._id || null 
      },
      { new: true }
    );

    if (!updatedTag) {
      return res.status(404).json({ message: "Tag not found" });
    }

    return res.status(200).json(updatedTag);
  } catch (error) {
    console.error("❌ [updateTag] Error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ message: "Duplicate slug detected" });
    }
    return res.status(500).json({ message: "Failed to update tag" });
  }
};

// ✅ DELETE TAG (Soft Delete)
const deleteTag = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedTag = await Tag.findByIdAndUpdate(
      id,
      { 
        is_deleted: true, 
        deleted_at: new Date(), 
        deletedby: req.user?._id || null 
      },
      { new: true }
    );

    if (!deletedTag) {
      return res.status(404).json({ message: "Tag not found" });
    }

    return res.status(200).json({ message: "Tag deleted successfully" });
  } catch (error) {
    console.error("❌ [deleteTag] Error:", error);
    return res.status(500).json({ message: "Failed to delete tag" });
  }
};

module.exports = { getAllTags, createTag, updateTag, deleteTag };