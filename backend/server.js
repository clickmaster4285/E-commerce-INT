require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs"); // 1. bcrypt import kiya
const User = require("./models/User"); // 1. User model import kiya

const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();

app.use(express.json());
app.use(cors({
  origin: "http://localhost:3000"
}));

app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);

const PORT = 5000;

// 2. Ye function check karega ke admin hai ya nahi
const checkAndCreateDefaultAdmin = async () => {
  try {
    // Database mein dekho ke kya koi admin pehle se मौजूद hai?
    const existingAdmin = await User.findOne({ role: "admin" });

    // 3. Condition: Agar admin NAHI hai, tab hi naya banayein
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("12345678", 10);
      
      await User.create({
        name: "admin",
        username: "admin123",
        email: "admin@gmail.com",
        password: hashedPassword,
        role: "admin"
      });
      console.log("✅ Default Admin automatically created: admin@gmail.com / 12345678");
    } else {
      // Agar admin pehle se hai, toh kuch nahi hoga
      console.log("✅ Admin already exists. No action needed.");
    }
  } catch (error) {
    console.error("❌ Error checking/creating admin:", error.message);
    process.exit(1);
  }
};

mongoose.connect(process.env.MONGO_URI) 
  .then(() => {
    console.log("MongoDB connection sucessfully");
    // 4. Database connect hone ke baad ye function automatically chalega
    checkAndCreateDefaultAdmin(); 
  })
  .catch((error) => {
    console.log("MongoDB connection failed", error.message);
  });

app.get("/", (req, res) => {
  res.send("backend server is running");
});

app.listen(PORT, () => {
  console.log(`server is running on port ${PORT}`);
});