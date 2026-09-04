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
  { name: "RAM", code: "ram", category: "mobile", data_type: "multi_select", variant_allowed: true, values: toValues(["4GB", "6GB", "8GB", "12GB", "16GB"]) },
  { name: "Storage", code: "storage", category: "mobile", data_type: "multi_select", variant_allowed: true, values: toValues(["64GB", "128GB", "256GB", "512GB", "1TB"]) },
  { name: "Screen Size", code: "screen_size", category: "mobile", data_type: "select", unit: "inches", values: toValues(['5.5"', '6.1"', '6.5"', '6.7"', '6.9"']) },
  { name: "Color", code: "color", category: "mobile", data_type: "color", values: toValues(["Black", "White", "Blue", "Green", "Red", "Gold", "Silver", "Purple"]) },
  { name: "Battery", code: "battery", category: "mobile", data_type: "select", unit: "mAh", values: toValues(["4000mAh", "4500mAh", "5000mAh", "5500mAh", "6000mAh"]) },
  { name: "Camera", code: "camera", category: "mobile", data_type: "select", values: toValues(["12MP", "24MP", "48MP", "50MP", "64MP", "108MP", "200MP"]) },
  { name: "Processor", code: "processor", category: "mobile", data_type: "select", values: toValues(["Snapdragon", "MediaTek Dimensity", "MediaTek Helio", "Apple A-Series", "Exynos"]) },
  { name: "Brand", code: "brand", category: "mobile", data_type: "select", values: toValues(["Apple", "Samsung", "Xiaomi", "Oppo", "Vivo", "OnePlus", "Google"]) },
  { name: "Model", code: "model", category: "mobile", data_type: "select", values: toValues(["iPhone 15", "iPhone 16", "Galaxy S24", "Galaxy S25"]) },

  // ============= PC =============
  { name: "RAM", code: "pc_ram", category: "pc", data_type: "multi_select", variant_allowed: true, values: toValues(["4GB", "8GB", "16GB", "32GB", "64GB"]) },
  { name: "Storage", code: "pc_storage", category: "pc", data_type: "multi_select", variant_allowed: true, values: toValues(["256GB", "512GB", "1TB", "2TB", "4TB"]) },
  { name: "Processor", code: "pc_processor", category: "pc", data_type: "multi_select", values: toValues(["Intel Core i3", "Intel Core i5", "Intel Core i7", "Intel Core i9", "AMD Ryzen 3", "AMD Ryzen 5", "AMD Ryzen 7", "AMD Ryzen 9"]) },
  { name: "Graphics Card", code: "gpu", category: "pc", data_type: "multi_select", values: toValues(["Integrated", "GTX 1650", "RTX 3050", "RTX 3060", "RTX 4060", "RTX 4070"]) },
  { name: "Color", code: "pc_color", category: "pc", data_type: "multi_select", values: toValues(["Black", "White", "Silver", "Grey"]) },
  { name: "Motherboard", code: "motherboard", category: "pc", data_type: "multi_select", values: toValues(["ASUS", "MSI", "Gigabyte", "ASRock"]) },
  { name: "Power Supply", code: "power_supply", category: "pc", data_type: "multi_select", unit: "W", values: toValues(["450W", "550W", "650W", "750W", "850W"]) },
  { name: "Screen Size", code: "pc_screen_size", category: "pc", data_type: "multi_select", unit: "inches", values: toValues(['21.5"', '24"', '27"', '32"']) },
  { name: "Screen Resolution", code: "pc_screen_resolution", category: "pc", data_type: "multi_select", values: toValues(["1920×1080", "2560×1440", "3840×2160"]) },

  // ============= CLOTHING =============
  { name: "Size", code: "size", category: "clothing", data_type: "multi_select", values: toValues(["XS", "S", "M", "L", "XL", "XXL"]) },
  { name: "Color", code: "clothing_color", category: "clothing", data_type: "multi_select", values: toValues(["Black", "White", "Red", "Blue", "Green", "Yellow", "Grey", "Brown"]) },
  { name: "Material", code: "material", category: "clothing", data_type: "multi_select", values: toValues(["Cotton", "Polyester", "Denim", "Wool", "Linen"]) },
  { name: "Fit", code: "fit", category: "clothing", data_type: "multi_select", values: toValues(["Slim Fit", "Regular Fit", "Loose Fit", "Oversized"]) },
  { name: "Pattern", code: "pattern", category: "clothing", data_type: "multi_select", values: toValues(["Plain", "Striped", "Checked", "Printed"]) },
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
          { $set: { values: attr.values, variant_allowed: attr.variant_allowed || true, category: attr.category } }
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