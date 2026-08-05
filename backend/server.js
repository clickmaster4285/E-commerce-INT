require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const path = require("path");

const connectDB = require("./config/db");
const User = require("./models/User");

const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const variantRoutes = require("./routes/variantRoutes");

const app = express();

app.use(express.json({ limit: "20mb" }));

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

// Uploads public
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// Routes
app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/variants", variantRoutes);

const PORT = process.env.PORT || 5000;

// ==========================================
// DEFAULT ADMIN
// ==========================================

const checkAndCreateDefaultAdmin = async () => {

  try {
    const existingAdmin = await User.findOne({
      role: "admin",
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(
        "12345678",
        10
      );

      await User.create({

        name: "admin",

        username: "admin123",

        email: "admin@gmail.com",

        password: hashedPassword,
        role: "admin",
      });

      console.log("✅ Default Admin automatically created");
    } else {
      console.log("✅ Admin already exists");
    }
  } catch (error) {
    console.error(
      "❌ Error checking/creating admin:",
      error.message
    );

    throw error;
  }
};

// ==========================================
// TEST ROUTE
// ==========================================

app.get("/", (req, res) => {
  res.send("backend server is running");
});

// ==========================================
// START SERVER
// ==========================================

const startServer = async () => {
  try {
    await connectDB();

    await checkAndCreateDefaultAdmin();

    app.listen(PORT, () => {
      console.log(
        `✅ Server is running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "❌ Server start failed:",
      error.message
    );

    process.exit(1);
  }
};

startServer();