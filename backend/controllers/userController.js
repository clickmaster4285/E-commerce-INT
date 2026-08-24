const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Store = require("../models/Store");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity, getChanges } = require("../utils/activityHelper");

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: `${process.env.JWT_ACCESS_TOKEN_EXPIREE_MINUTES || 60}m`,
  });
  const refreshToken = jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: `${process.env.JWT_REFRESH_TOKEN_EXPIREE_DAYS || 30}d`,
  });
  return { accessToken, refreshToken };
};

const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: false, 
  sameSite: "lax",
  maxAge,
});

// ==========================================
// REGISTER (Customer only)
// ==========================================
// ==========================================
// REGISTER (Customer only)
// ==========================================
const createUser = async (req, res) => {
  try {
    const { name, username, phone, email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing)
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultStore = await Store.findOne();
    const user = await User.create({
      name,
      username:
        username || email.split("@")[0] + Math.floor(Math.random() * 9999),
      phone,
      email,
      password: hashedPassword,
      storeId: defaultStore?._id,
      role: "user",
    });
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    res.cookie("accessToken", accessToken, getCookieOptions(60 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      getCookieOptions(30 * 24 * 60 * 60 * 1000),
    );
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
      },
    });
  } catch (error) {
    console.error("createUser error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 🛒 CUSTOMER LOGIN
// ==========================================
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Please provide email and password" });
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    if (user.role !== "user")
      return res
        .status(403)
        .json({
          success: false,
          message: "This login is only for customers. Please use admin panel.",
        });
    if (user.status === "inactive" || user.is_deleted)
      return res
        .status(403)
        .json({
          success: false,
          message: "Your account is inactive. Please contact administrator.",
        });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    const io = req.io || getIO();
    await pushGlobalActivity(
      io,
      {
        action: `${user.name} logged in`,
        category: "Authentication",
        performedBy: user._id,
        performedByName: user.name,
        details: { ip: req.ip },
      },
      user._id,
    );
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    res.cookie("accessToken", accessToken, getCookieOptions(60 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      getCookieOptions(30 * 24 * 60 * 60 * 1000),
    );
    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
      },
    });
  } catch (error) {
    console.error("loginUser error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 🛠️ ADMIN / STAFF LOGIN
// ==========================================
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Please provide email and password" });
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    if (!["admin", "staff", "manager"].includes(user.role))
      return res
        .status(403)
        .json({
          success: false,
          message: "Admin access denied. Please use customer login page.",
        });
    if (user.status === "inactive" || user.is_deleted)
      return res
        .status(403)
        .json({
          success: false,
          message: "Your account is inactive. Please contact administrator.",
        });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    const io = req.io || getIO();
    await pushGlobalActivity(
      io,
      {
        action: `${user.name} (${user.role}) logged in to admin panel`,
        category: "Authentication",
        performedBy: user._id,
        performedByName: user.name,
        details: { ip: req.ip, role: user.role },
      },
      user._id,
    );
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    res.cookie("accessToken", accessToken, getCookieOptions(60 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      getCookieOptions(30 * 24 * 60 * 60 * 1000),
    );
    res.json({
      success: true,
      message: "Admin login successful",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
      },
    });
  } catch (error) {
    console.error("loginAdmin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const refreshAccessToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "Refresh token required" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    const { accessToken } = generateTokens(decoded.userId, user.role);
    res.cookie("accessToken", accessToken, getCookieOptions(60 * 60 * 1000));
    res.json({ success: true, message: "Token refreshed" });
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
};

const logoutUser = async (req, res) => {
  try {
    if (req.user?._id) {
      const io = req.io || getIO();
      await pushGlobalActivity(
        io,
        {
          action: `${req.user.name || "User"} logged out`,
          category: "Authentication",
          performedBy: req.user._id,
          performedByName: req.user.name || "User",
        },
        req.user._id,
      );
    }
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ success: true, message: "Logged out successfully" });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("storeId");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("storeId");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        status: user.is_deleted ? "Inactive" : "Active",
        avatar: user.avatar || null,
        twoFactorEnabled: user.twoFactorEnabled || false,
        permissions: user.permissions || {
          products: true, brands: true, categories: true, 
          employees: true, discounts: true, profile: true, store: false
        },
        preferences: user.preferences || {
          darkMode: true,
          notifications: { email: true, push: true, weekly: true },
        },
        store: user.storeId || {},
      },
    });
  } catch (error) {
    console.error("getMe error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      status,
      store,
      permissions,
      preferences,
    } = req.body;
    const userId = req.user._id;
    await User.findByIdAndUpdate(userId, {
      name,
      email,
      phone,
      permissions,
      preferences,
      updatedby: userId,
    });
    if (store && req.user.storeId) {
      await Store.findByIdAndUpdate(req.user.storeId, {
        store_name: store.name,
        email: store.email,
        phone: store.phone,
        support_email: store.email,
        support_phone: store.phone,
        address: store.address,
      });
    }
    res.json({ success: true, message: "✅ Profile & Store saved!" });
  } catch (error) {
    console.error("updateProfile error:", error);
    res
      .status(500)
      .json({ success: false, message: "Save failed: " + error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid)
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect" });
    user.password = await bcrypt.hash(newPassword, 10);
    user.updatedby = req.user._id;
    await user.save();
    const io = req.io || getIO();
    await pushGlobalActivity(
      io,
      {
        action: `${user.name} changed password`,
        category: "Authentication",
        performedBy: user._id,
        performedByName: user.name,
      },
      user._id,
    );
    res.json({ success: true, message: "✅ Password changed successfully!" });
  } catch (error) {
    console.error("changePassword error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggle2FA = async (req, res) => {
  try {
    const { enabled } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      twoFactorEnabled: enabled,
      updatedby: req.user._id,
    });
    res.json({ success: true, message: "✅ 2FA setting updated!" });
  } catch (error) {
    console.error("toggle2FA error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getProfileInfo = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || userId === "guest")
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const user = await User.findById(userId)
      .select("-password")
      .populate("storeId");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    const store = user.storeId || {};
    const profileData = {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email || store.email || "",
      phone: user.phone || store.phone || "",
      role: user.role,
      status: user.status || (user.is_deleted ? "Inactive" : "Active"),
      avatar: user.avatar || null,
      created_at: user.created_at,
      website: user.website || store.website || "",
      address: user.address || store.address || "",
      twoFactorEnabled: user.twoFactorEnabled || false,
      permissions: user.permissions || {
        products: true, brands: true, categories: true, 
        employees: true, discounts: true, profile: true, store: false
      },
      preferences: user.preferences || {
        darkMode: true,
        notifications: { email: true, push: true, weekly: true },
      },
      store,
      store_name: store.store_name || "",
      primary_color: store.primary_color || "#10b981",
      stats: {
        logins: user.loginCount || 0,
        roles: 1,
        sessions: user.sessionCount || 0,
      },
    };
    return res.json({ success: true, data: profileData, user: profileData });
  } catch (error) {
    console.error("❌ Get Profile Info Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateProfileInfo = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || userId === "guest")
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const {
      name, email, phone, website, address,
      store_name, tagline, primary_color, currency, country, city, state, zip_code, store_status
    } = req.body;
    const userUpdateFields = {};
    if (name !== undefined) userUpdateFields.name = name;
    if (email !== undefined)
      userUpdateFields.email = email.toLowerCase().trim();
    if (phone !== undefined) userUpdateFields.phone = phone;
    if (website !== undefined) userUpdateFields.website = website;
    if (address !== undefined) userUpdateFields.address = address;
    userUpdateFields.updatedby = userId;
    const updatedUser = await User.findByIdAndUpdate(userId, userUpdateFields, {
      new: true,
      runValidators: true,
    })
      .select("-password")
      .populate("storeId");
    if (!updatedUser)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    let updatedStore = null;
    const storeUpdateFields = {};
    if (store_name !== undefined) storeUpdateFields.store_name = store_name;
    if (tagline !== undefined) storeUpdateFields.tagline = tagline;
    if (primary_color !== undefined)
      storeUpdateFields.primary_color = primary_color;
    if (currency !== undefined) storeUpdateFields.currency = currency;
    if (country !== undefined) storeUpdateFields.country = country;
    if (city !== undefined) storeUpdateFields.city = city;
    if (state !== undefined) storeUpdateFields.state = state;
    if (zip_code !== undefined) storeUpdateFields.zip_code = zip_code;
    if (store_status !== undefined)
      storeUpdateFields.store_status = store_status;
    if (email !== undefined) storeUpdateFields.email = email;
    if (phone !== undefined) storeUpdateFields.phone = phone;
    if (address !== undefined) storeUpdateFields.address = address;
    if (website !== undefined) storeUpdateFields.website = website;
    if (Object.keys(storeUpdateFields).length > 0) {
      let store = updatedUser.storeId
        ? await Store.findById(updatedUser.storeId)
        : null;
      if (!store) store = await Store.findOne();
      if (!store) store = await Store.create({});
      
      Object.assign(store, storeUpdateFields);
      updatedStore = await store.save();
      
      if (!updatedUser.storeId && updatedStore) {
        updatedUser.storeId = updatedStore._id;
        await updatedUser.save();
      }
      await updatedUser.populate("storeId");
    }
    return res.json({
      success: true,
      message: "Profile updated successfully",
      store: updatedStore || updatedUser.storeId || null,
      storeUpdated: !!updatedStore,
    });
  } catch (error) {
    console.error("❌ Update Profile Info Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const changePasswordSocket = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || userId === "guest")
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ success: false, message: "All password fields are required" });
    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid)
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect" });
    user.password = await bcrypt.hash(newPassword, 10);
    user.updatedby = userId;
    await user.save();
    return res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("❌ Change Password Socket Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ message: "Google credential missing" });
    const payload = JSON.parse(
      Buffer.from(credential.split(".")[1], "base64").toString(),
    );
    const { email, name, picture } = payload;
    if (!email)
      return res
        .status(400)
        .json({ message: "Google account mein email nahi mili" });
    let user = await User.findOne({ email });
    if (!user) {
      // ✅ SECURITY FIX: Naye Google users ko direct access NAHI milega
      return res.status(403).json({ 
        success: false, 
        message: "Access Denied. Your email is not registered as Staff/Admin. Please contact administrator." 
      });
    }

    // ✅ EXISTING USER ROLE CHECK
    if (!["admin", "staff", "manager"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only administrators, managers and staff members can log in.",
      });
    } else {
      if (user.role !== "user")
        return res
          .status(403)
          .json({ message: "Admin/Staff cannot use customer Google login." });
      if (!user.avatar && picture) {
        user.avatar = picture;
        await user.save();
      }
    }
    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: `${process.env.JWT_ACCESS_TOKEN_EXPIREE_MINUTES || 10}m` },
    );
    const refreshToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: `${process.env.JWT_REFRESH_TOKEN_EXPIREE_DAYS || 30}d` },
    );
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge:
        Number(process.env.JWT_ACCESS_TOKEN_EXPIREE_MINUTES || 10) * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge:
        Number(process.env.JWT_REFRESH_TOKEN_EXPIREE_DAYS || 30) *
        24 *
        60 *
        60 *
        1000,
    });
    return res.json({
      success: true,
      message: "Google login successful",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Google login failed", error: error.message });
  }
};

const updatePhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^[0-9+\-\s]{7,20}$/.test(String(phone)))
      return res.status(400).json({ message: "Valid phone number required" });
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.phone = String(phone).trim();
    await user.save();
    res
      .status(200)
      .json({ message: "Phone updated successfully", phone: user.phone });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



;

// ==========================================
// ✅ GET WISHLIST (populated products)
// ==========================================
const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("wishlist");
    res.json({ success: true, wishlist: user?.wishlist || [] });
  } catch (error) {
    console.error("getWishlist error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ✅ TOGGLE WISHLIST (add / remove)
// ==========================================
const toggleWishlist = async (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) {
      return res
        .status(400)
        .json({ success: false, message: "Product ID required" });
    }
    const user = await User.findById(req.user._id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const idx = user.wishlist.findIndex(
      (id) => id.toString() === product_id.toString(),
    );
    let added;
    if (idx >= 0) {
      user.wishlist.splice(idx, 1);
      added = false;
    } else {
      user.wishlist.push(product_id);
      added = true;
    }
    await user.save();

    res.json({ success: true, added, count: user.wishlist.length });
  } catch (error) {
    console.error("toggleWishlist error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// ==========================================
// ✅ CREATE CHECKOUT DRAFT (new)
// ==========================================
const createCheckoutDraft = async (req, res) => {
  try {
    const {
      step,
      selectedKeys,
      selectedAddressId,
      shippingMethod,
      paymentMethod,
      items,
    } = req.body;

    const newDraft = {
      step: step ?? 1,
      selectedKeys: Array.isArray(selectedKeys) ? selectedKeys : [],
      selectedAddressId: selectedAddressId || null,
      shippingMethod: shippingMethod || "standard",
      paymentMethod: paymentMethod || "cod",
      saved: false,
      items: Array.isArray(items) ? items : [],
      updatedAt: new Date(),
    };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { checkout_drafts: newDraft } },
      { new: true },
    ).select("checkout_drafts");

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const createdDraft =
      user.checkout_drafts[user.checkout_drafts.length - 1];
    res.status(201).json({ success: true, draft: createdDraft });
  } catch (error) {
    console.error("createCheckoutDraft error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ✅ GET ALL CHECKOUT DRAFTS
// ==========================================
const getCheckoutDrafts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("checkout_drafts");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    const drafts = user.checkout_drafts || [];
    res.json({ success: true, drafts });
  } catch (error) {
    console.error("getCheckoutDrafts error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ✅ GET SINGLE CHECKOUT DRAFT BY ID
// ==========================================
const getCheckoutDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user._id).select("checkout_drafts");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const draft = user.checkout_drafts.find(
      (d) => d._id.toString() === id,
    );
    if (!draft)
      return res
        .status(404)
        .json({ success: false, message: "Draft not found" });

    res.json({ success: true, draft });
  } catch (error) {
    console.error("getCheckoutDraft error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ✅ UPDATE SINGLE CHECKOUT DRAFT BY ID
// ==========================================
const updateCheckoutDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      step,
      selectedKeys,
      selectedAddressId,
      shippingMethod,
      paymentMethod,
      saved,
      items,
    } = req.body;

    const user = await User.findOneAndUpdate(
      { _id: req.user._id, "checkout_drafts._id": id },
      {
        $set: {
          "checkout_drafts.$.step": step ?? 1,
          "checkout_drafts.$.selectedKeys": Array.isArray(selectedKeys)
            ? selectedKeys
            : [],
          "checkout_drafts.$.selectedAddressId": selectedAddressId || null,
          "checkout_drafts.$.shippingMethod": shippingMethod || "standard",
          "checkout_drafts.$.paymentMethod": paymentMethod || "cod",
          "checkout_drafts.$.saved": saved ?? false,
          "checkout_drafts.$.items": Array.isArray(items) ? items : [],
          "checkout_drafts.$.updatedAt": new Date(),
        },
      },
      { new: true },
    ).select("checkout_drafts");

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User or Draft not found" });

    const draft = user.checkout_drafts.find(
      (d) => d._id.toString() === id,
    );
    res.json({ success: true, draft });
  } catch (error) {
    console.error("updateCheckoutDraft error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ✅ DELETE SINGLE CHECKOUT DRAFT BY ID
// ==========================================
const deleteCheckoutDraft = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { checkout_drafts: { _id: id } } },
      { new: true },
    ).select("checkout_drafts");

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.json({ success: true, message: "Draft deleted" });
  } catch (error) {
    console.error("deleteCheckoutDraft error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createUser,
  loginUser,
  loginAdmin,
  refreshAccessToken,
  logoutUser,
  getProfile,
  getMe,
  updateProfile,
  changePassword,
  toggle2FA,
  getProfileInfo,
  updateProfileInfo,
  changePasswordSocket,
  googleLogin,
  updatePhone,
  createCheckoutDraft,
  getCheckoutDrafts,
  getCheckoutDraft,
  updateCheckoutDraft,
  deleteCheckoutDraft,
  getWishlist,
  toggleWishlist,
};