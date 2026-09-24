const Tag = require("../models/Tag");
const User = require("../models/User");
const Employee = require("../models/Employee");
const mongoose = require("mongoose");

// Helper to resolve user/employee info
const resolveCreator = async (userId) => {
  if (!userId) return null;
  try {
    const user = await User.findById(userId).select("name email").lean();
    if (user) return { name: user.name, email: user.email };
    const employee = await Employee.findById(userId).select("name email").lean();
    if (employee) return { name: employee.name, email: employee.email };
    return null;
  } catch {
    return null;
  }
};

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

    // Manually resolve createdby/updatedby from User and Employee
    const resolvedTags = await Promise.all(
      tags.map(async (tag) => {
        const createdbyInfo = await resolveCreator(tag.createdby);
        const updatedbyInfo = await resolveCreator(tag.updatedby);
        return {
          ...tag,
          createdby: createdbyInfo,
          updatedby: updatedbyInfo,
        };
      })
    );

    return res.status(200).json(resolvedTags);
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
    let slug = generateSlug(cleanName);
    if (!slug) slug = "tag-" + Date.now();

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
      slug: slug,
      createdby: req.user?._id || null,
      updatedby: req.user?._id || null,
      is_deleted: false,
    });
    const tagDoc = await Tag.findById(newTag._id).lean();
    const createdbyInfo = await resolveCreator(tagDoc.createdby);
    const updatedbyInfo = await resolveCreator(tagDoc.updatedby);
    const populatedTag = { ...tagDoc, createdby: createdbyInfo, updatedby: updatedbyInfo };
    return res.status(201).json(populatedTag);
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
    let slug = generateSlug(cleanName);
    if (!slug) slug = "tag-" + Date.now();

    // Check if another tag has same name/slug
    // ✅ FIX: req.params.id ek STRING hai — MongoDB string ko ObjectId se
    // $ne comparison mein cast nahi karta, is liye tag KHUD bhi duplicate
    // match ho jata tha (same name save karne par bhi error aata tha).
    // ObjectId me explicitly cast karte hain taake self exclude ho.
    const excludeId = mongoose.Types.ObjectId.isValid(id)
      ? new mongoose.Types.ObjectId(id)
      : null;

    const duplicateQuery = {
      $or: [{ name: { $regex: new RegExp(`^${cleanName}$`, 'i') } }, { slug: slug }],
      is_deleted: { $ne: true }
    };
    if (excludeId) {
      duplicateQuery._id = { $ne: excludeId };
    }

    const duplicate = await Tag.findOne(duplicateQuery);

    if (duplicate) {
      return res.status(409).json({ message: "Another tag with this name already exists" });
    }

    const updatedTag = await Tag.findByIdAndUpdate(
      id,
      { 
        name: cleanName, 
        slug: slug, // ✅ Updating slug as well
        updatedby: req.user?._id || null,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedTag) {
      return res.status(404).json({ message: "Tag not found" });
    }

    const tagDoc = await Tag.findById(updatedTag._id).lean();
    const createdbyInfo = await resolveCreator(tagDoc.createdby);
    const updatedbyInfo = await resolveCreator(tagDoc.updatedby);
    const populatedTag = { ...tagDoc, createdby: createdbyInfo, updatedby: updatedbyInfo };
    return res.status(200).json(populatedTag);
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