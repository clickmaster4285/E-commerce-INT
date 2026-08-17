const Store = require("../models/Store");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity, getChanges } = require("../utils/activityHelper");

// @desc    Get Store Info
const getStoreInfo = async (req, res) => {
  try {
    let store = await Store.findOne();
    if (!store) store = await Store.create({});
    res.status(200).json({ success: true, data: store.toObject() });
  } catch (error) {
    console.error("Get Store Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Store Info
const updateStoreInfo = async (req, res) => {
  try {
    // ✅ CHECK STORE PERMISSION
    if (req.user.role !== "admin" && !req.user.permissions?.store) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You don't have permission to edit store settings. Please contact an administrator or another staff member to grant you store access.",
      });
    }

    let store = await Store.findOne();
    if (!store) store = await Store.create({});

    const oldData = store.toObject();

    const {
      store_name, tagline, email, phone,
      support_email, support_phone,
      country, state, city, zip_code, address,
      currency, tax_rate, weight_unit,
      business_type, total_employees, year_established,
      store_status, maintenance_message,
      primary_color,
      meta_title, meta_description, meta_keywords,
      return_policy, privacy_policy, terms_conditions,
      social_links,
    } = req.body;

    if (store_name !== undefined) store.store_name = store_name;
    if (tagline !== undefined) store.tagline = tagline;
    if (email !== undefined) store.email = email;
    if (phone !== undefined) store.phone = phone;
    if (support_email !== undefined) store.support_email = support_email;
    if (support_phone !== undefined) store.support_phone = support_phone;
    if (country !== undefined) store.country = country;
    if (state !== undefined) store.state = state;
    if (city !== undefined) store.city = city;
    if (zip_code !== undefined) store.zip_code = zip_code;
    if (address !== undefined) store.address = address;
    if (currency !== undefined) store.currency = currency;
    if (tax_rate !== undefined) store.tax_rate = Number(tax_rate) || 0;
    if (weight_unit !== undefined) store.weight_unit = weight_unit;
    if (business_type !== undefined) store.business_type = business_type;
    if (total_employees !== undefined) store.total_employees = total_employees;
    if (year_established !== undefined) store.year_established = year_established;
    if (store_status !== undefined) store.store_status = store_status;
    if (maintenance_message !== undefined) store.maintenance_message = maintenance_message;
    if (primary_color !== undefined) store.primary_color = primary_color;
    if (meta_title !== undefined) store.meta_title = meta_title;
    if (meta_description !== undefined) store.meta_description = meta_description;
    if (meta_keywords !== undefined) store.meta_keywords = meta_keywords;
    if (return_policy !== undefined) store.return_policy = return_policy;
    if (privacy_policy !== undefined) store.privacy_policy = privacy_policy;
    if (terms_conditions !== undefined) store.terms_conditions = terms_conditions;

    if (social_links) {
      store.social_links = typeof social_links === "string" ? JSON.parse(social_links) : social_links;
    }

    let logoChanged = false;
    if (req.file) {
      const relativePath = req.file.relativePath || `uploads/store/${req.file.filename}`;
      const cleanPath = relativePath.includes("/uploads/")
        ? relativePath.substring(relativePath.indexOf("uploads/"))
        : relativePath;

      store.logo = { img_url: cleanPath, public_id: req.file.filename };
      logoChanged = true;
    }

    const updatedStore = await store.save();

    // ✅ LOG ACTIVITY
    const trackedFields = ["store_name", "tagline", "email", "phone", "address", "currency", "store_status", "primary_color"];
    const changes = getChanges(oldData, updatedStore.toObject(), trackedFields);
    if (logoChanged) changes.push({ field: "logo", oldValue: "(old)", newValue: "(new)" });

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const io = req.io || getIO();

    if (changes.length > 0) {
        const changedFields = changes.map((c) => c.field).join(", ");
        await pushGlobalActivity(io, {
            action: `${performerName} updated ${changedFields} for Store`,
            category: "Store Management",
            performedBy: performerId,
            performedByName: performerName,
            details: { changes },
        }, performerId);
    }

    res.status(200).json({
      success: true,
      data: updatedStore.toObject(),
      message: "Store updated successfully",
    });
  } catch (error) {
    console.error("Update Store Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getStoreInfo, updateStoreInfo };