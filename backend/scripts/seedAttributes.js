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
  { name: "Color", code: "mobile_color", category: "mobile", data_type: "multi_select", variant_allowed: true, values: toValues(["Black", "White", "Blue", "Red", "Green", "Silver", "Gold", "Purple"]) },
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
  { name: "Colour", code: "pc_color", category: "pc", data_type: "multi_select", variant_allowed: true, values: toValues(["Black", "White", "Silver", "Grey"]) },
  { name: "Screen Size", code: "pc_screen_size", category: "pc", data_type: "multi_select", unit: "inches", values: toValues(['19"', '21.5"', '24"', '27"', '32"', '34"']) },
  { name: "Screen Resolution", code: "pc_screen_resolution", category: "pc", data_type: "multi_select", values: toValues(["HD", "Full HD", "2K", "4K", "5K"]) },

  // ============= CLOTHING =============
  { name: "Size", code: "clothing_size", category: "clothing", data_type: "multi_select", variant_allowed: true, values: toValues(["XS", "S", "M", "L", "XL", "XXL", "XXXL"]) },
  { name: "Color", code: "clothing_color", category: "clothing", data_type: "multi_select", variant_allowed: true, values: toValues(["Black", "White", "Blue", "Red", "Green", "Grey", "Navy", "Brown", "Beige", "Pink"]) },
  { name: "Material", code: "clothing_material", category: "clothing", data_type: "multi_select", values: toValues(["Cotton", "Polyester", "Denim", "Linen", "Wool", "Leather", "Silk"]) },
  { name: "Fit", code: "clothing_fit", category: "clothing", data_type: "multi_select", values: toValues(["Regular Fit", "Slim Fit", "Relaxed Fit", "Loose Fit", "Oversized"]) },
  { name: "Pattern", code: "clothing_pattern", category: "clothing", data_type: "multi_select", values: toValues(["Plain", "Printed", "Striped", "Checked", "Floral", "Graphic"]) },
  { name: "Gender", code: "clothing_gender", category: "clothing", data_type: "multi_select", values: toValues(["Men", "Women", "Unisex", "Kids"]) },
  { name: "Sleeve Type", code: "clothing_sleeve_type", category: "clothing", data_type: "multi_select", values: toValues(["Full Sleeve", "Half Sleeve", "Short Sleeve", "Sleeveless"]) },
  { name: "Season", code: "clothing_season", category: "clothing", data_type: "multi_select", values: toValues(["Spring", "Summer", "Autumn", "Winter", "All Season"]) },
  { name: "Brand", code: "clothing_brand", category: "clothing", data_type: "multi_select", values: toValues(["Nike", "Adidas", "Levi's"]) },

  // ============= FOOTWEAR =============
  { name: "Shoe Size (US)", code: "footwear_size_us", category: "footwear", data_type: "multi_select", variant_allowed: true, values: toValues(["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "13"]) },
  { name: "Shoe Size (EU)", code: "footwear_size_eu", category: "footwear", data_type: "multi_select", variant_allowed: true, values: toValues(["38", "39", "40", "41", "42", "43", "44", "45", "46"]) },
  { name: "Gender", code: "footwear_gender", category: "footwear", data_type: "multi_select", values: toValues(["Men", "Women", "Unisex", "Kids"]) },
  { name: "Material", code: "footwear_material", category: "footwear", data_type: "multi_select", values: toValues(["Leather", "Canvas", "Synthetic", "Mesh", "Rubber", "Suede"]) },
  { name: "Sole Type", code: "footwear_sole_type", category: "footwear", data_type: "multi_select", values: toValues(["Rubber", "EVA", "PU", "TPU", "Memory Foam"]) },
  { name: "Closure Type", code: "footwear_closure", category: "footwear", data_type: "multi_select", values: toValues(["Lace-Up", "Slip-On", "Velcro", "Zipper", "Buckle"]) },
  { name: "Season", code: "footwear_season", category: "footwear", data_type: "multi_select", values: toValues(["Summer", "Winter", "Rainy", "All Season"]) },
  { name: "Color", code: "footwear_color", category: "footwear", data_type: "multi_select", variant_allowed: true, values: toValues(["Black", "White", "Brown", "Grey", "Blue", "Red", "Beige"]) },

  // ============= WATCHES =============
  { name: "Case Size", code: "watch_case_size", category: "watches", data_type: "multi_select", unit: "mm", values: toValues(["32 mm", "36 mm", "38 mm", "40 mm", "42 mm", "44 mm", "46 mm"]) },
  { name: "Strap Material", code: "watch_strap_material", category: "watches", data_type: "multi_select", variant_allowed: true, values: toValues(["Stainless Steel", "Leather", "Silicone", "Nylon", "Ceramic", "Titanium"]) },
  { name: "Movement Type", code: "watch_movement", category: "watches", data_type: "multi_select", values: toValues(["Quartz", "Automatic", "Manual Wind", "Solar", "Smart"]) },
  { name: "Water Resistance", code: "watch_water_resistance", category: "watches", data_type: "multi_select", values: toValues(["30m", "50m", "100m", "200m", "Dive Rated"]) },
  { name: "Dial Color", code: "watch_dial_color", category: "watches", data_type: "multi_select", variant_allowed: true, values: toValues(["Black", "White", "Blue", "Silver", "Gold", "Green", "Brown"]) },
  { name: "Glass Type", code: "watch_glass", category: "watches", data_type: "multi_select", values: toValues(["Mineral", "Sapphire Crystal", "Acrylic", "Hardened Glass"]) },

  // ============= AUDIO / HEADPHONES =============
  { name: "Connectivity", code: "audio_connectivity", category: "audio", data_type: "multi_select", values: toValues(["Bluetooth", "Wired", "USB-C", "Wireless 2.4GHz", "Hybrid"]) },
  { name: "Noise Cancellation", code: "audio_anc", category: "audio", data_type: "boolean", values: [{ label: "Yes", value: "yes", sort_order: 0, is_active: true }, { label: "No", value: "no", sort_order: 1, is_active: true }] },
  { name: "Driver Size", code: "audio_driver_size", category: "audio", data_type: "multi_select", unit: "mm", values: toValues(["10 mm", "12 mm", "20 mm", "30 mm", "40 mm", "50 mm"]) },
  { name: "Battery Life", code: "audio_battery", category: "audio", data_type: "multi_select", unit: "hours", values: toValues(["5 hrs", "8 hrs", "10 hrs", "15 hrs", "20 hrs", "30+ hrs"]) },
  { name: "Form Factor", code: "audio_form_factor", category: "audio", data_type: "multi_select", values: toValues(["In-Ear", "Over-Ear", "On-Ear", "Neckband", "True Wireless"]) },
  { name: "Color", code: "audio_color", category: "audio", data_type: "multi_select", variant_allowed: true, values: toValues(["Black", "White", "Silver", "Blue", "Rose Gold", "Matte Black"]) },

  // ============= HOME APPLIANCES =============
  { name: "Capacity", code: "appliance_capacity", category: "appliances", data_type: "multi_select", variant_allowed: true, values: toValues(["1 L", "2 L", "5 L", "10 L", "15 L", "20 L", "50 L", "100 L", "200 L", "500 L"]) },
  { name: "Energy Rating", code: "appliance_energy_rating", category: "appliances", data_type: "multi_select", values: toValues(["1 Star", "2 Star", "3 Star", "4 Star", "5 Star", "Inverter"]) },
  { name: "Power Consumption", code: "appliance_power", category: "appliances", data_type: "multi_select", unit: "W", values: toValues(["100W", "300W", "500W", "800W", "1000W", "1500W", "2000W"]) },
  { name: "Color", code: "appliance_color", category: "appliances", data_type: "multi_select", variant_allowed: true, values: toValues(["White", "Black", "Silver", "Stainless Steel", "Red", "Grey"]) },
  { name: "Type", code: "appliance_type", category: "appliances", data_type: "multi_select", values: toValues(["Refrigerator", "Washing Machine", "Microwave", "AC", "Heater", "Blender", "Air Fryer"]) },

  // ============= BEAUTY / SKINCARE =============
  { name: "Skin Type", code: "beauty_skin_type", category: "beauty", data_type: "multi_select", values: toValues(["Normal", "Dry", "Oily", "Combination", "Sensitive", "All Skin Types"]) },
  { name: "Volume / Weight", code: "beauty_volume", category: "beauty", data_type: "multi_select", variant_allowed: true, values: toValues(["15 ml", "30 ml", "50 ml", "100 ml", "200 ml", "500 ml", "1 kg"]) },
  { name: "SPF Level", code: "beauty_spf", category: "beauty", data_type: "multi_select", values: toValues(["SPF 15", "SPF 30", "SPF 50", "SPF 50+", "No SPF"]) },
  { name: "Fragrance", code: "beauty_fragrance", category: "beauty", data_type: "multi_select", values: toValues(["Fragrance Free", "Floral", "Citrus", "Woody", "Vanilla", "Unscented"]) },
  { name: "Key Ingredient", code: "beauty_ingredient", category: "beauty", data_type: "multi_select", values: toValues(["Hyaluronic Acid", "Vitamin C", "Retinol", "Niacinamide", "Salicylic Acid", "Aloe Vera"]) },
  { name: "Gender", code: "beauty_gender", category: "beauty", data_type: "multi_select", values: toValues(["Men", "Women", "Unisex"]) },

  // ============= GAMING CONSOLES =============
  { name: "Storage", code: "gaming_storage", category: "gaming", data_type: "multi_select", variant_allowed: true, values: toValues(["500 GB", "1 TB", "2 TB", "4 TB"]) },
  { name: "Bundle Type", code: "gaming_bundle", category: "gaming", data_type: "multi_select", values: toValues(["Console Only", "With Controller", "Game Bundle", "VR Bundle", "Deluxe Edition"]) },
  { name: "Region", code: "gaming_region", category: "gaming", data_type: "multi_select", values: toValues(["Global", "US", "EU", "Asia", "Japan"]) },
  { name: "Controller Included", code: "gaming_controller", category: "gaming", data_type: "boolean", values: [{ label: "Yes", value: "yes", sort_order: 0, is_active: true }, { label: "No", value: "no", sort_order: 1, is_active: true }] },
  { name: "Edition", code: "gaming_edition", category: "gaming", data_type: "multi_select", variant_allowed: true, values: toValues(["Standard", "Digital", "Pro", "Slim", "Limited Edition"]) },
  { name: "Color", code: "gaming_color", category: "gaming", data_type: "multi_select", variant_allowed: true, values: toValues(["Black", "White", "Midnight Blue", "Cosmic Red", "Steel Grey"]) },

  // ============= FURNITURE =============
  { name: "Dimensions (LxWxH)", code: "furniture_dimensions", category: "furniture", data_type: "text", variant_allowed: false, values: [] },
  { name: "Material", code: "furniture_material", category: "furniture", data_type: "multi_select", values: toValues(["Solid Wood", "Engineered Wood", "Metal", "Glass", "Fabric", "Leather", "Plastic"]) },
  { name: "Assembly Required", code: "furniture_assembly", category: "furniture", data_type: "boolean", values: [{ label: "Yes", value: "yes", sort_order: 0, is_active: true }, { label: "No", value: "no", sort_order: 1, is_active: true }] },
  { name: "Color", code: "furniture_color", category: "furniture", data_type: "multi_select", variant_allowed: true, values: toValues(["Natural Wood", "Walnut", "Oak", "White", "Black", "Grey", "Beige"]) },
  { name: "Weight Capacity", code: "furniture_weight_capacity", category: "furniture", data_type: "multi_select", unit: "kg", values: toValues(["50 kg", "100 kg", "150 kg", "200 kg", "300 kg"]) },
  { name: "Room Type", code: "furniture_room", category: "furniture", data_type: "multi_select", values: toValues(["Living Room", "Bedroom", "Kitchen", "Office", "Bathroom", "Outdoor"]) },

  // ============= BABY PRODUCTS =============
  { name: "Age Range", code: "baby_age_range", category: "baby", data_type: "multi_select", variant_allowed: true, values: toValues(["0-3 Months", "3-6 Months", "6-12 Months", "1-2 Years", "2-4 Years", "4-6 Years"]) },
  { name: "Material Safety", code: "baby_material_safety", category: "baby", data_type: "multi_select", values: toValues(["BPA Free", "Food Grade Silicone", "Organic Cotton", "Hypoallergenic", "Non-Toxic"]) },
  { name: "Washable", code: "baby_washable", category: "baby", data_type: "boolean", values: [{ label: "Machine Washable", value: "machine", sort_order: 0, is_active: true }, { label: "Hand Wash Only", value: "hand", sort_order: 1, is_active: true }, { label: "Not Washable", value: "no", sort_order: 2, is_active: true }] },
  { name: "Gender", code: "baby_gender", category: "baby", data_type: "multi_select", values: toValues(["Boy", "Girl", "Unisex"]) },
  { name: "Size", code: "baby_size", category: "baby", data_type: "multi_select", variant_allowed: true, values: toValues(["Newborn", "Small", "Medium", "Large", "Extra Large"]) },

  // ============= SPORTS EQUIPMENT =============
  { name: "Sport Type", code: "sports_type", category: "sports", data_type: "multi_select", values: toValues(["Cricket", "Football", "Tennis", "Basketball", "Swimming", "Gym/Fitness", "Cycling"]) },
  { name: "Skill Level", code: "sports_skill_level", category: "sports", data_type: "multi_select", values: toValues(["Beginner", "Intermediate", "Advanced", "Professional"]) },
  { name: "Material", code: "sports_material", category: "sports", data_type: "multi_select", values: toValues(["Carbon Fiber", "Aluminum", "Wood", "Composite", "Rubber", "Leather"]) },
  { name: "Weight", code: "sports_weight", category: "sports", data_type: "multi_select", unit: "grams", values: toValues(["100g", "200g", "300g", "500g", "1 kg", "2 kg", "5 kg"]) },
  { name: "Size", code: "sports_size", category: "sports", data_type: "multi_select", variant_allowed: true, values: toValues(["Small", "Medium", "Large", "Official Size", "Youth Size"]) },

  // ============= AUTOMOTIVE ACCESSORIES =============
  { name: "Vehicle Compatibility", code: "auto_compatibility", category: "automotive", data_type: "multi_select", values: toValues(["Universal", "Toyota", "Honda", "Ford", "BMW", "Mercedes", "Hyundai", "Kia"]) },
  { name: "Material", code: "auto_material", category: "automotive", data_type: "multi_select", values: toValues(["ABS Plastic", "Stainless Steel", "Leather", "Rubber", "Carbon Fiber", "Aluminum"]) },
  { name: "Fitment Type", code: "auto_fitment", category: "automotive", data_type: "multi_select", values: toValues(["Direct Replacement", "Universal Fit", "Custom Fit", "Aftermarket"]) },
  { name: "Color", code: "auto_color", category: "automotive", data_type: "multi_select", variant_allowed: true, values: toValues(["Black", "Chrome", "Silver", "Red", "Blue", "Carbon Look"]) },
  { name: "Warranty", code: "auto_warranty", category: "automotive", data_type: "multi_select", values: toValues(["No Warranty", "6 Months", "1 Year", "2 Years", "Lifetime"]) },
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
          variant_allowed: attr.variant_allowed ?? true,
          is_active: true,
        });
        createdCount++;
        console.log(`   ✅ Created: ${attr.name} (${attr.values.length} values)`);
      } else {
        await Attribute.updateOne(
          { code: attr.code },
          { 
            $set: { 
              values: attr.values, 
              variant_allowed: attr.variant_allowed ?? true, 
              category: attr.category, 
              data_type: attr.data_type,
              unit: attr.unit || null,
              is_active: true 
            } 
          }
        );
        updatedCount++;
      }
    }
    console.log(`\n🎉 Attributes seeding complete! Created: ${createdCount}, Updated: ${updatedCount}\n`);
  } catch (error) {
    console.error("❌ Error in attribute seeding:", error.message);
    throw error;
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