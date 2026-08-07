const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ==========================================
// 1. USER LOGIN (Sets HttpOnly Cookies)
// ==========================================
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // ✅ 1. Access Token (10 Minutes)
    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1m" }
    );

    // ✅ 2. Refresh Token (30 Days / 1 Month)
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // ✅ 3. HttpOnly Cookies Set karna (Secure & SameSite)
    res.cookie("accessToken", accessToken, {
      httpOnly: true, // JavaScript isay access nahi kar sakti
      secure: process.env.NODE_ENV === "production", // Production mein true, local mein false
      sameSite: "lax", // CSRF protection
      maxAge: 1 * 60 * 1000, // 10 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(200).json({
      message: "Login successful",
      user: { 
        id: user._id, 
        name: user.name, 
        username: user.username, 
        email: user.email, 
        role: user.role 
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// 2. REFRESH TOKEN (Silent Refresh ke liye)
// ==========================================
const refreshAccessToken = async (req, res) => {
  try {
    // Cookie se refresh token nikalo
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token missing" });
    }

    // Token verify karo
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Naya Access Token generate karo
    const newAccessToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1m" }
    );

    // Naya Access Token cookie mein set karo
    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1 * 60 * 1000,
    });

    res.status(200).json({ message: "Token refreshed successfully" });
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};

// ==========================================
// 3. LOGOUT (Cookies Clear karna)
// ==========================================
const logoutUser = (req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.status(200).json({ message: "Logged out successfully" });
};

// ==========================================
// 4. GET PROFILE
// ==========================================
const getProfile = async (req, res) => {
  res.status(200).json({ 
    message: "Profile accessed successfully", 
    user: req.user 
  });
};

// ==========================================
// 5. REGISTER USER (Existing logic)
// ==========================================
const createUser = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({ message: "Email or username already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, username, email, password: hashedPassword });
    
    res.status(201).json({
      message: "User created successfully",
      user: { id: user._id, name: user.name, username: user.username, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  createUser, 
  loginUser, 
  refreshAccessToken, 
  logoutUser, 
  getProfile 
};