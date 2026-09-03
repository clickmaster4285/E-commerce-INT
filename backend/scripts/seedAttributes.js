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

const ATTRIBUTES_TO_SEED = [
  // ============= MOBILE =============
  { name: "RAM", code: "ram", data_type: "multi_select", variant_allowed: true, values: toValues(["4GB", "6GB", "8GB", "12GB", "16GB"]) },
  { name: "Storage", code: "storage", data_type: "multi_select", variant_allowed: true, values: toValues(["64GB", "128GB", "256GB", "512GB", "1TB"]) },
  { name: "Screen Size", code: "screen_size", data_type: "select", unit: "inches", values: toValues(['5.5"', '6.1"', '6.5"', '6.7"', '6.9"']) },
  { name: "Color", code: "color", data_type: "color", values: toValues(["Black", "White", "Blue", "Green", "Red", "Gold", "Silver", "Purple"]) },
  { name: "Battery", code: "battery", data_type: "select", unit: "mAh", values: toValues(["4000mAh", "4500mAh", "5000mAh", "5500mAh", "6000mAh"]) },
  { name: "Camera", code: "camera", data_type: "select", values: toValues(["12MP", "24MP", "48MP", "50MP", "64MP", "108MP", "200MP"]) },
  { name: "Processor", code: "processor", data_type: "select", values: toValues(["Snapdragon", "MediaTek Dimensity", "MediaTek Helio", "Apple A-Series", "Exynos"]) },
  { name: "Brand", code: "brand", data_type: "select", values: toValues(["Apple", "Samsung", "Xiaomi", "Oppo", "Vivo", "OnePlus", "Google"]) },
  { name: "Model", code: "model", data_type: "select", values: toValues(["iPhone 15", "iPhone 16", "Galaxy S24", "Galaxy S25"]) },

  // ============= PC =============
  { name: "RAM", code: "pc_ram", data_type: "multi_select", variant_allowed: true, values: toValues(["4GB", "8GB", "16GB", "32GB", "64GB"]) },
  { name: "Storage", code: "pc_storage", data_type: "multi_select", variant_allowed: true, values: toValues(["256GB", "512GB", "1TB", "2TB", "4TB"]) },
  { name: "Processor", code: "pc_processor", data_type: "multi_select", values: toValues(["Intel Core i3", "Intel Core i5", "Intel Core i7", "Intel Core i9", "AMD Ryzen 3", "AMD Ryzen 5", "AMD Ryzen 7", "AMD Ryzen 9"]) },
  { name: "Graphics Card", code: "gpu", data_type: "multi_select", values: toValues(["Integrated", "GTX 1650", "RTX 3050", "RTX 3060", "RTX 4060", "RTX 4070"]) },
  { name: "Color", code: "pc_color", data_type: "multi_select", values: toValues(["Black", "White", "Silver", "Grey"]) },
  { name: "Motherboard", code: "motherboard", data_type: "multi_select", values: toValues(["ASUS", "MSI", "Gigabyte", "ASRock"]) },
  { name: "Power Supply", code: "power_supply", data_type: "multi_select", unit: "W", values: toValues(["450W", "550W", "650W", "750W", "850W"]) },
  { name: "Screen Size", code: "pc_screen_size", data_type: "multi_select", unit: "inches", values: toValues(['21.5"', '24"', '27"', '32"']) },
  { name: "Screen Resolution", code: "pc_screen_resolution", data_type: "multi_select", values: toValues(["1920×1080", "2560×1440", "3840×2160"]) },

  // ============= CLOTHING =============
  { name: "Size", code: "size", data_type: "multi_select", values: toValues(["XS", "S", "M", "L", "XL", "XXL"]) },
  { name: "Color", code: "clothing_color", data_type: "multi_select", values: toValues(["Black", "White", "Red", "Blue", "Green", "Yellow", "Grey", "Brown"]) },
  { name: "Material", code: "material", data_type: "multi_select", values: toValues(["Cotton", "Polyester", "Denim", "Wool", "Linen"]) },
  { name: "Fit", code: "fit", data_type: "multi_select", values: toValues(["Slim Fit", "Regular Fit", "Loose Fit", "Oversized"]) },
  { name: "Pattern", code: "pattern", data_type: "multi_select", values: toValues(["Plain", "Striped", "Checked", "Printed"]) },
];

// Main seeding function jo server call karega
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
          variant_allowed: true,
          is_active: true,
        });
        createdCount++;
        console.log(`   ✅ Created: ${attr.name} (${attr.values.length} values)`);
      } else {
        await Attribute.updateOne(
          { code: attr.code },
          { $set: { values: attr.values, variant_allowed: true } }
        );
        updatedCount++;
      }
    }
    console.log(`🎉 Attributes seeding complete! Created: ${createdCount}, Updated: ${updatedCount}\n`);
  } catch (error) {
    console.error("❌ Error in attribute seeding:", error.message);
    // Server crash hone se bachane ke liye error ko yahan handle kiya gaya hai
  }
}

// Agar is file ko directly node se run kiya jaye (optional standalone support)
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

// Export karein taake server.js isay use kar sake
module.exports = { seedAttributes };