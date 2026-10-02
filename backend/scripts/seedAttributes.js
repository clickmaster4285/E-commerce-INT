// backend/scripts/seedAttributes.js
const Attribute = require("../models/Attribute");

const toValues = (arr) =>
  arr.map((v, i) => ({ label: v, value: v, sort_order: i, is_active: true }));

const YES_NO = [
  { label: "Yes", value: "yes", sort_order: 0, is_active: true },
  { label: "No", value: "no", sort_order: 1, is_active: true },
];

// ==========================================
// SHARED ATTRIBUTES (one definition, many categories)
// ==========================================
const SHARED = [
  {
    name: "Color", code: "color",
    categories: ["mobile", "pc", "clothing", "footwear", "audio", "appliances", "gaming", "furniture", "automotive"],
    data_type: "multi_select", variant_allowed: true,
    values: toValues([
      "Black", "White", "Grey", "Silver", "Gold", "Blue", "Navy", "Midnight Blue", "Red", "Cosmic Red",
      "Green", "Purple", "Pink", "Rose Gold", "Brown", "Beige", "Matte Black", "Steel Grey",
      "Stainless Steel", "Chrome", "Natural Wood", "Walnut", "Oak", "Carbon Look",
    ]),
  },
  {
    name: "RAM", code: "ram", categories: ["mobile", "pc"],
    data_type: "multi_select", variant_allowed: true,
    values: toValues(["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB", "24 GB", "32 GB", "64 GB", "128 GB"]),
  },
  {
    name: "Storage", code: "storage", categories: ["mobile", "pc", "gaming"],
    data_type: "multi_select", variant_allowed: true,
    values: toValues(["32 GB", "64 GB", "128 GB", "256 GB", "500 GB", "512 GB", "1 TB", "2 TB", "4 TB"]),
  },
  {
    name: "Screen Size", code: "screen_size", categories: ["mobile", "pc"],
    data_type: "multi_select", unit: "inches",
    values: toValues(['5.0"', '5.5"', '6.0"', '6.1"', '6.3"', '6.5"', '6.7"', '6.9"', '19"', '21.5"', '24"', '27"', '32"', '34"']),
  },
  {
    name: "Screen Resolution", code: "screen_resolution", categories: ["mobile", "pc"],
    data_type: "multi_select",
    values: toValues(["HD", "HD+", "Full HD", "Full HD+", "2K", "4K", "5K"]),
  },
  {
    name: "Power", code: "power", categories: ["pc", "appliances"],
    data_type: "multi_select", unit: "W",
    values: toValues(["100W", "300W", "450W", "500W", "550W", "650W", "750W", "800W", "850W", "1000W", "1500W", "2000W"]),
  },
  {
    name: "Material", code: "material", categories: ["clothing", "footwear", "furniture", "sports", "automotive"],
    data_type: "multi_select",
    values: toValues([
      "Cotton", "Polyester", "Denim", "Linen", "Wool", "Silk", "Leather", "Suede", "Canvas", "Synthetic", "Mesh",
      "Rubber", "Fabric", "Plastic", "ABS Plastic", "Metal", "Stainless Steel", "Aluminum", "Carbon Fiber",
      "Composite", "Glass", "Wood", "Solid Wood", "Engineered Wood",
    ]),
  },
  {
    name: "Gender", code: "gender", categories: ["clothing", "footwear", "beauty", "baby"],
    data_type: "multi_select",
    values: toValues(["Men", "Women", "Unisex", "Kids", "Boy", "Girl"]),
  },
  {
    name: "Season", code: "season", categories: ["clothing", "footwear"],
    data_type: "multi_select",
    values: toValues(["Spring", "Summer", "Autumn", "Winter", "Rainy", "All Season"]),
  },
  {
    name: "Size", code: "size", categories: ["clothing", "baby", "sports"],
    data_type: "multi_select", variant_allowed: true,
    values: toValues([
      "XS", "S", "M", "L", "XL", "XXL", "XXXL",
      "Newborn", "Small", "Medium", "Large", "Extra Large", "Youth Size", "Official Size",
    ]),
  },
  {
    name: "Brand", code: "brand", categories: ["clothing", "footwear", "sports"],
    data_type: "multi_select",
    values: toValues(["Nike", "Adidas", "Levi's"]),
  },
];

// ==========================================
// CATEGORY-SPECIFIC (genuinely unique)
// ==========================================
const SPECIFIC = [
  // MOBILE
  { name: "Battery", code: "mobile_battery", categories: ["mobile"], data_type: "multi_select", unit: "mAh", values: toValues(["3000 mAh", "4000 mAh", "4500 mAh", "5000 mAh", "6000 mAh", "7000 mAh"]) },
  { name: "Camera", code: "mobile_camera", categories: ["mobile"], data_type: "multi_select", values: toValues(["8 MP", "12 MP", "16 MP", "32 MP", "48 MP", "50 MP", "64 MP", "108 MP", "200 MP"]) },
  { name: "Model", code: "mobile_model", categories: ["mobile"], data_type: "multi_select", values: toValues(["A15", "S24", "iPhone 15"]) },
  { name: "Network", code: "mobile_network", categories: ["mobile"], data_type: "multi_select", values: toValues(["2G", "3G", "4G", "5G"]) },
  { name: "SIM", code: "mobile_sim", categories: ["mobile"], data_type: "multi_select", values: toValues(["Single SIM", "Dual SIM"]) },
  { name: "OS", code: "mobile_os", categories: ["mobile"], data_type: "multi_select", values: toValues(["Android", "iOS"]) },

  // PC
  { name: "Processor", code: "pc_processor", categories: ["pc"], data_type: "multi_select", values: toValues(["Core i3", "Core i5", "Core i7", "Core i9", "Ryzen 3", "Ryzen 5", "Ryzen 7", "Ryzen 9"]) },
  { name: "Graphics Card", code: "pc_gpu", categories: ["pc"], data_type: "multi_select", values: toValues(["Integrated", "GTX 1650", "RTX 3050", "RTX 3060", "RTX 4060", "RTX 4070", "RTX 4080", "RTX 4090"]) },
  { name: "Motherboard", code: "pc_motherboard", categories: ["pc"], data_type: "multi_select", values: toValues(["ATX", "Micro-ATX", "Mini-ITX"]) },

  // CLOTHING
  { name: "Fit", code: "clothing_fit", categories: ["clothing"], data_type: "multi_select", values: toValues(["Regular Fit", "Slim Fit", "Relaxed Fit", "Loose Fit", "Oversized"]) },
  { name: "Pattern", code: "clothing_pattern", categories: ["clothing"], data_type: "multi_select", values: toValues(["Plain", "Printed", "Striped", "Checked", "Floral", "Graphic"]) },
  { name: "Sleeve Type", code: "clothing_sleeve_type", categories: ["clothing"], data_type: "multi_select", values: toValues(["Full Sleeve", "Half Sleeve", "Short Sleeve", "Sleeveless"]) },

  // FOOTWEAR
  { name: "Shoe Size (US)", code: "footwear_size_us", categories: ["footwear"], data_type: "multi_select", variant_allowed: true, values: toValues(["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "13"]) },
  { name: "Shoe Size (EU)", code: "footwear_size_eu", categories: ["footwear"], data_type: "multi_select", variant_allowed: true, values: toValues(["38", "39", "40", "41", "42", "43", "44", "45", "46"]) },
  { name: "Sole Type", code: "footwear_sole_type", categories: ["footwear"], data_type: "multi_select", values: toValues(["Rubber", "EVA", "PU", "TPU", "Memory Foam"]) },
  { name: "Closure Type", code: "footwear_closure", categories: ["footwear"], data_type: "multi_select", values: toValues(["Lace-Up", "Slip-On", "Velcro", "Zipper", "Buckle"]) },

  // WATCHES
  { name: "Case Size", code: "watch_case_size", categories: ["watches"], data_type: "multi_select", unit: "mm", values: toValues(["32 mm", "36 mm", "38 mm", "40 mm", "42 mm", "44 mm", "46 mm"]) },
  { name: "Strap Material", code: "watch_strap_material", categories: ["watches"], data_type: "multi_select", variant_allowed: true, values: toValues(["Stainless Steel", "Leather", "Silicone", "Nylon", "Ceramic", "Titanium"]) },
  { name: "Movement Type", code: "watch_movement", categories: ["watches"], data_type: "multi_select", values: toValues(["Quartz", "Automatic", "Manual Wind", "Solar", "Smart"]) },
  { name: "Water Resistance", code: "watch_water_resistance", categories: ["watches"], data_type: "multi_select", values: toValues(["30m", "50m", "100m", "200m", "Dive Rated"]) },
  { name: "Dial Color", code: "watch_dial_color", categories: ["watches"], data_type: "multi_select", variant_allowed: true, values: toValues(["Black", "White", "Blue", "Silver", "Gold", "Green", "Brown"]) },
  { name: "Glass Type", code: "watch_glass", categories: ["watches"], data_type: "multi_select", values: toValues(["Mineral", "Sapphire Crystal", "Acrylic", "Hardened Glass"]) },

  // AUDIO
  { name: "Connectivity", code: "audio_connectivity", categories: ["audio"], data_type: "multi_select", values: toValues(["Bluetooth", "Wired", "USB-C", "Wireless 2.4GHz", "Hybrid"]) },
  { name: "Noise Cancellation", code: "audio_anc", categories: ["audio"], data_type: "boolean", values: YES_NO },
  { name: "Driver Size", code: "audio_driver_size", categories: ["audio"], data_type: "multi_select", unit: "mm", values: toValues(["10 mm", "12 mm", "20 mm", "30 mm", "40 mm", "50 mm"]) },
  { name: "Battery Life", code: "audio_battery", categories: ["audio"], data_type: "multi_select", unit: "hours", values: toValues(["5 hrs", "8 hrs", "10 hrs", "15 hrs", "20 hrs", "30+ hrs"]) },
  { name: "Form Factor", code: "audio_form_factor", categories: ["audio"], data_type: "multi_select", values: toValues(["In-Ear", "Over-Ear", "On-Ear", "Neckband", "True Wireless"]) },

  // APPLIANCES
  { name: "Capacity", code: "appliance_capacity", categories: ["appliances"], data_type: "multi_select", variant_allowed: true, values: toValues(["1 L", "2 L", "5 L", "10 L", "15 L", "20 L", "50 L", "100 L", "200 L", "500 L"]) },
  { name: "Energy Rating", code: "appliance_energy_rating", categories: ["appliances"], data_type: "multi_select", values: toValues(["1 Star", "2 Star", "3 Star", "4 Star", "5 Star", "Inverter"]) },
  { name: "Type", code: "appliance_type", categories: ["appliances"], data_type: "multi_select", values: toValues(["Refrigerator", "Washing Machine", "Microwave", "AC", "Heater", "Blender", "Air Fryer"]) },

  // BEAUTY
  { name: "Skin Type", code: "beauty_skin_type", categories: ["beauty"], data_type: "multi_select", values: toValues(["Normal", "Dry", "Oily", "Combination", "Sensitive", "All Skin Types"]) },
  { name: "Volume / Weight", code: "beauty_volume", categories: ["beauty"], data_type: "multi_select", variant_allowed: true, values: toValues(["15 ml", "30 ml", "50 ml", "100 ml", "200 ml", "500 ml", "1 kg"]) },
  { name: "SPF Level", code: "beauty_spf", categories: ["beauty"], data_type: "multi_select", values: toValues(["SPF 15", "SPF 30", "SPF 50", "SPF 50+", "No SPF"]) },
  { name: "Fragrance", code: "beauty_fragrance", categories: ["beauty"], data_type: "multi_select", values: toValues(["Fragrance Free", "Floral", "Citrus", "Woody", "Vanilla", "Unscented"]) },
  { name: "Key Ingredient", code: "beauty_ingredient", categories: ["beauty"], data_type: "multi_select", values: toValues(["Hyaluronic Acid", "Vitamin C", "Retinol", "Niacinamide", "Salicylic Acid", "Aloe Vera"]) },

  // GAMING
  { name: "Bundle Type", code: "gaming_bundle", categories: ["gaming"], data_type: "multi_select", values: toValues(["Console Only", "With Controller", "Game Bundle", "VR Bundle", "Deluxe Edition"]) },
  { name: "Region", code: "gaming_region", categories: ["gaming"], data_type: "multi_select", values: toValues(["Global", "US", "EU", "Asia", "Japan"]) },
  { name: "Controller Included", code: "gaming_controller", categories: ["gaming"], data_type: "boolean", values: YES_NO },
  { name: "Edition", code: "gaming_edition", categories: ["gaming"], data_type: "multi_select", variant_allowed: true, values: toValues(["Standard", "Digital", "Pro", "Slim", "Limited Edition"]) },

  // FURNITURE
  { name: "Dimensions (LxWxH)", code: "furniture_dimensions", categories: ["furniture"], data_type: "text", values: [] },
  { name: "Assembly Required", code: "furniture_assembly", categories: ["furniture"], data_type: "boolean", values: YES_NO },
  { name: "Weight Capacity", code: "furniture_weight_capacity", categories: ["furniture"], data_type: "multi_select", unit: "kg", values: toValues(["50 kg", "100 kg", "150 kg", "200 kg", "300 kg"]) },
  { name: "Room Type", code: "furniture_room", categories: ["furniture"], data_type: "multi_select", values: toValues(["Living Room", "Bedroom", "Kitchen", "Office", "Bathroom", "Outdoor"]) },

  // BABY
  { name: "Age Range", code: "baby_age_range", categories: ["baby"], data_type: "multi_select", variant_allowed: true, values: toValues(["0-3 Months", "3-6 Months", "6-12 Months", "1-2 Years", "2-4 Years", "4-6 Years"]) },
  { name: "Material Safety", code: "baby_material_safety", categories: ["baby"], data_type: "multi_select", values: toValues(["BPA Free", "Food Grade Silicone", "Organic Cotton", "Hypoallergenic", "Non-Toxic"]) },
  { name: "Washable", code: "baby_washable", categories: ["baby"], data_type: "multi_select", values: [
    { label: "Machine Washable", value: "machine", sort_order: 0, is_active: true },
    { label: "Hand Wash Only", value: "hand", sort_order: 1, is_active: true },
    { label: "Not Washable", value: "no", sort_order: 2, is_active: true },
  ] },

  // SPORTS
  { name: "Sport Type", code: "sports_type", categories: ["sports"], data_type: "multi_select", values: toValues(["Cricket", "Football", "Tennis", "Basketball", "Swimming", "Gym/Fitness", "Cycling"]) },
  { name: "Skill Level", code: "sports_skill_level", categories: ["sports"], data_type: "multi_select", values: toValues(["Beginner", "Intermediate", "Advanced", "Professional"]) },
  { name: "Weight", code: "sports_weight", categories: ["sports"], data_type: "multi_select", unit: "grams", values: toValues(["100g", "200g", "300g", "500g", "1 kg", "2 kg", "5 kg"]) },

  // AUTOMOTIVE
  { name: "Vehicle Compatibility", code: "auto_compatibility", categories: ["automotive"], data_type: "multi_select", values: toValues(["Universal", "Toyota", "Honda", "Ford", "BMW", "Mercedes", "Hyundai", "Kia"]) },
  { name: "Fitment Type", code: "auto_fitment", categories: ["automotive"], data_type: "multi_select", values: toValues(["Direct Replacement", "Universal Fit", "Custom Fit", "Aftermarket"]) },
  { name: "Warranty", code: "auto_warranty", categories: ["automotive"], data_type: "multi_select", values: toValues(["No Warranty", "6 Months", "1 Year", "2 Years", "Lifetime"]) },
];

const ATTRIBUTES_TO_SEED = [...SHARED, ...SPECIFIC];

// Old per-category duplicates -> deactivated after seeding
const LEGACY_CODES = [
  "mobile_ram", "mobile_storage", "mobile_screen_size", "mobile_screen_resolution", "mobile_color",
  "pc_ram", "pc_storage", "pc_power_supply", "pc_color", "pc_screen_size", "pc_screen_resolution",
  "clothing_size", "clothing_color", "clothing_material", "clothing_gender", "clothing_season", "clothing_brand",
  "footwear_gender", "footwear_material", "footwear_season", "footwear_color",
  "appliance_power", "appliance_color",
  "beauty_gender",
  "gaming_storage", "gaming_color",
  "furniture_material", "furniture_color",
  "baby_gender", "baby_size",
  "sports_material", "sports_size",
  "auto_material", "auto_color",
  "audio_color",
];

async function seedAttributes() {
  try {
    console.log("\n🌍 Seeding GLOBAL attributes...");
    let created = 0;
    let updated = 0;

    // sanity check: duplicate codes in config
    const codes = ATTRIBUTES_TO_SEED.map((a) => a.code);
    const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
    if (dupes.length) throw new Error(`Duplicate codes in config: ${dupes.join(", ")}`);

    for (const attr of ATTRIBUTES_TO_SEED) {
      const doc = {
        name: attr.name,
        categories: attr.categories,
        data_type: attr.data_type,
        variant_allowed: attr.variant_allowed ?? false,
        unit: attr.unit || null,
        values: attr.values,
        is_active: true,
      };

      const res = await Attribute.updateOne(
        { code: attr.code },
        { $set: doc, $setOnInsert: { code: attr.code }, $unset: { category: "" } },
        { upsert: true }
      );

      if (res.upsertedCount) {
        created++;
        console.log(`   ✅ Created: ${attr.name} [${attr.categories.join(", ")}]`);
      } else {
        updated++;
      }
    }

    const legacy = await Attribute.updateMany(
      { code: { $in: LEGACY_CODES } },
      { $set: { is_active: false } }
    );

    console.log(
      `\n🎉 Done! Created: ${created}, Updated: ${updated}, Legacy deactivated: ${legacy.modifiedCount}\n`
    );
  } catch (error) {
    console.error("❌ Error in attribute seeding:", error.message);
    throw error;
  }
}

if (require.main === module) {
  const mongoose = require("mongoose");
  require("dotenv").config();

  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ DB Connected for standalone seeding");
      return seedAttributes();
    })
    .catch(() => (process.exitCode = 1))
    .finally(async () => {
      await mongoose.disconnect();
      process.exit();
    });
}

module.exports = { seedAttributes, ATTRIBUTES_TO_SEED };