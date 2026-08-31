// backend/scripts/seedAttributes.js
const mongoose = require("mongoose");
const Attribute = require("../models/Attribute");
require("dotenv").config();

const ATTRIBUTES_TO_SEED = [
  // Mobile Specific
  { name: "RAM", code: "ram", data_type: "text", variant_allowed: true },
  { name: "ROM / Storage", code: "rom", data_type: "text" },
  { name: "Storage", code: "storage", data_type: "text" },
  { name: "Screen Size", code: "screen_size", data_type: "decimal", unit: "inches" },
  { name: "Color", code: "color", data_type: "color" },
  { name: "Battery", code: "battery", data_type: "text", unit: "mAh" },
  { name: "Camera", code: "camera", data_type: "text" },
  { name: "Processor", code: "processor", data_type: "text" },
  { name: "Brand", code: "brand", data_type: "text" },
  { name: "Model", code: "model", data_type: "text" },

  // PC Specific
  { name: "Graphics / GPU", code: "gpu", data_type: "text" },
  { name: "Screen Resolution", code: "screen_resolution", data_type: "text" },
  { name: "Operating System", code: "os", data_type: "select" },

  // Clothing Specific
  { name: "Size", code: "size", data_type: "select" },
  { name: "Fabric", code: "fabric", data_type: "text" },
  { name: "Fit", code: "fit", data_type: "select" },
  { name: "Pattern", code: "pattern", data_type: "text" },
  { name: "Gender", code: "gender", data_type: "select" },
  { name: "Sleeve Type", code: "sleeve_type", data_type: "select" },
];

async function seedAttributes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Database connected successfully.");

    console.log("🌍 Seeding GLOBAL attributes (No Tenant Filter)\n");

    let createdCount = 0;
    let skippedCount = 0;

    for (const attr of ATTRIBUTES_TO_SEED) {
      // ✅ FIX: Removed tenant_id check
      const exists = await Attribute.findOne({ code: attr.code });

      if (!exists) {
        await Attribute.create({
          ...attr,
          // tenant_id removed
          is_active: true,
          visible: true,
          filterable: true,
          searchable: true,
        });
        createdCount++;
        console.log(`   ✅ Created: ${attr.name}`);
      } else {
        skippedCount++;
      }
    }

    console.log(`\n🎉 Seeding complete! Created: ${createdCount}, Skipped: ${skippedCount}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding attributes:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedAttributes(); 