// backend/scripts/seedAttributes.js
const Attribute = require("../models/Attribute");

// Helper: predefined values formatter
const toValues = (arr) =>
  arr.map((v, i) => ({
    label: v,
    value: v,
    sort_order: i,
    is_active: true,
  }));

// ==========================================
// SINGLE SOURCE OF TRUTH: MASTER CONFIG
// ==========================================
const ATTRIBUTES_TO_SEED = [
  // ============= MOBILE =============
  { name: "RAM", code: "mobile_ram", category: "mobile", data_type: "multi_select", variant_allowed: true, values: toValues(["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB", "24 GB"]) },
{ name: "Storage", code: "mobile_storage", category: "mobile", data_type: "multi_select", variant_allowed: true, values: toValues(["32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"]) },
{ name: "Screen Size", code: "mobile_screen_size", category: "mobile", data_type: "multi_select", unit: "inches", values: toValues(['5.0"', '5.5"', '6.0"', '6.1"', '6.3"', '6.5"', '6.7"', '6.9"']) },
{ name: "Screen Resolution", code: "mobile_screen_resolution", category: "mobile", data_type: "multi_select", values: toValues(["HD", "HD+", "Full HD+", "2K", "4K"]) },
{ name: "Color", code: "mobile_color", category: "mobile", data_type: "multi_select", values: toValues(["Black", "White", "Blue", "Red", "Green", "Silver", "Gold", "Purple"]) },
{ name: "Battery", code: "mobile_battery", category: "mobile", data_type: "multi_select", unit: "mAh", values: toValues(["3000 mAh", "4000 mAh", "4500 mAh", "5000 mAh", "6000 mAh", "7000 mAh"]) },
{ name: "Camera", code: "mobile_camera", category: "mobile", data_type: "multi_select", values: toValues(["8 MP", "12 MP", "16 MP", "32 MP", "48 MP", "50 MP", "64 MP", "108 MP", "200 MP"]) },
{ name: "Model", code: "mobile_model", category: "mobile", data_type: "multi_select", values: toValues(["A15", "S24", "iPhone 15"]) },
{ name: "Network", code: "mobile_network", category: "mobile", data_type: "multi_select", values: toValues(["2G", "3G", "4G", "5G"]) },
{ name: "SIM", code: "mobile_sim", category: "mobile", data_type: "multi_select", values: toValues(["Single SIM", "Dual SIM"]) },
{ name: "OS", code: "mobile_os", category: "mobile", data_type: "multi_select", values: toValues(["Android", "iOS"]) },

  // ============= PC =============
  { name: "RAM", code: "pc_ram", category: "pc", data_type: "multi_select", variant_allowed: true, values: toValues(["4 GB", "8 GB", "16 GB", "32 GB", "64 GB", "128 GB"]) },
  { name: "Storage", code: "pc_storage", category: "pc", data_type: "multi_select", variant_allowed: true, values: toValues(["128 GB", "256 GB", "512 GB", "1 TB", "2 TB", "4 TB"]) },
  { name: "Processor", code: "pc_processor", category: "pc", data_type: "multi_select", values: toValues(["Core i3", "Core i5", "Core i7", "Core i9", "Ryzen 3", "Ryzen 5", "Ryzen 7", "Ryzen 9"]) },
  { name: "Graphics Card", code: "pc_gpu", category: "pc", data_type: "multi_select", values: toValues(["Integrated", "GTX 1650", "RTX 3050", "RTX 3060", "RTX 4060", "RTX 4070", "RTX 4080", "RTX 4090"]) },
  { name: "Motherboard", code: "pc_motherboard", category: "pc", data_type: "multi_select", values: toValues(["ATX", "Micro-ATX", "Mini-ITX"]) },
  { name: "Power Supply", code: "pc_power_supply", category: "pc", data_type: "multi_select", unit: "W", values: toValues(["450W", "550W", "650W", "750W", "850W", "1000W"]) },
  { name: "Colour", code: "pc_color", category: "pc", data_type: "multi_select", values: toValues(["Black", "White", "Silver", "Grey"]) },
  { name: "Screen Size", code: "pc_screen_size", category: "pc", data_type: "multi_select", unit: "inches", values: toValues(['19"', '21.5"', '24"', '27"', '32"', '34"']) },
  { name: "Screen Resolution", code: "pc_screen_resolution", category: "pc", data_type: "multi_select", values: toValues(["HD", "Full HD", "2K", "4K", "5K"]) },

  // ============= CLOTHING =============
  { name: "Size", code: "clothing_size", category: "clothing", data_type: "multi_select", values: toValues(["XS", "S", "M", "L", "XL", "XXL", "XXXL"]) },
  { name: "Color", code: "clothing_color", category: "clothing", data_type: "multi_select", values: toValues(["Black", "White", "Blue", "Red", "Green", "Grey", "Navy", "Brown", "Beige", "Pink"]) },
  { name: "Material", code: "clothing_material", category: "clothing", data_type: "multi_select", values: toValues(["Cotton", "Polyester", "Denim", "Linen", "Wool", "Leather", "Silk"]) },
  { name: "Fit", code: "clothing_fit", category: "clothing", data_type: "multi_select", values: toValues(["Regular Fit", "Slim Fit", "Relaxed Fit", "Loose Fit", "Oversized"]) },
  { name: "Pattern", code: "clothing_pattern", category: "clothing", data_type: "multi_select", values: toValues(["Plain", "Printed", "Striped", "Checked", "Floral", "Graphic"]) },
  { name: "Gender", code: "clothing_gender", category: "clothing", data_type: "multi_select", values: toValues(["Men", "Women", "Unisex", "Kids"]) },
  { name: "Sleeve Type", code: "clothing_sleeve_type", category: "clothing", data_type: "multi_select", values: toValues(["Full Sleeve", "Half Sleeve", "Short Sleeve", "Sleeveless"]) },
  { name: "Season", code: "clothing_season", category: "clothing", data_type: "multi_select", values: toValues(["Spring", "Summer", "Autumn", "Winter", "All Season"]) },
  { name: "Brand", code: "clothing_brand", category: "clothing", data_type: "multi_select", values: toValues(["Nike", "Adidas", "Levi's"]) },
];

async function seedAttributes() {
  try {
    console.log("\n🌍 Checking/Seeding GLOBAL attributes...");
    let createdCount = 0;
    let updatedCount = 0;

    for (const attr of ATTRIBUTES_TO_SEED) {
      const exists = await Attribute.findOne({ code: attr.code });

      if (!exists) {
        await Attribute.create({
          ...attr,
          variant_allowed: attr.variant_allowed || true,
          is_active: true,
        });
        createdCount++;
        console.log(`   ✅ Created: ${attr.name} (${attr.values.length} values)`);
      } else {
        await Attribute.updateOne(
          { code: attr.code },
          { $set: { values: attr.values, variant_allowed: attr.variant_allowed || true, category: attr.category, is_active: true } }
        );
        updatedCount++;
      }
    }
    console.log(`🎉 Attributes seeding complete! Created: ${createdCount}, Updated: ${updatedCount}\n`);
  } catch (error) {
    console.error("❌ Error in attribute seeding:", error.message);
  }
}

if (require.main === module) {
  const mongoose = require("mongoose");
  require("dotenv").config();
  
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ DB Connected for standalone seeding");
      return seedAttributes();
    })
    .finally(() => {
      mongoose.disconnect();
      process.exit(0);
    });
}

module.exports = { seedAttributes, ATTRIBUTES_TO_SEED };