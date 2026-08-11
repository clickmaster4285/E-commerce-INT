const products = [
  {
    _id: "p1",
    name: "iPhone 15 Pro Max",
    description: "Apple ka flagship smartphone — A17 Pro chip, titanium design aur pro-level camera system ke sath.",
    emoji: "📱",
    discount: "10%",
    category_id: { _id: "c1", name: "Mobiles" },
    brand_id: { _id: "b1", name: "Apple" },
    variants: [
      { _id: "p1v1", sku: "APL-15PM-256", title: "256GB Titanium", selling_price: 399999, cost_price: 360000, quantity: 12, attributes: { Storage: "256GB", Color: "Titanium" }, images: [] },
      { _id: "p1v2", sku: "APL-15PM-512", title: "512GB Black", selling_price: 449999, cost_price: 400000, quantity: 5, attributes: { Storage: "512GB", Color: "Black" }, images: [] },
    ],
  },
  {
    _id: "p2",
    name: "MacBook Air M3",
    description: "Super-light laptop with M3 chip — 18 hours battery aur blazing fast performance.",
    emoji: "💻",
    discount: "15%",
    category_id: { _id: "c2", name: "Laptops" },
    brand_id: { _id: "b1", name: "Apple" },
    variants: [
      { _id: "p2v1", sku: "APL-MBA-M3", title: "8GB / 256GB", selling_price: 320000, cost_price: 290000, quantity: 7, attributes: { RAM: "8GB", SSD: "256GB" }, images: [] },
    ],
  },
  {
    _id: "p3",
    name: "Galaxy Watch Ultra",
    description: "Samsung ki sab se advanced smartwatch — titanium case aur dual-band GPS.",
    emoji: "⌚",
    discount: "20%",
    category_id: { _id: "c3", name: "Smart Watches" },
    brand_id: { _id: "b2", name: "Samsung" },
    variants: [
      { _id: "p3v1", sku: "SAM-GWU-47", title: "47mm Titanium", selling_price: 120000, cost_price: 100000, quantity: 3, attributes: { Size: "47mm" }, images: [] },
    ],
  },
  {
    _id: "p4",
    name: "AirPods Pro 2",
    description: "Active Noise Cancellation aur Adaptive Audio ke sath premium earbuds.",
    emoji: "🎧",
    discount: "12%",
    category_id: { _id: "c4", name: "Accessories" },
    brand_id: { _id: "b1", name: "Apple" },
    variants: [
      { _id: "p4v1", sku: "APL-APP2", title: "USB-C", selling_price: 85000, cost_price: 75000, quantity: 20, attributes: { Type: "USB-C" }, images: [] },
    ],
  },
];

export default products;