// models/Tag.js
const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true, lowercase: true },
  slug: { 
    type: String, 
    unique: true, 
    sparse: true // ✅ Yeh line add karein
    },
    // Audit fields (optional but good practice)
    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    is_deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tag", tagSchema);