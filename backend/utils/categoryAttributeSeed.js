const CATEGORY_ATTRIBUTE_SEED = {
  mobile: [
    { name: "RAM", type: "multi-select", options: ["4GB", "6GB", "8GB", "12GB"] },
    { name: "Storage/ROM", type: "multi-select", options: ["64GB", "128GB", "256GB", "512GB"] },
    { name: "Screen Size", type: "multi-select", options: ["5.5\"", "6.1\"", "6.5\"", "6.7\""] },
    { name: "Color", type: "multi-select", options: ["Black", "White", "Blue", "Green"] },
    { name: "Battery", type: "multi-select", options: ["4000mAh", "4500mAh", "5000mAh", "6000mAh"] },
    { name: "Camera", type: "multi-select", options: ["12MP", "48MP", "50MP", "64MP", "108MP"] },
    { name: "Model", type: "multi-select", options: ["iPhone 15", "iPhone 16", "Galaxy S24", "Galaxy S25"] },
    { name: "Network", type: "multi-select", options: ["4G", "5G"] },
    { name: "SIM", type: "multi-select", options: ["Single SIM", "Dual SIM"] },
    { name: "OS", type: "multi-select", options: ["Android", "iOS"] }
  ],
  pc: [
    { name: "RAM", type: "multi-select", options: ["4GB", "8GB", "16GB", "32GB", "64GB"] },
    { name: "Storage", type: "multi-select", options: ["256GB", "512GB", "1TB", "2TB"] },
    { name: "Processor", type: "multi-select", options: ["Intel Core i3", "i5", "i7", "i9", "AMD Ryzen 3", "Ryzen 5", "Ryzen 7", "Ryzen 9"] },
    { name: "Graphics Card", type: "multi-select", options: ["Integrated", "GTX 1650", "RTX 3050", "RTX 3060", "RTX 4060"] },
    { name: "Motherboard", type: "multi-select", options: ["ASUS", "MSI", "Gigabyte", "ASRock"] },
    { name: "Power Supply", type: "multi-select", options: ["450W", "550W", "650W", "750W", "850W"] },
    { name: "Colour", type: "multi-select", options: ["Black", "White", "Silver"] },
    { name: "Screen Size", type: "multi-select", options: ["14\"", "15.6\"", "17.3\""] },
    { name: "Screen Resolution", type: "multi-select", options: ["HD", "Full HD", "2K", "4K"] }
  ],
  clothing: [
    { name: "Size", type: "multi-select", options: ["XS", "S", "M", "L", "XL", "XXL"] },
    { name: "Color", type: "multi-select", options: ["Red", "Blue", "Black", "White", "Green"] },
    { name: "Material", type: "multi-select", options: ["Cotton", "Polyester", "Denim", "Wool", "Linen"] },
    { name: "Fit", type: "multi-select", options: ["Slim Fit", "Regular Fit", "Loose Fit", "Oversized"] },
    { name: "Pattern", type: "multi-select", options: ["Plain", "Striped", "Checked", "Printed", "Floral"] },
    { name: "Gender", type: "multi-select", options: ["Men", "Women", "Unisex"] },
    { name: "Sleeve Type", type: "multi-select", options: ["Full Sleeve", "Half Sleeve", "Sleeveless"] },
    { name: "Season", type: "multi-select", options: ["Summer", "Winter", "Spring", "All Season"] }
  ]
};

module.exports = { CATEGORY_ATTRIBUTE_SEED };