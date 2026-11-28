const mongoose = require("mongoose");

/** Shared image meta — Variant / Brand / Media sab yahi sub-doc use kar sakte hain */
const imageSchema = new mongoose.Schema(
  {
    img_url: { type: String, required: true, trim: true },
    img_size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { _id: false },
);

module.exports = imageSchema;