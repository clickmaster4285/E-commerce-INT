const mongoose = require("mongoose");

/** Embedded postal address (snapshots / vendors) — user_id optional parent field par */
const addressFieldsSchema = new mongoose.Schema(
  {
    full_name: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    country_code: { type: String, trim: true, default: "" },
    street_address1: { type: String, trim: true, default: "" },
    street_address2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    state_code: { type: String, trim: true, default: "" },
    zip_code: { type: String, trim: true, default: "" },
    delivery_instructions: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

module.exports = addressFieldsSchema;