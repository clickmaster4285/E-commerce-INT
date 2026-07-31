const mongoose = require("mongoose");
const brandSchema = new mongoose.Schema({
    brand_code: {
  type: String,
  required: true,
  unique: true,
  trim: true,
},
name: {
  type: String,
  required: true,
  trim: true,
},
description: {
  type: String,
  trim: true,
  default: "",
},
logo_url: {
  type: String,
  trim: true,
  default: "",
},
website: {
  type: String,
  trim: true,
  default: "",
},
country: {
  type: String,
  trim: true,
  default: "",
},
is_active: {
  type: Boolean,
  default: true,
}
},
 {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);
module.exports = mongoose.model("Brand", brandSchema);