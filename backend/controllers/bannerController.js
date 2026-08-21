const Banner = require("../models/Banner");
const fs = require("fs");
const path = require("path");

const deleteFile = (filePath) => {
  if (!filePath) return;
  const fullPath = path.join(__dirname, "..", filePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
};

// ✅ FIXED: Yeh function pehle missing tha, ab add kar diya gaya hai
exports.getBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
    res.json({ success: true, data: banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllBanners = async (req, res) => {
  try {
    const { status, bannerType, page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (bannerType) filter.bannerType = bannerType;
    if (search) filter.title = { $regex: search, $options: "i" };

    const total = await Banner.countDocuments(filter);
    const banners = await Banner.find(filter)
      .sort({ position: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, data: banners, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getActiveBanners = async (req, res) => {
  try {
    const now = new Date();
    const banners = await Banner.find({
      status: "active",
      $or: [{ startDate: null }, { startDate: { $lte: now } }],
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    }).sort({ position: 1 });
    res.json({ success: true, data: banners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createBanner = async (req, res) => {
  try {
    const data = { ...req.body };
    ["primaryButton", "secondaryButton", "displayRules"].forEach((k) => {
      if (typeof data[k] === "string") data[k] = JSON.parse(data[k]);
    });

    if (req.files) {
      if (req.files.desktopImage) data.desktopImage = `uploads/banners/${req.files.desktopImage[0].filename}`;
      if (req.files.tabletImage) data.tabletImage = `uploads/banners/${req.files.tabletImage[0].filename}`;
      if (req.files.mobileImage) data.mobileImage = `uploads/banners/${req.files.mobileImage[0].filename}`;
    }

    if (data.autoPublish && data.startDate) {
      data.status = new Date(data.startDate) > new Date() ? "scheduled" : "active";
    }

    const banner = await Banner.create(data);
    res.status(201).json({ success: true, data: banner });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: "Not found" });

    const data = { ...req.body };
    ["primaryButton", "secondaryButton", "displayRules"].forEach((k) => {
      if (typeof data[k] === "string") data[k] = JSON.parse(data[k]);
    });

    if (req.files) {
      ["desktopImage", "tabletImage", "mobileImage"].forEach((field) => {
        if (req.files[field]) {
          deleteFile(banner[field]);
          data[field] = `uploads/banners/${req.files[field][0].filename}`;
        }
      });
    }

    const updated = await Banner.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: "Not found" });
    banner.status = banner.status === "active" ? "inactive" : "active";
    await banner.save();
    res.json({ success: true, data: banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.duplicateBanner = async (req, res) => {
  try {
    const original = await Banner.findById(req.params.id);
    if (!original) return res.status(404).json({ success: false, message: "Not found" });
    const copy = original.toObject();
    delete copy._id; delete copy.createdAt; delete copy.updatedAt;
    copy.title = `${original.title} (Copy)`;
    copy.status = "draft";
    const newBanner = await Banner.create(copy);
    res.status(201).json({ success: true, data: newBanner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: "Not found" });
    [banner.desktopImage, banner.tabletImage, banner.mobileImage].forEach(deleteFile);
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};