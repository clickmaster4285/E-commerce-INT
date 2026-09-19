const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema({
  store_name: { type: String, default: "My Professional Store" },
  tagline: { type: String, default: "Welcome to our store" },
  email: { type: String, default: "store@example.com" },
  phone: { type: String, default: "" },
  support_email: { type: String, default: "" },
  support_phone: { type: String, default: "" },
  
  // Address
  country: { type: String, default: "PK" },
  state: { type: String, default: "" },
  city: { type: String, default: "" },
  zip_code: { type: String, default: "" },
  address: { type: String, default: "" },
  
  // Business
  currency: { type: String, default: "PKR" },
  tax_rate: { type: Number, default: 0 },
  weight_unit: { type: String, default: "kg" },
  store_status: { type: String, default: "open" }, // open, closed, maintenance
  maintenance_message: { type: String, default: "" },
  
  // Branding
  primary_color: { type: String, default: "#10b981" },
  logo: { 
    img_url: { type: String, default: "" },
    public_id: { type: String, default: "" } // Cloudinary use kar rahe hain toh
  },
  
  // SEO
  meta_title: { type: String, default: "" },
  meta_description: { type: String, default: "" },
  meta_keywords: { type: String, default: "" },
  
  // Social Links
  social_links: {
    facebook: { type: String, default: "" },
    instagram: { type: String, default: "" },
    twitter: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    youtube: { type: String, default: "" },
    tiktok: { type: String, default: "" },
  },
  
  // Legal
  return_policy: { type: String, default: "" },
  privacy_policy: { type: String, default: "" },
  terms_conditions: { type: String, default: "" },

}, { timestamps: true });

module.exports = mongoose.model("Store", storeSchema);