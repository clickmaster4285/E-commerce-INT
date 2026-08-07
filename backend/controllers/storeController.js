const Store = require("../models/Store");

// @desc    Get Store Info
// @route   GET /api/store
// @access  Private (Requires Token)
const getStoreInfo = async (req, res) => {
  try {
    // Database mein sirf ek hi store document hoga (Singleton pattern)
    let store = await Store.findOne();
    
    // Agar pehli baar chal raha hai aur store empty hai, toh ek default bana dein
    if (!store) {
      store = await Store.create({});
    }

    res.status(200).json({ success: true, data: store });
  } catch (error) {
    console.error("Get Store Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Store Info
// @route   PUT /api/store
// @access  Private (Admin Only)
const updateStoreInfo = async (req, res) => {
  try {
    // Check if user is admin (aapke authMiddleware ne req.user bhar diya hai)
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Not authorized as admin" });
    }

    let store = await Store.findOne();
    if (!store) {
      store = await Store.create({});
    }

    // Form Data se values nikalna
    const {
      store_name, tagline, email, phone, support_email, support_phone,
      country, state, city, zip_code, address,
      currency, tax_rate, weight_unit, store_status, maintenance_message,
      primary_color, meta_title, meta_description, meta_keywords,
      return_policy, privacy_policy, terms_conditions, social_links
    } = req.body;

    // Update fields (Sirf tab update karega jab frontend se value aayi ho)
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
    if (tax_rate !== undefined) store.tax_rate = Number(tax_rate);
    if (weight_unit !== undefined) store.weight_unit = weight_unit;
    if (store_status !== undefined) store.store_status = store_status;
    if (maintenance_message !== undefined) store.maintenance_message = maintenance_message;
    if (primary_color !== undefined) store.primary_color = primary_color;
    if (meta_title !== undefined) store.meta_title = meta_title;
    if (meta_description !== undefined) store.meta_description = meta_description;
    if (meta_keywords !== undefined) store.meta_keywords = meta_keywords;
    if (return_policy !== undefined) store.return_policy = return_policy;
    if (privacy_policy !== undefined) store.privacy_policy = privacy_policy;
    if (terms_conditions !== undefined) store.terms_conditions = terms_conditions;

    // Social links JSON string ko wapis object mein convert karna
    if (social_links) {
      store.social_links = typeof social_links === 'string' ? JSON.parse(social_links) : social_links;
    }

    // ✅ FIXED: Logo Upload Logic (Crash hone se bachaya gaya hai)
    if (req.file) {
      // Agar logo object pehle se nahi hai toh usay initialize karein
      if (!store.logo) {
        store.logo = {};
      }
      
      // File ka path set karein (Multer disk storage use kar rahe hain toh req.file.path ya filename)
      // Note: Frontend par image dikhane ke liye aapko backend mein static folder serve karna hoga
      store.logo.img_url = req.file.path.replace(/\\/g, '/'); // Windows paths ko fix karne ke liye
      store.logo.public_id = req.file.filename;
    }

    const updatedStore = await store.save();

    // Optional: Socket.io se emit kar dein taake frontend real-time update ho jaye
    // if (req.app.get('io')) {
    //   req.app.get('io').emit("storeUpdated", updatedStore); 
    // }

    res.status(200).json({ 
      success: true, 
      data: updatedStore, 
      message: "Store updated successfully" 
    });
  } catch (error) {
    console.error("Update Store Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getStoreInfo, updateStoreInfo };