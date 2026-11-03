const Banner = require("../models/Banner");
const fs = require("fs");
const path = require("path");
const { getIO } = require("../utils/socket");
const { queueTranslationSync } = require("../utils/translationService");

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

// ==========================================
// 🌐 LOCALE + TRANSLATION HELPERS
// getBrandById / getBrandsAdmin ka exact pattern: sirf selected locale ki
// translation return karo, poori translations map nahi.
// ==========================================
const parseLocale = (value) => {
  const requestedLocale = String(value || "en").trim().toLowerCase();
  return /^[a-z]{2}$/.test(requestedLocale) ? requestedLocale : "en";
};

// ✅ Selected locale ki slim translation object (brand paginated response jaisa).
const slimBannerTranslations = (banner, locale) => {
  if (locale === "en" || !banner.translations) return null;
  const out = {};
  ["title", "eyebrow", "heading", "description", "altText"].forEach((field) => {
    const value = banner.translations?.[field]?.[locale];
    if (typeof value === "string" && value.trim()) out[field] = { [locale]: value };
  });
  const primaryText = banner.translations?.primaryButton?.[locale];
  if (typeof primaryText === "string" && primaryText.trim()) {
    out.primaryButton = { text: { [locale]: primaryText } };
  }
  const secondaryText = banner.translations?.secondaryButton?.[locale];
  if (typeof secondaryText === "string" && secondaryText.trim()) {
    out.secondaryButton = { text: { [locale]: secondaryText } };
  }
  return Object.keys(out).length ? out : {};
};

// ✅ List/detail rows me sirf wahi fields jate hain jo front par dikhti/edit hoti
// hain (table + grid + edit modal). createdby/updatedby/createdAt/updatedAt/__v/
// storeId/translation_source/translation_status list payload se bahar — bilkul
// brand admin list jaisa "no extra data" response.
const frontBannerFields = (banner) => ({
  _id: banner._id,
  title: banner.title,
  bannerType: banner.bannerType,
  status: banner.status,
  position: banner.position,
  startDate: banner.startDate || null,
  endDate: banner.endDate || null,
  desktopImage: banner.desktopImage || null,
  ...(banner.tabletImage && { tabletImage: banner.tabletImage }),
  ...(banner.mobileImage && { mobileImage: banner.mobileImage }),
  ...(banner.altText && { altText: banner.altText }),
  ...(banner.backgroundColor && { backgroundColor: banner.backgroundColor }),
  ...(banner.eyebrow && { eyebrow: banner.eyebrow }),
  ...(banner.heading && { heading: banner.heading }),
  ...(banner.description && { description: banner.description }),
  ...(banner.primaryButton && Object.keys(banner.primaryButton).length > 0 && { primaryButton: banner.primaryButton }),
  ...(banner.secondaryButton?.text && { secondaryButton: banner.secondaryButton }),
  ...(Array.isArray(banner.displayRules) && banner.displayRules.length > 0 && { displayRules: banner.displayRules }),
  ...(banner.autoPublish !== undefined && { autoPublish: banner.autoPublish }),
  ...(banner.linkedDealId && { linkedDealId: banner.linkedDealId }),
});

// ==========================================
// 🛡️ GET BANNER BY ID — ADMIN (slim, locale-aware)
// getBrandById ka pattern: populate sirf display/audit info ke liye, response me
// sirf front + audit fields, aur translations sirf selected locale ki.
// ==========================================
exports.getBanner = async (req, res) => {
  try {
    const locale = parseLocale(req.query.locale);
    const banner = await Banner.findById(req.params.id)
      .select("title translations bannerType status position startDate endDate eyebrow heading description altText backgroundColor primaryButton secondaryButton displayRules autoPublish linkedDealId desktopImage tabletImage mobileImage createdAt updatedAt createdby updatedby")
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .lean();
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });

    const responseBanner = {
      ...frontBannerFields(banner),
      createdAt: banner.createdAt,
      createdby: banner.createdby ? { _id: banner.createdby._id, name: banner.createdby.name, email: banner.createdby.email } : null,
      updatedAt: banner.updatedAt,
      updatedby: banner.updatedby ? { _id: banner.updatedby._id, name: banner.updatedby.name, email: banner.updatedby.email } : null,
    };
    const translations = slimBannerTranslations(banner, locale);
    if (translations) responseBanner.translations = translations;

    res.status(200).json({ success: true, data: responseBanner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Server-side sorting whitelist — frontend sort key -> DB field
// (brandController.BRAND_SORT_FIELDS ka exact pattern)
const BANNER_SORT_FIELDS = {
  title: "title",
  bannerType: "bannerType",
  status: "status",
  position: "position",
  created: "createdAt",
};

// ✅ Search string ko safe regex banane ke liye (special chars se crash na ho)
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ==========================================
// 🛡️ GET ALL BANNERS — ADMIN / STOREFRONT
// getBrandsAdmin ka exact pattern:
// - page + limit => SERVER SIDE PAGINATION: counts + bannerTypes meta ke saath,
//   aur har item sirf FRONT fields rakhta hai (createdby/updatedby/timestamps/
//   __v/translation_* list payload me leak nahi hote).
// - limit na ho (0) => legacy full-list response (storefront GUI isi par depend).
// ==========================================
exports.getAllBanners = async (req, res) => {
  try {
    const { status, bannerType, page = 1, limit = 0, search } = req.query; // 0 = legacy mode
    const limitRaw = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 0;

    const buildFilter = () => {
      const filter = {};
      if (status) filter.status = status;
      if (bannerType) filter.bannerType = bannerType;
      if (search) filter.title = { $regex: escapeRegex(String(search).trim()), $options: "i" };
      return filter;
    };

    // ---- LEGACY MODE (no limit) -> exact old behavior ----
    if (!limitRaw) {
      const banners = await Banner.find(buildFilter())
        .populate("createdby", "name email")
        .populate("updatedby", "name email")
        .sort({ position: 1, createdAt: -1 })
        .lean();
      return res.status(200).json({ success: true, data: banners });
    }

    // ---- SERVER SIDE PAGINATION (brand admin list ka exact pattern) ----
    const requestedPage = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, limitRaw));

    const locale = parseLocale(req.query.locale);

    // ✅ Sorting bhi server par hoti hai (whitelist ke ilawa koi custom field nahi)
    const sortKeyRaw = String(req.query.sort || "").trim();
    const hasSort = Boolean(BANNER_SORT_FIELDS[sortKeyRaw]);
    const sortField = hasSort ? BANNER_SORT_FIELDS[sortKeyRaw] : "position";
    const rawOrder = String(req.query.order || "").trim().toLowerCase();
    // Default: position asc (banner preset / storefront ordering — legacy jaisa)
    const sortOrder = hasSort ? (rawOrder === "desc" ? -1 : 1) : 1;

    const total = await Banner.countDocuments(buildFilter());
    const pages = Math.max(1, Math.ceil(total / limitNum));
    const safePage = Math.min(requestedPage, pages);

    const [banners, totalBanners, activeBanners, inactiveBanners, scheduledBanners, expiredBanners, draftBanners, typeList, positionList] =
      await Promise.all([
        Banner.find(buildFilter())
          .sort({ [sortField]: sortOrder, _id: 1 })
          .skip((safePage - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        Banner.countDocuments({}),
        Banner.countDocuments({ status: "active" }),
        Banner.countDocuments({ status: "inactive" }),
        Banner.countDocuments({ status: "scheduled" }),
        Banner.countDocuments({ status: "expired" }),
        Banner.countDocuments({ status: "draft" }),
        Banner.distinct("bannerType"),
        Banner.distinct("position"),
      ]);

    // Har row sirf front-visible fields — edit modal ki form fields + list columns
    // (bilkul wahi shape jo brand paginated response rakhta hai).
    const pageBanners = banners.map((banner) => {
      const item = frontBannerFields(banner);
      const translations = slimBannerTranslations(banner, locale);
      if (translations) item.translations = translations;
      return item;
    });

    res.status(200).json({
      success: true,
      data: pageBanners,
      counts: {
        total: totalBanners,
        active: activeBanners,
        inactive: inactiveBanners,
        scheduled: scheduledBanners,
        expired: expiredBanners,
        draft: draftBanners,
      },
      bannerTypes: (typeList || [])
        .filter(Boolean)
        .map((b) => String(b))
        .sort((a, b) => a.localeCompare(b)),
      // ✅ Used positions (poori collection ki) — duplicate position check aur
      // "next free position" sirf current page par depend na kare
      positions: (positionList || [])
        .filter((p) => Number.isFinite(p))
        .sort((a, b) => a - b),
      pagination: {
        total,
        page: safePage,
        limit: limitNum,
        pages,
        hasNext: safePage < pages,
        hasPrev: safePage > 1,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getActiveBanners = async (req, res) => {
  try {
    const now = new Date();
    // ✅ Optional ?limit= (user cap 50) — na bhejo to purana full-array response
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 0;
    const query = Banner.find({
      status: "active",
      $or: [{ startDate: null }, { startDate: { $lte: now } }],
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    }).sort({ position: 1 });
    if (limit) query.limit(limit);
    const banners = await query.lean();
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

    // Position validation: must be positive integer
    const position = parseInt(data.position, 10);
    if (!Number.isFinite(position) || position < 1) {
      return res.status(400).json({ success: false, message: "Position must be a positive whole number (1 or greater)" });
    }
    data.position = position;

    // Duplicate position check
    const existingBanner = await Banner.findOne({ position }).lean();
    if (existingBanner) {
      return res.status(400).json({ success: false, message: `Position ${position} is already used by "${existingBanner.title}". Please choose another position.` });
    }

    if (data.autoPublish && data.startDate) {
      data.status = new Date(data.startDate) > new Date() ? "scheduled" : "active";
    }

    data.createdby = req.user?._id || null;
    data.updatedby = req.user?._id || null;

    const banner = await Banner.create(data);
    queueTranslationSync(Banner, banner._id);

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

    // FIX: Multipart mein koi field 2 baar append ho to uska array ban jata hai
    // (e.g. status -> ["active","active"]). Mongoose String path par array cast
    // fail hone se edit crash hoti tha — last value rakh lo.
    Object.keys(data).forEach((k) => {
      if (Array.isArray(data[k])) data[k] = data[k][data[k].length - 1];
    });

    // Never allow overwriting createdby during update
    delete data.createdby;
    delete data._id;
    delete data.__v;
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

    // Position validation: must be positive integer
    if (data.position !== undefined) {
      const position = parseInt(data.position, 10);
      if (!Number.isFinite(position) || position < 1) {
        return res.status(400).json({ success: false, message: "Position must be a positive whole number (1 or greater)" });
      }
      data.position = position;

      // Duplicate position check (exclude current banner)
      const existingBanner = await Banner.findOne({ position, _id: { $ne: req.params.id } }).lean();
      if (existingBanner) {
        return res.status(400).json({ success: false, message: `Position ${position} is already used by "${existingBanner.title}". Please choose another position.` });
      }
    }

    data.updatedby = req.user?._id || null;

    const updated = await Banner.findByIdAndUpdate(req.params.id, data, { new: true })
      .populate("createdby", "name email")
      .populate("updatedby", "name email");
    queueTranslationSync(Banner, updated._id);

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

    // Assign next available position
    const allPositions = await Banner.distinct("position");
    const usedPositions = new Set(allPositions.filter((p) => Number.isInteger(p) && p >= 1));
    let nextPos = 1;
    while (usedPositions.has(nextPos)) nextPos++;
    copy.position = nextPos;

    copy.createdby = req.user?._id || null;
    copy.updatedby = req.user?._id || null;
    const newBanner = await Banner.create(copy);
    queueTranslationSync(Banner, newBanner._id);

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