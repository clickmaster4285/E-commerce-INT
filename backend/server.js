require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const User = require("./models/User");
const Store = require("./models/Store");
const { initSocket } = require("./utils/socket");

// Routes
const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const variantRoutes = require("./routes/variantRoutes");
const storeRoutes = require("./routes/storeRoutes");
const employeeRoutes = require("./routes/employeeRoutes");

const app = express();
const server = http.createServer(app);

// ==========================================
// CONSTANTS
// ==========================================
const PORT = process.env.PORT;
const CLIENT_URL = process.env.CLIENT_URL;
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS);

if (!CLIENT_URL) {
  console.error("❌ CRITICAL: CLIENT_URL is missing in .env file!");
}

// ==========================================
// CORS CONFIGURATION
// ==========================================
const buildAllowedOrigins = () => {
  const origins = new Set();
  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");
  if (CLIENT_URL) origins.add(CLIENT_URL);
  return Array.from(origins).filter(Boolean);
};

const allowedOrigins = buildAllowedOrigins();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/^http:\/\/192\.168\.\d+\.\d+:3000$/.test(origin)) return callback(null, true);
    if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());

app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: "7d",
  etag: true,
}));

// Socket initialize
const io = initSocket(server);

// Attach io to every request for controller-level broadcasting
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ==========================================
// ROUTES
// ==========================================
app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/variants", variantRoutes);
app.use("/api/store", storeRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/addresses", require("./routes/addressRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.get("/", (req, res) => {
  res.send("Backend server is running 🚀");
});

// ==========================================
// STORE + ADMIN SEEDING
// ==========================================
const seedDefaultData = async () => {
  try {
    const storeName = process.env.DEFAULT_STORE_NAME;
    if (!storeName) return;

    let defaultStore = await Store.findOne({ store_name: storeName });
    if (!defaultStore) {
      defaultStore = await Store.create({
        store_name: storeName,
        tagline: process.env.DEFAULT_STORE_TAGLINE,
        email: process.env.DEFAULT_STORE_EMAIL,
        phone: process.env.DEFAULT_STORE_PHONE,
        support_email: process.env.DEFAULT_STORE_SUPPORT_EMAIL,
        support_phone: process.env.DEFAULT_STORE_SUPPORT_PHONE,
        country: process.env.DEFAULT_STORE_COUNTRY,
        state: process.env.DEFAULT_STORE_STATE,
        city: process.env.DEFAULT_STORE_CITY,
        zip_code: process.env.DEFAULT_STORE_ZIP_CODE,
        address: process.env.DEFAULT_STORE_ADDRESS,
        currency: process.env.DEFAULT_STORE_CURRENCY,
        tax_rate: Number(process.env.DEFAULT_STORE_TAX_RATE) || 0,
        weight_unit: process.env.DEFAULT_STORE_WEIGHT_UNIT,
        store_status: process.env.DEFAULT_STORE_STATUS,
        primary_color: process.env.DEFAULT_STORE_PRIMARY_COLOR,
      });
      console.log("✅ Default store seeded:", storeName);
    }

    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    const adminUsername = process.env.DEFAULT_ADMIN_USERNAME;
    const adminName = process.env.DEFAULT_ADMIN_NAME;

    if (!adminEmail || !adminPassword) return;

    let admin = await User.findOne({
      $or: [{ email: adminEmail }, { username: adminUsername }],
    });

    if (!admin) {
      const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);
      admin = await User.create({
        name: adminName,
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        role: "admin",
        storeId: defaultStore._id,
      });
      console.log("✅ Default admin seeded:", adminEmail);
    } else {
      let updated = false;
      if (!admin.storeId) { admin.storeId = defaultStore._id; updated = true; }
      if (admin.role !== "admin") { admin.role = "admin"; updated = true; }
      if (updated) {
        await admin.save();
        console.log("🔄 Admin updated with storeId & role");
      }
    }
  } catch (err) {
    console.error("❌ Seed Error:", err.message);
    throw err;
  }
};

// ==========================================
// 🚀 SERVER STARTUP
// ==========================================
const startServer = async () => {
  try {
    await connectDB();

    // Ensure upload directories exist
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const storeUploadDir = path.join(uploadDir, "store");
    if (!fs.existsSync(storeUploadDir)) fs.mkdirSync(storeUploadDir, { recursive: true });

    await seedDefaultData();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Client: ${CLIENT_URL}`);
      console.log(`🚀 Socket.io Ready`);
    });
  } catch (error) {
    console.error("❌ Server start failed:", error.message);
    process.exit(1);
  }
};

startServer();