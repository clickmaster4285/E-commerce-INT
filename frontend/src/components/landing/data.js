/* =====================================================================
   Click Master Store — PLACEHOLDER DATA  (clearly marked, replace with API)
   Images: /public/landing/placeholder-N.svg — sample art, NOT real product
   photos. TODO(api): wire products/cats to the real catalog endpoints.
   ===================================================================== */
export const BRANDS = [
  "Samsung", "Haier", "PEL", "TCL", "Oppo", "Vivo", "Xiaomi", "Dyson",
  "Philips", "Dawlance", "Surf Excel", "Khaadi",
];

export const CATEGORIES = [
  { name: "Mobiles & Gadgets", icon: "smartphone", slug: "mobiles" },
  { name: "Fashion", icon: "shirt", slug: "fashion" },
  { name: "Home & Kitchen", icon: "home", slug: "home-kitchen" },
  { name: "Beauty & Care", icon: "sparkles", slug: "beauty" },
  { name: "Sports & Fitness", icon: "dumbbell", slug: "sports" },
  { name: "Books & Stationery", icon: "book", slug: "books" },
  { name: "Kids & Baby", icon: "baby", slug: "kids" },
  { name: "Automotive", icon: "car", slug: "automotive" },
];

export const FLASH_DEALS = [
  { id: "deal-1", name: "Wireless Earbuds Pro X2", category: "Gadgets", price: 2499, oldPrice: 4999, rating: 4.7, reviews: 1284, img: "/landing/placeholder-1.svg", badge: "-50%" },
  { id: "deal-2", name: "SMART LED 32\" HD TV", category: "Electronics", price: 32999, oldPrice: 45999, rating: 4.6, reviews: 842, img: "/landing/placeholder-2.svg", badge: "-28%" },
  { id: "deal-3", name: "Stainless Steel Cookware 12pc", category: "Home & Kitchen", price: 8999, oldPrice: 14999, rating: 4.8, reviews: 2310, img: "/landing/placeholder-3.svg", badge: "-40%" },
  { id: "deal-4", name: "Anti-Aging Serum 30ml", category: "Beauty", price: 1850, oldPrice: 2600, rating: 4.5, reviews: 967, img: "/landing/placeholder-4.svg", badge: "-29%" },
  { id: "deal-5", name: "Men's Casual Sneakers", category: "Fashion", price: 3299, oldPrice: 6500, rating: 4.4, reviews: 1750, img: "/landing/placeholder-5.svg", badge: "-49%" },
  { id: "deal-6", name: "Smart Watch Fit 3", category: "Gadgets", price: 5499, oldPrice: 9999, rating: 4.6, reviews: 3120, img: "/landing/placeholder-6.svg", badge: "-45%" },
];

export const FEATURED_PRODUCTS = [
  { id: "feat-1", name: "Dawlance Microwave 25L", category: "Home Appliances", price: 28999, oldPrice: 34500, rating: 4.7, reviews: 640, img: "/landing/placeholder-7.svg" },
  { id: "feat-2", name: "Samsung Galaxy A15 128GB", category: "Mobiles", price: 44999, rating: 4.8, reviews: 5210, img: "/landing/placeholder-8.svg" },
  { id: "feat-3", name: "Khaadi Printed Kurta", category: "Fashion", price: 3999, oldPrice: 5499, rating: 4.6, reviews: 1890, img: "/landing/placeholder-9.svg" },
  { id: "feat-4", name: "PEL Inverter AC 1.5 Ton", category: "Home Appliances", price: 189999, oldPrice: 225000, rating: 4.9, reviews: 320, img: "/landing/placeholder-10.svg" },
  { id: "feat-5", name: "Organic Herbal Hair Oil", category: "Beauty & Care", price: 950, rating: 4.3, reviews: 2760, img: "/landing/placeholder-11.svg" },
  { id: "feat-6", name: "Gold Gym Dumbbells 20kg", category: "Sports & Fitness", price: 7499, oldPrice: 9999, rating: 4.7, reviews: 1130, img: "/landing/placeholder-12.svg" },
  { id: "feat-7", name: "Non-Stick Fry Pan 26cm", category: "Home & Kitchen", price: 2150, rating: 4.5, reviews: 3440, img: "/landing/placeholder-13.svg" },
  { id: "feat-8", name: "Baby Stroller Lightweight", category: "Kids & Baby", price: 15500, oldPrice: 21000, rating: 4.8, reviews: 720, img: "/landing/placeholder-14.svg" },
];

export const TESTIMONIALS = [
  { name: "Ayesha Khan", city: "Lahore", rating: 5, initials: "AK", text: "Ordered a smart watch at midnight and it was at my doorstep next evening. Sealed box, bill attached — trustworthy log jaise behar!" },
  { name: "Bilal Sheikh", city: "Karachi", rating: 5, initials: "BS", text: "COD option ne dar khatam kar diya. Paise tab diye jab product dekh liya. Return process bhi 7 din ke andar ho gaya." },
  { name: "Fatima Noor", city: "Islamabad", rating: 4, initials: "FN", text: "Kitchen bundle 40% off mein li. Quality retail se behtar nikli aur price bhi kam. Must buy for newlyweds!" },
  { name: "Usman Tariq", city: "Faisalabad", rating: 5, initials: "UT", text: "Customer support ne phone call pe setup guide kar diya. After-sale service is genuinely 10/10." },
  { name: "Hira Butt", city: "Multan", rating: 5, initials: "HB", text: "Flash deals roz follow karti hoon. Earbuds half price pe mile — sound is premium. Highly recommended!" },
  { name: "Ahmed Raza", city: "Peshawar", rating: 4, initials: "AR", text: "Invoice har order ke sath attached hoti hai, glitch-free app, aur delivery tracking live milti hai. Solid experience." },
];

export const STATS = [
  { value: 250000, suffix: "+", label: "Happy Customers" },
  { value: 1200000, suffix: "+", label: "Orders Delivered" },
  { value: 45000, suffix: "+", label: "Products Listed" },
  { value: 120, suffix: "+", label: "Cities Served" },
];

export const WHATSAPP_NUMBER = "923001234567"; // PLACEHOLDER — replace with real support number

export const formatPrice = (n) => `Rs. ${Number(n).toLocaleString("en-PK")}`;
