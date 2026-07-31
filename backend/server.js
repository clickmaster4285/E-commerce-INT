require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const categoryRoutes = require("./routes/categoryRoutes");
const brandRoutes = require("./routes/brandRoutes");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const app = express();

app.use(express.json());
app.use(cors({
  origin: "http://localhost:3000"
}));
app.use("/api/categories",categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);


const PORT = 5000;

    mongoose.connect(process.env.MONGO_URI) 
.then(()=>{
    console.log("MongoDB connection sucessfully");
})
.catch((error)=>{
    console.log("MongoDB connection failed",error.message);
});


app.get("/",(req,res)=>{
    res.send("backend server is running")
});



app.listen(PORT,()=>{
    console.log(`server is running on port ${PORT}`);
});