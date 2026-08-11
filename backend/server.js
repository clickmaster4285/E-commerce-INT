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

const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const variantRoutes = require("./routes/variantRoutes");
const storeRoutes = require("./routes/storeRoutes");

const app = express();
const server = http.createServer(app);

// ==========================================
// CONSTANTS
// ==========================================
const ROLES = { ADMIN: "admin" };
const PORT = process.env.PORT;
const CLIENT_URL = process.env.CLIENT_URL;
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

if (!PORT || !CLIENT_URL) {
  console.error("❌ CRITICAL: PORT or CLIENT_URL is missing in .env file!");
}

// ✅ CORS — localhost + network IP + .env value, sab allow
const buildAllowedOrigins = () => {
  const origins = new Set();
  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");
  if (CLIENT_URL) origins.add(CLIENT_URL);
  return Array.from(origins).filter(Boolean);
};

const allowedOrigins = buildAllowedOrigins();
console.log("🌐 Allowed CORS origins:", allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // curl, mobile apps
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/^http:\/\/192\.168\.\d+\.\d+:3000$/.test(origin)) return callback(null, true);
    if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
    console.warn("⚠️ CORS blocked origin:", origin);
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

// ✅ Socket initialize AFTER middleware
const io = initSocket(server);

// ==========================================
// ROUTES
// ==========================================
app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/variants", variantRoutes);
app.use("/api/store", storeRoutes);

app.get("/", (req, res) => {
  res.send(`Backend server is running with Socket.io 🚀 | Client: ${CLIENT_URL}`);
});

// ==========================================
//  STORE + 👤 ADMIN SEEDING
// ==========================================
const seedDefaultData = async () => {
  try {
    const storeName = process.env.DEFAULT_STORE_NAME;
    if (!storeName) {
      console.warn("⚠️ DEFAULT_STORE_NAME not found in .env");
      return;
    }

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
    } else {
      console.log("ℹ️ Store already exists:", defaultStore.store_name);
    }

    const adminName = process.env.DEFAULT_ADMIN_NAME;
    const adminUsername = process.env.DEFAULT_ADMIN_USERNAME;
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.log("⚠️ Admin credentials missing in .env");
      return;
    }

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
        role: ROLES.ADMIN,
        storeId: defaultStore._id,
      });
      console.log("✅ Default admin seeded:", adminEmail);
      console.log("   🔑 Password:", adminPassword);
    } else {
      let updated = false;
      if (!admin.storeId) { admin.storeId = defaultStore._id; updated = true; }
      if (admin.role !== ROLES.ADMIN) { admin.role = ROLES.ADMIN; updated = true; }
      if (updated) {
        await admin.save();
        console.log("🔄 Admin updated with storeId & role");
      } else {
        console.log("ℹ️ Admin already exists:", adminEmail);
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

    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const storeUploadDir = path.join(uploadDir, "store");
    if (!fs.existsSync(storeUploadDir)) fs.mkdirSync(storeUploadDir, { recursive: true });

    await seedDefaultData();

    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Client URL: ${CLIENT_URL}`);
      console.log(`🚀 Socket.io Ready`);
      console.log(`📁 Uploads: ${uploadDir}`);
    });
  } catch (error) {
    console.error("❌ Server start failed:", error.message);
    process.exit(1);
  }
};

startServer();