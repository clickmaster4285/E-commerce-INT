const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// 1. User Register karna
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

// 2. User Login karna (Role ke sath)
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

    // Token mein role add kiya
    const jwtLoginToken = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: "7d" }
    );

    // Response mein role add kiya
    res.status(200).json({
      message: "Login successful",
      jwtLoginToken,
      role: user.role,
      user: { id: user._id, name: user.name, username: user.username, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Profile get karna (Ye wala function missing tha, isliye error aa raha tha)
const getProfile = async (req, res) => {
  res.status(200).json({ 
    message: "Profile accessed successfully", 
    user: req.user 
  });
};

// SAB SE ZAROORI LINE: Teeno functions ko export karna
module.exports = { createUser, loginUser, getProfile };