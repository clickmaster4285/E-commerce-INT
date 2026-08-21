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

// ==========================================
// ROUTES
// ==========================================

const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const variantRoutes = require("./routes/variantRoutes");
const storeRoutes = require("./routes/storeRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const discountRoutes = require("./routes/discountRoutes");
const dealRoutes = require("./routes/dealRoutes");
const tagRoutes = require("./routes/tagRoutes"); // ✅ ADDED TAG ROUTES IMPORT
const addressRoutes = require("./routes/addressRoutes"); // ✅ ADDRESS ROUTES
const bannerRoutes = require("./routes/bannerRoutes");
const bannerScheduler = require("./utils/bannerScheduler"); // ✅ Ye line add karo
// ==========================================
// APP
// ==========================================

const app = express();
const server = http.createServer(app);

// ==========================================
// ENVIRONMENT CONFIG
// ==========================================

const PORT = Number(process.env.PORT) || 5000;

const HOST = process.env.HOST || "0.0.0.0";

const CLIENT_URL = process.env.CLIENT_URL || "";

const API_PREFIX = process.env.API_PREFIX || "/api";

const NODE_ENV = process.env.NODE_ENV || "development";

const SALT_ROUNDS =
  Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

const REQUEST_SIZE_LIMIT =
  process.env.REQUEST_SIZE_LIMIT || "20mb";

const UPLOAD_CACHE_MAX_AGE =
  process.env.UPLOAD_CACHE_MAX_AGE || "7d";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR || "uploads";

const STORE_UPLOAD_SUBDIR =
  process.env.STORE_UPLOAD_SUBDIR || "store";

const DEFAULT_ADMIN_ROLE =
  process.env.DEFAULT_ADMIN_ROLE || "admin";

const STARTUP_MESSAGE =
  process.env.SERVER_STARTUP_MESSAGE ||
  "Backend server is running ";

// ==========================================
// CLIENT URL VALIDATION
// ==========================================

if (!CLIENT_URL) {
  console.warn(
    "⚠️ CLIENT_URL is not configured in .env"
  );
}

// ==========================================
// ALLOWED ORIGINS
// ==========================================

const buildAllowedOrigins = () => {
  const origins = new Set();

  if (CLIENT_URL) {
    origins.add(CLIENT_URL.trim());
  }

  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .forEach((origin) => {
        origins.add(origin);
      });
  }

  return [...origins];
};

const allowedOrigins = buildAllowedOrigins();

console.log(
  "🌐 Allowed Origins:",
  allowedOrigins.length
    ? allowedOrigins.join(", ")
    : "None configured"
);

// ==========================================
// CORS
// ==========================================

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (NODE_ENV !== "production") {
        try {
          const url = new URL(origin);
          const isLocalhost =
            url.hostname === "localhost" ||
            url.hostname === "127.0.0.1";

          if (isLocalhost) {
            return callback(null, true);
          }
        } catch (error) {
          return callback(
            new Error("Invalid request origin")
          );
        }
      }

      if (
        process.env.ALLOW_LOCAL_NETWORK === "true"
      ) {
        try {
          const url = new URL(origin);
          const isPrivateNetwork =
            /^192\.168\.\d+\.\d+$/.test(
              url.hostname
            ) ||
            /^10\.\d+\.\d+\.\d+$/.test(
              url.hostname
            ) ||
            /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(
              url.hostname
            );

          if (isPrivateNetwork) {
            return callback(null, true);
          }
        } catch (error) {
          return callback(
            new Error("Invalid request origin")
          );
        }
      }

      console.error(
        `❌ CORS blocked origin: ${origin}`
      );

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true,
  })
);

// ==========================================
// BODY MIDDLEWARE
// ==========================================

app.use(
  express.json({
    limit: REQUEST_SIZE_LIMIT,
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: REQUEST_SIZE_LIMIT,
  })
);

app.use(cookieParser());

// ==========================================
// UPLOAD DIRECTORY
// ==========================================

const uploadDir = path.join(
  __dirname,
  UPLOAD_DIR
);

const storeUploadDir = path.join(
  uploadDir,
  STORE_UPLOAD_SUBDIR
);

// ==========================================
// STATIC UPLOADS
// ==========================================

app.use(
  "/uploads",
  express.static(uploadDir, {
    maxAge: UPLOAD_CACHE_MAX_AGE,
    etag: true,
  })
);

// ==========================================
// SOCKET.IO
// ==========================================

const io = initSocket(server);

// ==========================================
// ATTACH SOCKET TO REQUEST
// ==========================================

app.use((req, res, next) => {
  req.io = io;
  next();
});

// ==========================================
// API ROUTES (PERMISSIONS REMOVED FOR TESTING)
// ==========================================

app.use(
  `${API_PREFIX}/categories`,
  categoryRoutes
);

app.use(
  `${API_PREFIX}/brands`,
  brandRoutes
);

app.use(
  `${API_PREFIX}/products`,
  productRoutes
);

app.use(
  `${API_PREFIX}/users`,
  userRoutes
);

app.use(
  `${API_PREFIX}/variants`,
  variantRoutes
);

app.use(
  `${API_PREFIX}/store`,
  storeRoutes
);

app.use(
  `${API_PREFIX}/employees`,
  employeeRoutes
);

app.use(
  `${API_PREFIX}/discounts`,
  discountRoutes
);

app.use(
  `${API_PREFIX}/deals`,
  dealRoutes
);

// ✅ REGISTER TAG ROUTES HERE
app.use(
  `${API_PREFIX}/tags`,
  tagRoutes
);

// ✅ REGISTER ADDRESS ROUTES
// ✅ REGISTER ADDRESS ROUTES
app.use(
  `${API_PREFIX}/addresses`,
  addressRoutes
);

// ✅ REGISTER BANNER ROUTES
app.use(
  `${API_PREFIX}/banners`,
  bannerRoutes
);
// ==========================================
// ROOT ROUTE
// ==========================================

app.get("/", (req, res) => {
  res.send(STARTUP_MESSAGE);
});

// ==========================================
// HEALTH CHECK
// ==========================================

app.get(
  `${API_PREFIX}/health`,
  (req, res) => {
    res.status(200).json({
      success: true,
      message: "API is running",
      environment: NODE_ENV,
      timestamp: new Date(),
    });
  }
);

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// ==========================================
// DEFAULT STORE + ADMIN
// ==========================================

const seedDefaultData = async () => {
  try {
    const storeName =
      process.env.DEFAULT_STORE_NAME;

    if (!storeName) {
      console.warn(
        "⚠️ DEFAULT_STORE_NAME is missing"
      );
      return;
    }

    let defaultStore =
      await Store.findOne({
        store_name: storeName,
      });

    if (!defaultStore) {
      defaultStore = await Store.create({
        store_name: storeName,
        tagline:
          process.env.DEFAULT_STORE_TAGLINE,
        email:
          process.env.DEFAULT_STORE_EMAIL,
        phone:
          process.env.DEFAULT_STORE_PHONE,
        support_email:
          process.env.DEFAULT_STORE_SUPPORT_EMAIL,
        support_phone:
          process.env.DEFAULT_STORE_SUPPORT_PHONE,
        country:
          process.env.DEFAULT_STORE_COUNTRY,
        state:
          process.env.DEFAULT_STORE_STATE,
        city:
          process.env.DEFAULT_STORE_CITY,
        zip_code:
          process.env.DEFAULT_STORE_ZIP_CODE,
        address:
          process.env.DEFAULT_STORE_ADDRESS,
        currency:
          process.env.DEFAULT_STORE_CURRENCY,
        tax_rate:
          Number(
            process.env.DEFAULT_STORE_TAX_RATE
          ) || 0,
        weight_unit:
          process.env.DEFAULT_STORE_WEIGHT_UNIT,
        store_status:
          process.env.DEFAULT_STORE_STATUS,
        primary_color:
          process.env.DEFAULT_STORE_PRIMARY_COLOR,
      });

      console.log(
        "✅ Default store seeded:",
        storeName
      );
    }

    const adminEmail =
      process.env.DEFAULT_ADMIN_EMAIL;
    const adminPassword =
      process.env.DEFAULT_ADMIN_PASSWORD;
    const adminUsername =
      process.env.DEFAULT_ADMIN_USERNAME;
    const adminName =
      process.env.DEFAULT_ADMIN_NAME;

    if (!adminEmail || !adminPassword) {
      console.warn(
        "⚠️ Default admin credentials are missing"
      );
      return;
    }

    const adminSearch = [
      { email: adminEmail },
    ];

    if (adminUsername) {
      adminSearch.push({
        username: adminUsername,
      });
    }

    let admin =
      await User.findOne({
        $or: adminSearch,
      });

    if (!admin) {
      const hashedPassword =
        await bcrypt.hash(
          adminPassword,
          SALT_ROUNDS
        );

      admin = await User.create({
        name: adminName,
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        role: DEFAULT_ADMIN_ROLE,
        storeId: defaultStore._id,
      });

      console.log(
        "✅ Default admin seeded:",
        adminEmail
      );
    } else {
      let updated = false;

      if (!admin.storeId) {
        admin.storeId =
          defaultStore._id;
        updated = true;
      }

      if (
        admin.role !==
        DEFAULT_ADMIN_ROLE
      ) {
        admin.role =
          DEFAULT_ADMIN_ROLE;
        updated = true;
      }

      if (updated) {
        await admin.save();
        console.log(
          "🔄 Existing admin updated"
        );
      }
    }
  } catch (error) {
    console.error(
      "❌ Seed Error:",
      error.message
    );
    throw error;
  }
};

// ==========================================
// CREATE DIRECTORIES
// ==========================================

const createUploadDirectories = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {
      recursive: true,
    });
    console.log(
      "📁 Upload directory created:",
      uploadDir
    );
  }

  if (!fs.existsSync(storeUploadDir)) {
    fs.mkdirSync(storeUploadDir, {
      recursive: true,
    });
    console.log(
      " Store upload directory created:",
      storeUploadDir
    );
  }
};

// ==========================================
// SERVER STARTUP
// ==========================================

const startServer = async () => {
  try {
    await connectDB();
    createUploadDirectories();
    await seedDefaultData();
    createUploadDirectories();
    bannerScheduler; // ✅ Ye line add karo (scheduler start karne ke liye)
    await seedDefaultData();
    server.listen(
      PORT,
      HOST,
      () => {
        const displayHost =
          HOST === "0.0.0.0"
            ? "localhost"
            : HOST;

        console.log("");
        console.log(
          "=========================================="
        );
        console.log(
          `🚀 ${STARTUP_MESSAGE}`
        );
        console.log(
          "=========================================="
        );
        console.log(
          `🌐 Server: http://${displayHost}:${PORT}`
        );
        console.log(
          `🔗 API: http://${displayHost}:${PORT}${API_PREFIX}`
        );
        console.log(
          `❤️ Health: http://${displayHost}:${PORT}${API_PREFIX}/health`
        );
        console.log(
          `🏷️ Tags: ${API_PREFIX}/tags`
        );
        console.log(
          `🌍 Environment: ${NODE_ENV}`
        );
        console.log(
          `🔐 CORS Origins: ${
            allowedOrigins.length
              ? allowedOrigins.join(", ")
              : "Development localhost enabled"
          }`
        );
        console.log(
          "🚀 Socket.IO Ready"
        );
        console.log(
          "=========================================="
        );
      }
    );
  } catch (error) {
    console.error(
      " Server start failed:",
      error.message
    );
    process.exit(1);
  }
};

startServer();