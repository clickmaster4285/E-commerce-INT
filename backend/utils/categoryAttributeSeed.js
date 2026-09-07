const CATEGORY_ATTRIBUTE_SEED = {
  mobile: [
    { name: "RAM", type: "multi-select", options: ["2 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB", "24 GB"] },
    { name: "RAM Type", type: "multi-select", options: ["LPDDR4", "LPDDR4X", "LPDDR5", "LPDDR5X"] },
    { name: "Storage/ROM", type: "multi-select", options: ["32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"] },
    { name: "Storage Type", type: "multi-select", options: ["eMMC", "UFS 2.2", "UFS 3.1", "UFS 4.0"] },
    { name: "Screen Size", type: "multi-select", options: ["5.0\"", "5.5\"", "6.1\"", "6.3\"", "6.4\"", "6.5\"", "6.7\"", "6.8\"", "6.9\""] },
    { name: "Color", type: "multi-select", options: ["Black", "White", "Blue", "Green", "Red", "Gold", "Silver", "Purple", "Pink", "Grey"] },
    { name: "Battery", type: "multi-select", options: ["3000 mAh", "3500 mAh", "4000 mAh", "4500 mAh", "5000 mAh", "5500 mAh", "6000 mAh"] },
    { name: "Camera", type: "multi-select", options: ["8 MP", "12 MP", "16 MP", "32 MP", "48 MP", "50 MP", "64 MP", "108 MP", "200 MP"] },
    { name: "Network", type: "multi-select", options: ["3G", "4G", "4G LTE", "5G"] },
    { name: "SIM Type", type: "multi-select", options: ["Single SIM", "Dual SIM", "eSIM", "Dual SIM + eSIM"] },
    { name: "OS", type: "multi-select", options: ["Android", "iOS"] }
  ],
  pc: [
    { name: "RAM", type: "multi-select", options: ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB", "128 GB"] },
    { name: "RAM Type", type: "multi-select", options: ["DDR3", "DDR4", "DDR5", "LPDDR4", "LPDDR5", "LPDDR5X"] },
    { name: "Storage", type: "multi-select", options: ["256 GB", "512 GB", "1 TB", "2 TB", "4 TB"] },
    { name: "Storage Type", type: "multi-select", options: ["HDD", "SATA SSD", "NVMe SSD"] },
    { name: "Processor", type: "multi-select", options: ["Intel Core i3", "Intel Core i5", "Intel Core i7", "Intel Core i9", "AMD Ryzen 3", "AMD Ryzen 5", "AMD Ryzen 7", "AMD Ryzen 9"] },
    { name: "Processor Generation", type: "multi-select", options: ["10th Gen", "11th Gen", "12th Gen", "13th Gen", "14th Gen"] },
    { name: "Graphics Card", type: "multi-select", options: ["Integrated", "GTX 1650", "GTX 1660", "RTX 3050", "RTX 3060", "RTX 4060", "RTX 4070", "RTX 4080", "RTX 4090"] },
    { name: "Motherboard", type: "multi-select", options: ["H610", "B660", "B760", "Z690", "Z790", "B550", "B650", "X670"] },
    { name: "Power Supply", type: "multi-select", options: ["450W", "550W", "650W", "750W", "850W", "1000W", "1200W"] },
    { name: "Colour", type: "multi-select", options: ["Black", "White", "Silver", "Grey"] },
    { name: "Screen Size", type: "multi-select", options: ["14\"", "15.6\"", "17.3\"", "21.5\"", "23.8\"", "24\"", "27\"", "32\""] },
    { name: "Screen Resolution", type: "multi-select", options: ["HD", "Full HD", "2K", "QHD", "4K", "5K"] }
  ],
  clothing: [
    { name: "Size", type: "multi-select", options: ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"] },
    { name: "Size Type", type: "multi-select", options: ["Regular", "Petite", "Plus Size", "Tall"] },
    { name: "Color", type: "multi-select", options: ["Black", "White", "Red", "Blue", "Green", "Yellow", "Pink", "Purple", "Grey", "Brown", "Navy", "Beige"] },
    { name: "Material", type: "multi-select", options: ["Cotton", "Polyester", "Denim", "Linen", "Wool", "Leather", "Silk", "Rayon", "Nylon"] },
    { name: "Fit", type: "multi-select", options: ["Slim Fit", "Regular Fit", "Relaxed Fit", "Loose Fit", "Oversized", "Skinny Fit"] },
    { name: "Pattern", type: "multi-select", options: ["Solid", "Striped", "Checked", "Printed", "Floral", "Graphic", "Polka Dot", "Camouflage"] },
    { name: "Gender", type: "multi-select", options: ["Men", "Women", "Unisex", "Kids"] },
    { name: "Sleeve Type", type: "multi-select", options: ["Sleeveless", "Short Sleeve", "Half Sleeve", "3/4 Sleeve", "Full Sleeve"] },
    { name: "Season", type: "multi-select", options: ["Spring", "Summer", "Autumn", "Winter", "All Season"] }
  ]
};

module.exports = { CATEGORY_ATTRIBUTE_SEED };