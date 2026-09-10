const Banner = require("../models/Banner");
const fs = require("fs");
const path = require("path");
const { getIO } = require("../utils/socket");

const emitSocketEvent = (event, data) => {
  try {
    const io = getIO();
    if (io) io.emit(event, data);
  } catch (_) {}
};

const deleteFile = (filePath) => {
  if (!filePath) return;
  const fullPath = path.join(__dirname, "..", filePath);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
};

// ✅ FIXED: Yeh function pehle missing tha, ab add kar diya gaya hai
exports.getBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id)
      .populate("primaryButton.dealId", "name isActive startDate endDate")
      .populate("secondaryButton.dealId", "name isActive startDate endDate");
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
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
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

    data.createdby = req.user?._id || null;
    data.updatedby = req.user?._id || null;

    const banner = await Banner.create(data);

    emitSocketEvent("banner:created", { success: true, data: banner });
    emitSocketEvent("bannerCreated", { success: true, data: banner });

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

    data.updatedby = req.user?._id || null;

    const updated = await Banner.findByIdAndUpdate(req.params.id, data, { new: true })
      .populate("createdby", "name email")
      .populate("updatedby", "name email");

    emitSocketEvent("banner:updated", { success: true, data: updated });
    emitSocketEvent("bannerUpdated", { success: true, data: updated });

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
    banner.updatedby = req.user?._id || null;
    await banner.save();

    emitSocketEvent("banner:updated", { success: true, data: banner });
    emitSocketEvent("bannerToggled", { success: true, data: banner });

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
    copy.createdby = req.user?._id || null;
    copy.updatedby = req.user?._id || null;
    const newBanner = await Banner.create(copy);

    emitSocketEvent("banner:created", { success: true, data: newBanner });
    emitSocketEvent("bannerCreated", { success: true, data: newBanner });

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

    emitSocketEvent("banner:deleted", { success: true, data: { id: req.params.id } });
    emitSocketEvent("bannerDeleted", { success: true, data: { id: req.params.id } });

    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};