/**
 * ==========================================
 * COMPREHENSIVE SEED SCRIPT
 * Generates 1000+ Brands, Categories, Products+Variants,
 * Attributes (uses existing), Discounts, Deals, Banners
 * ==========================================
 * 
 * Run: node backend/scripts/seedAllData.js
 * 
 * NOTE: This script is STANDALONE - it does NOT modify any existing code.
 * It connects to MongoDB and inserts seed data directly.
 */

const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const Brand = require("../models/brand");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Attribute = require("../models/Attribute");
const Discount = require("../models/Discount");
const Deal = require("../models/Deal");
const Banner = require("../models/Banner");
const Tag = require("../models/Tag");
const Employee = require("../models/Employee");

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomFloat = (min, max, decimals = 2) => +(Math.random() * (max - min) + min).toFixed(decimals);

const generateCode = (prefix, index) => `${prefix}${String(index).padStart(5, "0")}`;

const generateSKU = (brandCode, productCode, index) => {
  return `${brandCode}-${productCode}-${String(index).padStart(3, "0")}`;
};

// Placeholder image URLs (using picsum.photos for realistic images)
const getPlaceholderImage = (seed, width = 400, height = 400) => {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
};

const getBrandLogo = (brandName) => {
  const slug = brandName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  return `https://picsum.photos/seed/${slug}-logo/200/200`;
};

const getProductImage = (productName, index = 0) => {
  const slug = productName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  return `https://picsum.photos/seed/${slug}-${index}/600/600`;
};

const getBannerImage = (title, type = "desktop") => {
  const slug = title.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const width = type === "desktop" ? 1920 : 768;
  const height = type === "desktop" ? 600 : 400;
  return `https://picsum.photos/seed/${slug}-${type}/${width}/${height}`;
};

// ==========================================
// DATA GENERATORS
// ==========================================

// --- BRAND NAMES (1000+) ---
const BRAND_NAMES = [
  // Electronics
  "Apple", "Samsung", "Sony", "LG", "Panasonic", "Philips", "Bosch", "Siemens",
  "Toshiba", "Sharp", "Hitachi", "Mitsubishi", "Fujitsu", "Lenovo", "Dell",
  "HP", "Asus", "Acer", "MSI", "Razer", "Google", "OnePlus", "Xiaomi",
  "Huawei", "Oppo", "Vivo", "Realme", "Nothing", "Motorola", "Nokia",
  "BlackBerry", "HTC", "ZTE", "Alcatel", "TCL", "Honor", "iQOO",
  "Poco", "Infinix", "Tecno", "Itel", "Lava", "Micromax", "Karbonn",
  "Celkon", "Intex", "Videocon", "Onida", "BPL", "Croma", "Flipkart",
  "AmazonBasics", "Belkin", "Anker", "Baseus", "UGREEN", "Spigen",
  "OtterBox", "Ringke", "ELECOM", "Logitech", "Razer", "SteelSeries",
  "Corsair", "Kingston", "Crucial", "Western Digital", "Seagate",
  "SanDisk", "Toshiba", "PNY", "Gigabyte", "ASRock", "EVGA",
  "Thermaltake", "Cooler Master", "NZXT", "Fractal Design", "be quiet!",
  "Corsair", "HyperX", "Astro", "Turtle Beach", "Plantronics",
  "Jabra", "Bose", "Sennheiser", "Audio-Technica", "Shure",
  "AKG", "Beats", "Skullcandy", "JBL", "Marshall", "Bang & Olufsen",
  "KEF", "Bowers & Wilkins", "Sonos", "Yamaha", "Denon", "Marantz",
  "Pioneer", "Onkyo", "NAD", "Cambridge Audio", "Rega", "Pro-Ject",
  
  // Fashion & Apparel
  "Nike", "Adidas", "Puma", "Reebok", "New Balance", "Converse",
  "Vans", "Under Armour", "Levi's", "Zara", "H&M", "GAP",
  "Uniqlo", "Mango", "Primark", "Topshop", "ASOS", "Boohoo",
  "PrettyLittleThing", "Shein", "SHEIN", "Romwe", "Dresslily",
  "Chicme", "LimeLily", "NovaBlossom", "Edikted", "Public Desire",
  "Nasty Gal", "Missguided", "JD Sports", "Foot Locker",
  "DSW", "Office", "Schuh", "Size?", "END.", "Sneakersnstuff",
  "Kith", "Stüssy", "Supreme", "BAPE", "Off-White", "Fear of God",
  "Palace", "Carhartt WIP", "The North Face", "Patagonia", "Columbia",
  "Arc'teryx", "Mammut", "Jack Wolfskin", "Helly Hansen",
  "Ralph Lauren", "Tommy Hilfiger", "Calvin Klein", "Guess",
  "Versace", "Gucci", "Prada", "Louis Vuitton", "Burberry",
  "Chanel", "Dior", "Fendi", "Balenciaga", "Valentino",
  "Armani", "Hugo Boss", "Diesel", "True Religion",
  
  // Home & Kitchen
  "IKEA", "Ashley Furniture", "Wayfair", "West Elm", "Pottery Barn",
  "Crate & Barrel", "Restoration Hardware", "CB2", "Urban Outfitters",
  "Target", "Walmart", "Costco", "Sam's Club", "BJ's",
  "KitchenAid", "Cuisinart", "Ninja", "Vitamix", "Blendtec",
  "Breville", "De'Longhi", "Keurig", "Nespresso", "Hamilton Beach",
  "Oster", "BLACK+DECKER", "Dyson", "Shark", "Miele",
  "Electrolux", "Whirlpool", "Maytag", "GE Appliances", "Frigidaire",
  "LG Electronics", "Samsung", "Bosch", "Kenmore", "Hotpoint",
  "Instant Pot", "Ninja Foodi", "Cosori", "GoWISE", "Philips",
  
  // Beauty & Personal Care
  "L'Oréal", "Estée Lauder", "Procter & Gamble", "Unilever", "Johnson & Johnson",
  "Revlon", "Maybelline", "NYX", "MAC", "Urban Decay",
  "Too Faced", "Benefit", "NARS", "Clinique", "Estee Lauder",
  "Clinique", "La Mer", "SK-II", "Shiseido", "Sulwhasoo",
  "Innisfree", "Laneige", "Etude House", "Missha", "The Face Shop",
  "Neutrogena", "Olay", "CeraVe", "La Roche-Posay", "Vichy",
  "Avène", "Bioderma", "Nivea", "Dove", "Axe",
  "Old Spice", "Degree", "Secret", "Gillette", "Schick",
  "Braun", "Philips", "Oral-B", "Colgate", "Sensodyne",
  
  // Sports & Outdoors
  "Nike", "Adidas", "Puma", "Under Armour", "New Balance",
  "Asics", "Brooks", "Saucony", "Mizuno", "Hoka",
  "Garmin", "Polar", "Suunto", "Fitbit", "Whoop",
  "Peloton", "NordicTrack", "ProForm", "Bowflex", "TRX",
  "Wilson", "Head", "Babolat", "Yonex", "Prince",
  "Spalding", "Molten", "Baden", "Mikasa", "Select",
  "Everlast", "TITLE Boxing", "Ringside", "Venum", "Hayabusa",
  "Fuji Mats", "Century", "Sanabul", "RDX", "Lonsdale",
  
  // Automotive
  "Toyota", "Honda", "Ford", "Chevrolet", "Nissan",
  "Hyundai", "Kia", "Volkswagen", "BMW", "Mercedes-Benz",
  "Audi", "Lexus", "Mazda", "Subaru", "Mitsubishi",
  "Jeep", "Ram", "GMC", "Cadillac", "Lincoln",
  "Acura", "Infiniti", "Genesis", "Volvo", "Saab",
  "Porsche", "Ferrari", "Lamborghini", "Maserati", "Alfa Romeo",
  "Fiat", "Peugeot", "Renault", "Citroën", "Opel",
  "Skoda", "SEAT", "Cupra", "Dacia", "Lada",
  
  // Toys & Games
  "LEGO", "Mattel", "Hasbro", "Bandai", "Namco",
  "Nintendo", "Sega", "Atari", "Funko", "NECA",
  "Hot Wheels", "Matchbox", "Tonka", "Thomas & Friends", "VTech",
  "LeapFrog", "Melissa & Doug", "Playmobil", "Schleich", "Bruder",
  
  // Books & Stationery
  "Pilot", "Pelikan", "Lamy", "Montblanc", "Cross",
  "Parker", "Waterman", "Faber-Castell", "Staedtler", "Rotring",
  "Moleskine", "Leuchtturm1917", "Rhodia", "Clairefontaine", "Midori",
  "3M", "Scotch", "Post-it", "Sharpie", "Bic",
  
  // Pet Supplies
  "Pedigree", "Whiskas", "Royal Canin", "Hill's", "Purina",
  "Blue Buffalo", "Merrick", "Taste of the Wild", "Orijen", "Acana",
  "KONG", "Nylabone", "Chuckit!", "Frisbee", "PetSafe",
  "Seresto", "Frontline", "Advantage", "Revolution", "Heartgard",
  
  // Health & Wellness
  "Nature Made", "Garden of Life", "NOW Foods", "Optimum Nutrition",
  "MuscleTech", "BSN", "Cellucor", "Dymatize", "Myprotein",
  "Quest Nutrition", "RXBAR", "Clif Bar", "Kind Bar", "Larabar",
  "Vital Proteins", "Sports Research", "Nordic Naturals", "Nature's Bounty",
  
  // Additional variety to reach 1000+
  "Aeropostale", "American Eagle", "Banana Republic", "Brooks Brothers",
  "Burlington", "Carter's", "Chico's", "Children's Place",
  "Coach", "Cole Haan", "David Yurman", "Dillard's",
  "DKNY", "Dolce & Gabbana", "Eddie Bauer", "Express",
  "Forever 21", "Free People", "Fossil", "Gap",
  "Gymboree", "Hugo Boss", "J.Crew", "Kate Spade",
  "Kenneth Cole", "Lucky Brand", "Lululemon", "Macy's",
  "Michael Kors", "Nike", "Nordstrom", "Old Navy",
  "Omega", "OshKosh B'gosh", "Perry Ellis", "Polo Ralph Lauren",
  "Quicksilver", "Roxy", "Saks Fifth Avenue", "Steve Madden",
  "Stuart Weitzman", "Talbots", "Tiffany & Co", "Timberland",
  "Tory Burch", "Trader Joe's", "UGG", "Under Armour",
  "Urban Outfitters", "Vans", "Victoria's Secret", "Walmart",
  "Yves Saint Laurent", "Zara",
  
  // More electronics/tech
  "Altec Lansing", "Bowers & Wilkins", "Creative", "Edifier",
  "FiiO", "Focal", "Jamo", "Klipsch", "Monitor Audio",
  "NAD", "Q Acoustics", "Tannoy", "Wharfedale",
  "AMD", "Intel", "NVIDIA", "Qualcomm", "MediaTek",
  "Arduino", "Raspberry Pi", "Adafruit", "SparkFun",
  "TP-Link", "Netgear", "Ubiquiti", "Linksys", "Asus",
  "Cisco", "D-Link", "MikroTik", "Synology", "QNAP",
  
  // More home/kitchen
  "All-Clad", "Calphalon", "Cuisinart", "Farberware", "Le Creuset",
  "Lodge", "Staub", "T-fal", "Zwilling", "Wüsthof",
  "Shun", "Global", "Victorinox", "Henckels", "Fissler",
  "Pyrex", "Anchor Hocking", "CorningWare", "Emile Henry", "Stoneware",
  
  // More beauty
  "Anastasia Beverly Hills", "Charlotte Tilbury", "Fenty Beauty",
  "Glossier", "Huda Beauty", "IT Cosmetics", "Kiehl's",
  "Laura Mercier", "Origins", "Sunday Riley", "Tatcha",
  "The Ordinary", "Paula's Choice", "Drunk Elephant", "Tatcha",
  "Fresh", "Glamglow", "Peter Thomas Roth", "First Aid Beauty",
  
  // More outdoor
  "Black Diamond", "CamelBak", "Osprey", "Gregory", "Deuter",
  "Sea to Summit", "Therm-a-Rest", "REI Co-op", "Kelty", "Marmot",
  "Mountain Hardwear", "Columbia", "North Face", "Mountain Hardwear",
  "Smartwool", "Icebreaker", "Buff", "Castelli", "Rapha",
  
  // Baby & Kids
  "Bugaboo", "Cybex", "Graco", "Chicco", "Peg Perego",
  "Britax", "Maxi-Cosi", "UPPAbaby", "Stokke", "Baby Jogger",
  "Fisher-Price", "Skip Hop", "Baby Björn", "Aden + Anais", "Halo",
  "Pampers", "Huggies", "Luvs", "Seventh Generation", "Earth's Best",
  
  // More variety
  "Yeti", "RTIC", "Hydro Flask", "S'well", "Contigo",
  "Tervis", "CamelBak", "Stanley", "Zojirushi", "Thermos",
  "Brita", "PUR", "ZeroWater", "Aqua-Pure", "3M",
  "Filtrete", "Honeywell", "AprilAire", "Lennox", "Carrier",
  "Trane", "Rheem", "Rinnai", "Navien", "A.O. Smith",
  "Bradford White", "GE", "Westinghouse", "Frigidaire", "Haier",
  "Hisense", "TCL", "Vizio", "Element", "Insignia",
  "Roku", "Amazon Fire TV", "Apple TV", "Chromecast", "NVIDIA Shield",
  "Sonos", "Bose", "JBL", "Harman Kardon", "Ultimate Ears",
  "Sennheiser", "Beyerdynamic", "HiFiMAN", "Audeze", "Focal",
  
  // More fashion (international)
  "Ted Baker", "Mulberry", "Burberry", "Paul Smith", "Dunhill",
  "Alexander McQueen", "Balmain", "Givenchy", "Celine", "Loewe",
  "Bottega Veneta", "Max Mara", "Etro", "Missoni", "Roberto Cavalli",
  "Moschino", "Dolce & Gabbana", "Versace", "Emporio Armani", "Giorgio Armani",
  
  // Additional unique brands
  "Action", "Decathlon", "Billa", "Lidl", "Aldi",
  "Carrefour", "Tesco", "Sainsbury's", "Asda", "Morrisons",
  "Waitrose", "Marks & Spencer", "John Lewis", "Harrods", "Selfridges",
  "Nordstrom", "Bloomingdale's", "Saks", "Neiman Marcus", "Bergdorf Goodman",
  "Net-a-Porter", "Farfetch", "Mytheresa", "Luisaviaroma", "24S",
  
  // More tech
  "Nothing", "Essential", "Fairphone", "Shift", "Purism",
  "System76", "Starlabs", "TUXEDO", "Framework", "GPD",
  "AYANOGaming", "Retroid", "Anbernic", "Miyoo", "PowKiddy",
  
  // Food & Beverage (for snack/drink categories)
  "Coca-Cola", "PepsiCo", "Nestlé", "Mars", "Kellogg's",
  "General Mills", "Kraft Heinz", "Mondelez", "Danone", "McCormick",
  "Red Bull", "Monster", "Rockstar", "Bang", "Celsius",
  "Starbucks", "Dunkin'", "Tim Hortons", "Costa Coffee", "Peet's",
  "Lavazza", "Illy", "L'OR", "Nespresso", "Keurig",
  "Ben & Jerry's", "Häagen-Dazs", "Breyers", "Talenti", "Halo Top",
  "Lay's", "Doritos", "Cheetos", "Fritos", "Tostitos",
  "Oreo", "Chips Ahoy", "Ritz", "Triscuit", "Wheat Thins",
  
  // Software & Services (for digital products if needed)
  "Microsoft", "Adobe", "Autodesk", "Intuit", "Salesforce",
  "Oracle", "SAP", "VMware", "Citrix", "Cisco",
  
  // More variety to hit 1000+
  "Bata", "Liberty", "Red Tape", "Clarks", "Woodland",
  "Allen Solly", "Peter England", "Van Heusen", "Louis Philippe", "Armani Exchange",
  "Marks & Spencer", "Hawkins", "Prestige", "Butterfly", "Borosil",
  "Milton", "Cello", "Nayasa", "Milton", "Signoraware",
  "Vigo", "Prestige", "Hawkins", "Bergner", "Futura",
  "Tramontina", "Tvs", "Prestige", "Bajaj", "Havells",
  "Philips", "Syska", "Wipro", "Crompton", "Anchor",
  "Finolex", "Polycab", "Havells", "Legrand", "Schneider",
  "ABB", "Siemens", "Eaton", "LS Electric", "Delta",
  
  // More unique additions
  "Aldo", "Steve Madden", "Clarks", "Dr. Martens", "Timberland",
  "Birkenstock", "Crocs", "Teva", "Chaco", "Merrell",
  "Salomon", "Keen", "Ecco", "Geox", "Skechers",
  "Cole Haan", "Florsheim", "Johnston & Murphy", "Bruno Magli",
  "Jimmy Choo", "Manolo Blahnik", "Christian Louboutin", "Stuart Weitzman",
  
  // More home
  "Cuisinart", "KitchenAid", "Smeg", "Falcon", "AGA",
  "La Cornue", "Gaggenau", "Miele", "Liebherr", "Sub-Zero",
  "Wolf", "Thermador", "Bosch", "Fisher & Paykel", "Breville",
  
  // More variety
  "Yeti", "Pelican", "Nanuk", "SKB", "Gator",
  "Mono", "Hilton", "Hyatt", "Marriott", "IHG",
  "Four Seasons", "Ritz-Carlton", "Westin", "Sheraton", "Hilton",
  
  // Final push to 1000+
  "Abbott", "Baxter", "BD", "B. Braun", "Cardinal Health",
  "Dentsply", "Henry Schein", "Medline", "Stryker", "Zimmer",
  "Coloplast", "ConvaTec", "Ethicon", "Karl Storz", "Olympus",
  "Pfizer", "Roche", "Novartis", "Merck", "AstraZeneca",
  "Bayer", "Sanofi", "GlaxoSmithKline", "Eli Lilly", "Amgen",
];

const CATEGORIES = [
  { name: "Electronics", code: "ELEC", parent: null },
  { name: "Mobile Phones", code: "MOB", parent: "ELEC" },
  { name: "Laptops", code: "LAP", parent: "ELEC" },
  { name: "Desktop PCs", code: "DESK", parent: "ELEC" },
  { name: "Tablets", code: "TAB", parent: "ELEC" },
  { name: "Wearables", code: "WEAR", parent: "ELEC" },
  { name: "Audio", code: "AUDIO", parent: "ELEC" },
  { name: "Cameras", code: "CAM", parent: "ELEC" },
  { name: "TV & Video", code: "TV", parent: "ELEC" },
  { name: "Home Appliances", code: "APP", parent: null },
  { name: "Kitchen Appliances", code: "KAPP", parent: "APP" },
  { name: "Cleaning Appliances", code: "CAPP", parent: "APP" },
  { name: "Climate Control", code: "CLIM", parent: "APP" },
  { name: "Fashion", code: "FASH", parent: null },
  { name: "Men's Clothing", code: "MCLT", parent: "FASH" },
  { name: "Women's Clothing", code: "WCLT", parent: "FASH" },
  { name: "Kids Clothing", code: "KCLT", parent: "FASH" },
  { name: "Footwear", code: "FOOT", parent: "FASH" },
  { name: "Accessories", code: "ACC", parent: "FASH" },
  { name: "Jewelry", code: "JEW", parent: "FASH" },
  { name: "Watches", code: "WATCH", parent: "FASH" },
  { name: "Home & Living", code: "HOME", parent: null },
  { name: "Furniture", code: "FURN", parent: "HOME" },
  { name: "Bedding", code: "BED", parent: "HOME" },
  { name: "Kitchenware", code: "KITCH", parent: "HOME" },
  { name: "Home Decor", code: "DECOR", parent: "HOME" },
  { name: "Lighting", code: "LIGHT", parent: "HOME" },
  { name: "Beauty & Personal Care", code: "BEAUTY", parent: null },
  { name: "Skincare", code: "SKIN", parent: "BEAUTY" },
  { name: "Haircare", code: "HAIR", parent: "BEAUTY" },
  { name: "Makeup", code: "MAKEUP", parent: "BEAUTY" },
  { name: "Fragrances", code: "FRAG", parent: "BEAUTY" },
  { name: "Health & Wellness", code: "HLTH", parent: "BEAUTY" },
  { name: "Sports & Outdoors", code: "SPORT", parent: null },
  { name: "Fitness Equipment", code: "FIT", parent: "SPORT" },
  { name: "Outdoor Gear", code: "OUTD", parent: "SPORT" },
  { name: "Team Sports", code: "TSPRT", parent: "SPORT" },
  { name: "Water Sports", code: "WSPT", parent: "SPORT" },
  { name: "Cycling", code: "CYC", parent: "SPORT" },
  { name: "Automotive", code: "AUTO", parent: null },
  { name: "Car Accessories", code: "CAR", parent: "AUTO" },
  { name: "Motorcycle Gear", code: "MOTO", parent: "AUTO" },
  { name: "Tools & Equipment", code: "TOOL", parent: "AUTO" },
  { name: "Toys & Games", code: "TOYS", parent: null },
  { name: "Board Games", code: "BOARD", parent: "TOYS" },
  { name: "Action Figures", code: "FIG", parent: "TOYS" },
  { name: "Building Toys", code: "BUILD", parent: "TOYS" },
  { name: "Educational Toys", code: "EDUTOY", parent: "TOYS" },
  { name: "Books & Stationery", code: "BOOK", parent: null },
  { name: "Fiction Books", code: "FIC", parent: "BOOK" },
  { name: "Non-Fiction Books", code: "NONFIC", parent: "BOOK" },
  { name: "Office Supplies", code: "OFFICE", parent: "BOOK" },
  { name: "Pet Supplies", code: "PET", parent: null },
  { name: "Dog Supplies", code: "DOG", parent: "PET" },
  { name: "Cat Supplies", code: "CAT", parent: "PET" },
  { name: "Baby Products", code: "BABY", parent: null },
  { name: "Baby Gear", code: "BGEAR", parent: "BABY" },
  { name: "Baby Clothing", code: "BCLT", parent: "BABY" },
  { name: "Nursery", code: "NURS", parent: "BABY" },
  { name: "Food & Beverages", code: "FOOD", parent: null },
  { name: "Snacks", code: "SNACK", parent: "FOOD" },
  { name: "Beverages", code: "BEV", parent: "FOOD" },
  { name: "Grocery", code: "GROC", parent: "FOOD" },
];

const COLORS = ["Black", "White", "Blue", "Red", "Green", "Silver", "Gold", "Purple", "Pink", "Grey", "Navy", "Brown", "Beige", "Orange", "Yellow", "Teal", "Maroon", "Olive", "Coral", "Lavender"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const SHOE_SIZES = ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12"];
const MATERIALS = ["Cotton", "Polyester", "Denim", "Leather", "Silk", "Wool", "Nylon", "Spandex", "Linen", "Canvas", "Suede", "Rubber", "Plastic", "Metal", "Wood", "Glass", "Ceramic"];
const COUNTRIES = ["USA", "UK", "Germany", "France", "Japan", "China", "South Korea", "Italy", "Spain", "Canada", "Australia", "India", "Pakistan", "Brazil", "Mexico", "Netherlands", "Sweden", "Switzerland", "Austria", "Belgium"];

const DISCOUNT_TYPES = ["percentage", "fixed", "fixed_price"];
const DEAL_TYPES = ["percentage", "fixed_amount", "buy_x_get_y", "bundle", "free_shipping"];
const BANNER_TYPES = ["homepage_hero", "promotional", "product", "collection", "popup"];
const BANNER_PAGES = ["homepage", "category", "product", "cart", "checkout"];

// ==========================================
// SEED FUNCTIONS
// ==========================================

async function seedBrands() {
  console.log("\n🏭 Seeding Brands...");
  const brands = [];
  const uniqueBrands = [...new Set(BRAND_NAMES)];
  
  for (let i = 0; i < Math.max(1000, uniqueBrands.length); i++) {
    const name = i < uniqueBrands.length ? uniqueBrands[i] : `Brand ${String(i + 1).padStart(4, "0")}`;
    const brandCode = generateCode("BR", i + 1);
    
    brands.push({
      brand_code: brandCode,
      name: name,
      description: `${name} is a leading brand known for quality products.`,
      logo: {
        img_url: getBrandLogo(name),
        img_size: randomInt(10, 500),
        mimeType: "image/jpeg",
        width: 200,
        height: 200,
      },
      country: randomItem(COUNTRIES),
      is_active: true,
      is_deleted: false,
    });
  }
  
  // Batch insert for performance
  const existingCount = await Brand.countDocuments({ is_deleted: false });
  if (existingCount >= 1000) {
    console.log(`   ⏭️  Skipping - ${existingCount} brands already exist`);
    return await Brand.find({ is_deleted: false }).select("_id name brand_code").lean();
  }
  
  await Brand.deleteMany({});
  const result = await Brand.insertMany(brands, { ordered: false });
  console.log(`   ✅ Created ${result.length} brands`);
  return result;
}

async function seedCategories() {
  console.log("\n📂 Seeding Categories...");
  
  const existingCount = await Category.countDocuments({ is_deleted: false });
  if (existingCount >= 60) {
    console.log(`   ⏭️  Skipping - ${existingCount} categories already exist`);
    return await Category.find({ is_deleted: false }).select("_id name category_code parent_category_id").lean();
  }
  
  await Category.deleteMany({});
  
  // First pass: create parent categories
  const parentCategories = {};
  for (const cat of CATEGORIES.filter(c => c.parent === null)) {
    const doc = await Category.create({
      category_code: cat.code,
      name: cat.name,
      description: `Shop ${cat.name} products`,
      parent_category_id: null,
      is_active: true,
      is_deleted: false,
    });
    parentCategories[cat.code] = doc._id;
  }
  
  // Second pass: create child categories
  const allCategories = [];
  for (const cat of CATEGORIES.filter(c => c.parent !== null)) {
    const doc = await Category.create({
      category_code: cat.code,
      name: cat.name,
      description: `Shop ${cat.name} products`,
      parent_category_id: parentCategories[cat.parent] || null,
      is_active: true,
      is_deleted: false,
    });
    allCategories.push(doc);
  }
  
  const result = await Category.find({ is_deleted: false }).select("_id name category_code parent_category_id").lean();
  console.log(`   ✅ Created ${result.length} categories`);
  return result;
}

async function seedTags() {
  console.log("\n🏷️  Seeding Tags...");
  
  const tagNames = [
    "bestseller", "new arrival", "trending", "sale", "limited edition",
    "premium", "budget", "eco-friendly", "organic", "handmade",
    "exclusive", "popular", "featured", "recommended", "top rated",
    "clearance", "seasonal", "holiday", "gift idea", "must have",
    "classic", "modern", "vintage", "retro", "minimalist",
    "luxury", "affordable", "durable", "lightweight", "portable",
    "wireless", "waterproof", "rechargeable", "smart", "premium quality",
    "value pack", "bulk deal", "family size", "compact", "professional",
    "beginner friendly", "advanced", "heavy duty", "ultra thin", "extra strong",
    "fast shipping", "free returns", "warranty included", "certified", "tested",
  ];
  
  const existingCount = await Tag.countDocuments({ is_deleted: false });
  if (existingCount >= 40) {
    console.log(`   ⏭️  Skipping - ${existingCount} tags already exist`);
    return await Tag.find({ is_deleted: false }).select("_id name").lean();
  }
  
  await Tag.deleteMany({});
  const tags = tagNames.map(name => ({
    name: name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    is_deleted: false,
  }));
  
  const result = await Tag.insertMany(tags);
  console.log(`   ✅ Created ${result.length} tags`);
  return result;
}

async function seedProducts(brands, categories, tags) {
  console.log("\n📦 Seeding Products & Variants...");
  
  const existingProducts = await Product.countDocuments({ is_deleted: false });
  if (existingProducts >= 1000) {
    console.log(`   ⏭️  Skipping - ${existingProducts} products already exist`);
    return await Product.find({ is_deleted: false }).select("_id").lean();
  }
  
  await Product.deleteMany({});
  await Variant.deleteMany({});
  
  const leafCategories = categories.filter(c => 
    !categories.some(child => child.parent_category_id?.toString() === c._id.toString())
  );
  
  // Product name templates per category
  const productTemplates = {
    MOB: ["Smartphone", "Phone Case", "Screen Protector", "Charger", "Power Bank", "Phone Holder", "Wireless Charger", "Phone Stand"],
    LAP: ["Laptop", "Laptop Bag", "Laptop Stand", "Laptop Charger", "Keyboard Cover", "Laptop Sleeve", "Docking Station"],
    DESK: ["Desktop PC", "All-in-One PC", "Mini PC", "Workstation", "Gaming PC"],
    TAB: ["Tablet", "Tablet Case", "Stylus Pen", "Tablet Stand", "Keyboard Case"],
    WEAR: ["Smartwatch", "Fitness Band", "Smart Ring", "VR Headset", "Smart Glasses"],
    AUDIO: ["Headphones", "Earbuds", "Speaker", "Soundbar", "Microphone", "Amplifier", "DAC"],
    CAM: ["Camera", "Lens", "Tripod", "Camera Bag", "Memory Card", "Flash", "Camera Strap"],
    TV: ["Smart TV", "LED TV", "OLED TV", "Projector", "Streaming Device", "TV Mount", "Remote Control"],
    KAPP: ["Blender", "Air Fryer", "Coffee Maker", "Toaster", "Mixer", "Juicer", "Kettle", "Slow Cooker", "Food Processor", "Rice Cooker"],
    CAPP: ["Vacuum Cleaner", "Steam Mop", "Robot Vacuum", "Carpet Cleaner", "Air Purifier"],
    CLIM: ["Air Conditioner", "Heater", "Humidifier", "Dehumidifier", "Fan", "Thermostat"],
    MCLT: ["T-Shirt", "Shirt", "Jeans", "Jacket", "Hoodie", "Sweater", "Suit", "Shorts", "Trousers", "Coat"],
    WCLT: ["Dress", "Blouse", "Skirt", "Leggings", "Jumpsuit", "Cardigan", "Tank Top", "Pants", "Coat"],
    KCLT: ["Kids T-Shirt", "Kids Jeans", "Kids Jacket", "Kids Dress", "Kids Hoodie", "Kids Shorts"],
    FOOT: ["Sneakers", "Running Shoes", "Boots", "Sandals", "Formal Shoes", "Slippers", "Sports Shoes"],
    ACC: ["Backpack", "Handbag", "Wallet", "Belt", "Sunglasses", "Hat", "Scarf", "Gloves", "Tie"],
    JEW: ["Necklace", "Ring", "Earrings", "Bracelet", "Pendant", "Anklet"],
    WATCH: ["Analog Watch", "Digital Watch", "Smart Watch", "Sport Watch", "Dress Watch"],
    FURN: ["Sofa", "Chair", "Table", "Bed", "Desk", "Shelf", "Cabinet", "Wardrobe", "Bookshelf"],
    BED: ["Bed Sheet", "Pillow", "Duvet", "Blanket", "Mattress", "Pillowcase", "Comforter"],
    KITCH: ["Cookware Set", "Knife Set", "Cutting Board", "Mixing Bowl", "Baking Sheet", "Measuring Cups", "Storage Containers"],
    DECOR: ["Wall Art", "Vase", "Candle", "Photo Frame", "Mirror", "Clock", "Rug", "Cushion"],
    LIGHT: ["Desk Lamp", "Floor Lamp", "Ceiling Light", "LED Strip", "Table Lamp", "Chandelier"],
    SKIN: ["Moisturizer", "Sunscreen", "Cleanser", "Serum", "Face Mask", "Toner", "Eye Cream", "Exfoliator"],
    HAIR: ["Shampoo", "Conditioner", "Hair Oil", "Hair Dryer", "Straightener", "Curling Iron", "Hair Serum"],
    MAKEUP: ["Foundation", "Lipstick", "Mascara", "Eyeshadow", "Blush", "Concealer", "Primer", "Setting Spray"],
    FRAG: ["Perfume", "Cologne", "Body Mist", "Eau de Toilette", "Deodorant"],
    HLTH: ["Vitamins", "Protein Powder", "Supplements", "First Aid Kit", "Thermometer", "Blood Pressure Monitor"],
    FIT: ["Treadmill", "Dumbbells", "Yoga Mat", "Resistance Bands", "Kettlebell", "Exercise Ball", "Pull-up Bar"],
    OUTD: ["Tent", "Sleeping Bag", "Backpack", "Hiking Boots", "Climbing Gear", "Camping Chair", "Lantern"],
    TSPRT: ["Basketball", "Football", "Tennis Racket", "Baseball Bat", "Cricket Bat", "Golf Club", "Volleyball"],
    WSPT: ["Swimming Goggles", "Snorkel Set", "Surfboard", "Kayak", "Life Jacket", "Wetsuit"],
    CYC: ["Bicycle", "Helmet", "Bike Lock", "Bike Light", "Cycling Gloves", "Bike Pump"],
    CAR: ["Car Cover", "Floor Mats", "Seat Cover", "Air Freshener", "Phone Mount", "Dash Cam", "Jump Starter"],
    MOTO: ["Helmet", "Motorcycle Jacket", "Gloves", "Boots", "Knee Guards", "Riding Suit"],
    TOOL: ["Power Drill", "Screwdriver Set", "Wrench Set", "Tool Box", "Measuring Tape", "Level"],
    BOARD: ["Chess Set", "Monopoly", "Scrabble", "Card Game", "Puzzle", "Trivia Game"],
    FIG: ["Action Figure", "Doll", "Model Kit", "Collectible", "Plush Toy"],
    BUILD: ["Building Blocks", "Construction Set", "Magnetic Tiles", "STEM Kit"],
    EDUTOY: ["Learning Tablet", "Coding Robot", "Science Kit", "Art Set"],
    FIC: ["Novel", "Mystery", "Romance", "Sci-Fi", "Fantasy", "Thriller", "Horror"],
    NONFIC: ["Biography", "Self-Help", "History", "Science", "Cookbook", "Travel Guide"],
    OFFICE: ["Notebook", "Pen Set", "Stapler", "File Folder", "Desk Organizer", "Calculator", "Printer Paper"],
    DOG: ["Dog Food", "Dog Bed", "Dog Leash", "Dog Harness", "Dog Toys", "Dog Shampoo"],
    CAT: ["Cat Food", "Cat Litter", "Cat Scratcher", "Cat Tower", "Cat Toys", "Cat Carrier"],
    BGEAR: ["Stroller", "Car Seat", "Baby Monitor", "Baby Carrier", "High Chair", "Baby Walker"],
    BCLT: ["Onesie", "Baby Romper", "Baby Jacket", "Baby Shoes", "Baby Hat"],
    NURS: ["Crib", "Changing Table", "Baby Blanket", "Baby Pillow", "Nursery Decor"],
    SNACK: ["Chips", "Cookies", "Chocolate", "Nuts", "Popcorn", "Granola Bar"],
    BEV: ["Coffee", "Tea", "Juice", "Soda", "Energy Drink", "Water"],
    GROC: ["Rice", "Pasta", "Canned Food", "Cooking Oil", "Spices", "Flour"],
  };
  
  const products = [];
  const variants = [];
  
  let productCount = 0;
  const targetProducts = 1100;
  
  for (const brand of brands) {
    if (productCount >= targetProducts) break;
    
    // Each brand gets 1-3 products
    const numProducts = randomInt(1, 3);
    
    for (let p = 0; p < numProducts && productCount < targetProducts; p++) {
      const category = randomItem(leafCategories);
      const templates = productTemplates[category.category_code] || ["Product"];
      const productName = `${brand.name} ${randomItem(templates)} ${randomInt(1, 99)}`;
      
      const productCode = generateCode("PR", productCount + 1);
      const hasVariants = Math.random() > 0.3;
      
      const product = {
        name: productName,
        category_id: category._id,
        brand_id: brand._id,
        has_variants: hasVariants,
        tag_ids: tags.slice(0, randomInt(1, 5)).map(t => t._id),
        description: `${productName} by ${brand.name}. High quality product with excellent features.`,
        tax: randomInt(0, 25),
        specifications: {
          brand: brand.name,
          country: brand.country || "USA",
          warranty: `${randomInt(1, 5)} Year${randomInt(1, 5) > 1 ? "s" : ""}`,
        },
        status: "active",
        is_deleted: false,
      };
      
      products.push(product);
      productCount++;
    }
  }
  
  // Insert products in batches
  const productDocs = await Product.insertMany(products, { ordered: false });
  console.log(`   ✅ Created ${productDocs.length} products`);
  
  // Create variants for each product
  console.log("   🔄 Creating variants...");
  let variantCount = 0;
  
  for (const product of productDocs) {
    const numVariants = product.has_variants ? randomInt(2, 6) : 1;
    
    for (let v = 0; v < numVariants; v++) {
      const color = randomItem(COLORS);
      const size = randomItem(SIZES);
      const sku = generateSKU(
        product.name.substring(0, 3).toUpperCase(),
        product.name.substring(0, 3).toUpperCase(),
        variantCount + 1
      );
      
      const costPrice = randomFloat(10, 500);
      const markup = randomFloat(1.5, 3.0);
      const sellingPrice = +(costPrice * markup).toFixed(2);
      
      const variant = {
        product_id: product._id,
        sku: sku,
        title: product.has_variants ? `${color} - ${size}` : "Default",
        description: `${product.name} variant`,
        cost_price: costPrice,
        selling_price: sellingPrice,
        quantity: randomInt(0, 500),
        min_qnt: 1,
        max_qnt: randomInt(10, 100),
        attributes: {
          color: color,
          size: size,
        },
        status: "active",
        tags: ["in-stock", "verified"],
        images: [
          {
            img_url: getProductImage(product.name, v),
            img_size: randomInt(50, 500),
            mimeType: "image/jpeg",
            width: 600,
            height: 600,
          },
          {
            img_url: getProductImage(product.name, v + 10),
            img_size: randomInt(50, 500),
            mimeType: "image/jpeg",
            width: 600,
            height: 600,
          },
        ],
      };
      
      variants.push(variant);
      variantCount++;
    }
  }
  
  // Insert variants in batches
  const batchSize = 500;
  let insertedVariants = 0;
  for (let i = 0; i < variants.length; i += batchSize) {
    const batch = variants.slice(i, i + batchSize);
    const result = await Variant.insertMany(batch, { ordered: false });
    insertedVariants += result.length;
  }
  console.log(`   ✅ Created ${insertedVariants} variants`);
  
  return productDocs;
}

async function seedDiscounts(products, brands, categories, tags) {
  console.log("\n💰 Seeding Discounts...");
  
  const existingCount = await Discount.countDocuments({ is_deleted: false });
  if (existingCount >= 1000) {
    console.log(`   ⏭️  Skipping - ${existingCount} discounts already exist`);
    return;
  }
  
  // Get an employee for createdBy (required field)
  const employee = await Employee.findOne({});
  if (!employee) {
    console.log("   ⚠️  No employee found - skipping discounts (createdBy is required)");
    return;
  }
  
  await Discount.deleteMany({ is_deleted: false });
  
  const discounts = [];
  const discountNames = [
    "Summer Sale", "Winter Clearance", "Flash Deal", "Happy Hours", "Mega Sale",
    "Weekend Special", "Holiday Discount", "New Customer Offer", "Loyalty Reward",
    "Bulk Purchase", "Early Bird", "Last Chance", "Clearance", "End of Season",
    "Back to School", "Black Friday", "Cyber Monday", "Christmas Sale", "Easter Deal",
    "Valentine's Special", "Mother's Day", "Father's Day", "Independence Day",
    "New Year Sale", "Birthday Special", "Referral Bonus", "First Purchase",
    "VIP Member", "Student Discount", "Senior Citizen", "Military Discount",
    "Free Shipping Day", "Buy More Save More", "Bundle Deal", "Category Sale",
    "Brand Exclusive", "Limited Time", "Secret Deal", "Mystery Discount",
    "Cashback Offer", "Price Drop", "Member Only", "App Exclusive",
    "Social Media Deal", "Newsletter Signup", "Review Discount", "Loyalty Points",
    "Seasonal Clearance", "Warehouse Sale", "Factory Outlet", "Online Only",
  ];
  
  const applyToOptions = ["all", "specific_products", "specific_categories", "specific_brands", "specific_tags"];
  
  for (let i = 0; i < 1050; i++) {
    const type = randomItem(DISCOUNT_TYPES);
    const applyTo = randomItem(applyToOptions);
    const name = i < discountNames.length ? discountNames[i] : `Discount ${String(i + 1).padStart(4, "0")}`;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - randomInt(0, 30));
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + randomInt(7, 90));
    
    const discount = {
      code: `DISC${String(i + 1).padStart(5, "0")}`,
      name: name,
      description: `${name} - Save big on your purchases!`,
      type: type,
      value: type === "percentage" ? randomInt(5, 70) : randomFloat(50, 5000),
      applyTo: applyTo,
      minOrderValue: randomInt(0, 5000),
      minQuantity: Math.random() > 0.7 ? randomInt(2, 10) : null,
      startDate: startDate,
      endDate: endDate,
      usageLimit: Math.random() > 0.3 ? randomInt(100, 10000) : null,
      perUserLimit: randomInt(1, 5),
      isStackable: Math.random() > 0.8,
      status: randomItem(["active", "active", "active", "scheduled", "draft"]),
      isActive: Math.random() > 0.3,
      is_deleted: false,
      createdBy: employee._id,
    };
    
    // Add specific targets
    if (applyTo === "specific_products" && products.length > 0) {
      const shuffled = [...products].sort(() => Math.random() - 0.5);
      discount.selectedProducts = shuffled.slice(0, randomInt(5, 20)).map(p => p._id);
    }
    if (applyTo === "specific_categories" && categories.length > 0) {
      const shuffled = [...categories].sort(() => Math.random() - 0.5);
      discount.selectedCategories = shuffled.slice(0, randomInt(2, 8)).map(c => c._id);
    }
    if (applyTo === "specific_brands" && brands.length > 0) {
      const shuffled = [...brands].sort(() => Math.random() - 0.5);
      discount.selectedBrands = shuffled.slice(0, randomInt(3, 15)).map(b => b._id);
    }
    if (applyTo === "specific_tags" && tags.length > 0) {
      const shuffled = [...tags].sort(() => Math.random() - 0.5);
      discount.selectedTags = shuffled.slice(0, randomInt(2, 5)).map(t => t._id);
    }
    
    discounts.push(discount);
  }
  
  const batchSize = 500;
  let inserted = 0;
  for (let i = 0; i < discounts.length; i += batchSize) {
    const batch = discounts.slice(i, i + batchSize);
    const result = await Discount.insertMany(batch, { ordered: false });
    inserted += result.length;
  }
  console.log(`   ✅ Created ${inserted} discounts`);
}

async function seedDeals(products, brands, categories) {
  console.log("\n🎯 Seeding Deals...");
  
  const existingCount = await Deal.countDocuments({});
  if (existingCount >= 1000) {
    console.log(`   ⏭️  Skipping - ${existingCount} deals already exist`);
    return await Deal.find({}).select("_id").lean();
  }
  
  await Deal.deleteMany({});
  
  const deals = [];
  const dealNames = [
    "Buy 1 Get 1 Free", "50% Off Everything", "Mega Bundle Deal", "Weekend Blitz",
    "Happy Hour Special", "Early Bird Gets the Deal", "Last Minute Bargain",
    "Clearance Blowout", "Season Finale Sale", "Grand Opening Deal",
    "Anniversary Special", "Loyalty Appreciation", "New Arrival Promo",
    "Clearance Rack", "Flash Sale Friday", "Midnight Madness",
    "Back to Basics", "Starter Pack Deal", "Premium Bundle",
    "Value Bundle", "Essentials Pack", "Family Bundle",
    "Office Starter Kit", "Home Upgrade Pack", "Tech Bundle",
    "Fashion Forward Deal", "Style Pack", "Beauty Box",
    "Fitness Bundle", "Outdoor Adventure Pack", "Travel Essentials",
    "Pet Lover's Deal", "Baby Shower Bundle", "Kids Play Pack",
    "Kitchen Master Bundle", "Home Office Setup", "Gaming Bundle",
    "Audio Paradise Deal", "Camera Kit Deal", "Smart Home Bundle",
    "DIY Starter Pack", "Craft Kit Deal", "Art Supply Bundle",
    "Music Maker Bundle", "Movie Night Pack", "Bookworm Bundle",
    "Student Survival Kit", "Work From Home Pack", "Weekend Warrior Deal",
    "Holiday Gift Bundle", "Birthday Bash Deal", "Celebration Pack",
  ];
  
  const applyToOptions = ["all", "product", "category", "brand", "collection"];
  
  for (let i = 0; i < 1050; i++) {
    const type = randomItem(DEAL_TYPES);
    const applyTo = randomItem(applyToOptions);
    const name = i < dealNames.length ? dealNames[i] : `Deal ${String(i + 1).padStart(4, "0")}`;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - randomInt(0, 30));
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + randomInt(7, 60));
    
    const deal = {
      name: name,
      description: `${name} - Limited time offer!`,
      type: type,
      applyTo: applyTo,
      discountValue: type === "percentage" ? randomInt(10, 75) : randomFloat(100, 5000),
      startDate: startDate,
      endDate: endDate,
      minQuantity: type === "buy_x_get_y" ? randomInt(2, 5) : 1,
      usageLimit: Math.random() > 0.3 ? randomInt(50, 5000) : null,
      usedCount: randomInt(0, 100),
      perUserLimit: randomInt(1, 3),
      customerType: randomItem(["all", "all", "all", "new_customer", "existing_customer"]),
      isActive: Math.random() > 0.2,
      isFeatured: Math.random() > 0.8,
      image: getProductImage(`deal-${i}`, 1),
    };
    
    if (type === "buy_x_get_y") {
      deal.buyQuantity = randomInt(2, 4);
      deal.getQuantity = randomInt(1, 2);
      deal.getDiscountValue = randomInt(50, 100);
    }
    
    if (type === "bundle") {
      deal.bundlePrice = randomFloat(50, 2000);
    }
    
    // Add specific targets
    if (applyTo === "product" && products.length > 0) {
      const shuffled = [...products].sort(() => Math.random() - 0.5);
      deal.productIds = shuffled.slice(0, randomInt(3, 15)).map(p => p._id);
    }
    if (applyTo === "category" && categories.length > 0) {
      const shuffled = [...categories].sort(() => Math.random() - 0.5);
      deal.categoryIds = shuffled.slice(0, randomInt(2, 6)).map(c => c._id);
    }
    if (applyTo === "brand" && brands.length > 0) {
      const shuffled = [...brands].sort(() => Math.random() - 0.5);
      deal.brandIds = shuffled.slice(0, randomInt(3, 10)).map(b => b._id);
    }
    
    deals.push(deal);
  }
  
  const batchSize = 500;
  let inserted = 0;
  for (let i = 0; i < deals.length; i += batchSize) {
    const batch = deals.slice(i, i + batchSize);
    const result = await Deal.insertMany(batch, { ordered: false });
    inserted += result.length;
  }
  console.log(`   ✅ Created ${inserted} deals`);
  return deals;
}

async function seedBanners(products, categories, brands, deals) {
  console.log("\n🖼️  Seeding Banners...");
  
  const existingCount = await Banner.countDocuments({});
  if (existingCount >= 1000) {
    console.log(`   ⏭️  Skipping - ${existingCount} banners already exist`);
    return;
  }
  
  await Banner.deleteMany({});
  
  const banners = [];
  const bannerTemplates = [
    { title: "Summer Collection Sale", type: "homepage_hero", eyebrow: "Limited Time", heading: "Up to 60% Off", description: "Discover our exclusive summer collection" },
    { title: "New Arrivals", type: "promotional", eyebrow: "Just In", heading: "Fresh Styles", description: "Be the first to shop our latest arrivals" },
    { title: "Flash Sale", type: "homepage_hero", eyebrow: "24 Hours Only", heading: "Doorbuster Deals", description: "Don't miss out on these incredible savings" },
    { title: "Free Shipping Weekend", type: "promotional", eyebrow: "Special Offer", heading: "Free Shipping", description: "On all orders this weekend" },
    { title: "Clearance Event", type: "homepage_hero", eyebrow: "Final Markdowns", heading: "Up to 80% Off", description: "Last chance to grab these deals" },
    { title: "Back to School", type: "collection", eyebrow: "Season Special", heading: "Get Ready", description: "Shop everything for the new school year" },
    { title: "Holiday Gift Guide", type: "collection", eyebrow: "Gift Ideas", heading: "Perfect Gifts", description: "Find the perfect presents for everyone" },
    { title: "Member Exclusive", type: "popup", eyebrow: "VIP Access", heading: "Extra 20% Off", description: "Exclusive savings for members" },
    { title: "Brand Spotlight", type: "product", eyebrow: "Featured Brand", heading: "Premium Quality", description: "Explore our top brand collections" },
    { title: "Trending Now", type: "homepage_hero", eyebrow: "Hot Items", heading: "What's Popular", description: "Shop the most wanted items" },
    { title: "Tech Deals", type: "promotional", eyebrow: "Electronics", heading: "Save Big on Tech", description: "Latest gadgets at unbeatable prices" },
    { title: "Fashion Forward", type: "collection", eyebrow: "Style", heading: "New Fashion Arrivals", description: "Upgrade your wardrobe" },
    { title: "Home Essentials", type: "promotional", eyebrow: "Home", heading: "Everything for Home", description: "Transform your living space" },
    { title: "Beauty Bonanza", type: "collection", eyebrow: "Beauty", heading: "Glow Up", description: "Top beauty picks just for you" },
    { title: "Sports Season", type: "homepage_hero", eyebrow: "Sports", heading: "Game On", description: "Gear up for the season" },
  ];
  
  for (let i = 0; i < 1050; i++) {
    const template = bannerTemplates[i % bannerTemplates.length];
    const bannerType = i < bannerTemplates.length ? template.type : randomItem(BANNER_TYPES);
    const title = i < bannerTemplates.length ? template.title : `Promo Banner ${String(i + 1).padStart(4, "0")}`;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - randomInt(0, 60));
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + randomInt(7, 90));
    
    const banner = {
      title: title,
      bannerType: bannerType,
      status: randomItem(["active", "active", "active", "scheduled", "inactive"]),
      position: randomInt(1, 100),
      desktopImage: getBannerImage(title, "desktop"),
      mobileImage: getBannerImage(title, "mobile"),
      eyebrow: i < bannerTemplates.length ? template.eyebrow : randomItem(["Sale", "New", "Hot", "Featured", "Exclusive"]),
      heading: i < bannerTemplates.length ? template.heading : randomItem(["Shop Now", "Discover More", "Limited Time", "Save Big", "New Arrivals"]),
      description: i < bannerTemplates.length ? template.description : "Don't miss out on our latest promotions",
      primaryButton: {
        text: randomItem(["Shop Now", "View Collection", "Learn More", "Get Deal", "See More"]),
        linkType: randomItem(["custom_url", "product", "category", "brand", "deal"]),
        link: `/`,
      },
      startDate: startDate,
      endDate: endDate,
      displayRules: {
        pages: [randomItem(BANNER_PAGES)],
        devices: ["desktop", "mobile", "tablet"],
      },
    };
    
    // Link to specific entities sometimes
    if (Math.random() > 0.7 && products.length > 0) {
      banner.primaryButton.linkType = "product";
      banner.primaryButton.productId = randomItem(products)._id;
    } else if (Math.random() > 0.7 && categories.length > 0) {
      banner.primaryButton.linkType = "category";
      banner.primaryButton.categoryId = randomItem(categories)._id;
    } else if (Math.random() > 0.7 && brands.length > 0) {
      banner.primaryButton.linkType = "brand";
      banner.primaryButton.brandId = randomItem(brands)._id;
    } else if (Math.random() > 0.7 && deals.length > 0) {
      banner.primaryButton.linkType = "deal";
      banner.primaryButton.dealId = randomItem(deals)._id;
    }
    
    banners.push(banner);
  }
  
  const batchSize = 500;
  let inserted = 0;
  for (let i = 0; i < banners.length; i += batchSize) {
    const batch = banners.slice(i, i + batchSize);
    const result = await Banner.insertMany(batch, { ordered: false });
    inserted += result.length;
  }
  console.log(`   ✅ Created ${inserted} banners`);
}

// ==========================================
// MAIN SEED FUNCTION
// ==========================================

async function seedAllData() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   COMPREHENSIVE E-COMMERCE DATA SEED    ║");
  console.log("║   1000+ Brands, Products, Discounts     ║");
  console.log("║   Deals, Banners & More                 ║");
  console.log("╚══════════════════════════════════════════╝");
  
  try {
    // 1. Seed Brands
    const brands = await seedBrands();
    
    // 2. Seed Categories
    const categories = await seedCategories();
    
    // 3. Seed Tags
    const tags = await seedTags();
    
    // 4. Seed Products & Variants
    const products = await seedProducts(brands, categories, tags);
    
    // 5. Seed Discounts
    await seedDiscounts(products, brands, categories, tags);
    
    // 6. Seed Deals
    const deals = await seedDeals(products, brands, categories);
    
    // 7. Seed Banners
    await seedBanners(products, categories, brands, deals);
    
    // Summary
    const counts = {
      brands: await Brand.countDocuments({ is_deleted: false }),
      categories: await Category.countDocuments({ is_deleted: false }),
      products: await Product.countDocuments({ is_deleted: false }),
      variants: await Variant.countDocuments({}),
      discounts: await Discount.countDocuments({ is_deleted: false }),
      deals: await Deal.countDocuments({}),
      banners: await Banner.countDocuments({}),
      tags: await Tag.countDocuments({ is_deleted: false }),
    };
    
    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║           SEED COMPLETE SUMMARY          ║");
    console.log("╠══════════════════════════════════════════╣");
    console.log(`║  🏭 Brands:      ${String(counts.brands).padStart(6)}               ║`);
    console.log(`║  📂 Categories:  ${String(counts.categories).padStart(6)}               ║`);
    console.log(`║  📦 Products:    ${String(counts.products).padStart(6)}               ║`);
    console.log(`║  🔀 Variants:    ${String(counts.variants).padStart(6)}               ║`);
    console.log(`║  🏷️  Tags:        ${String(counts.tags).padStart(6)}               ║`);
    console.log(`║  💰 Discounts:   ${String(counts.discounts).padStart(6)}               ║`);
    console.log(`║  🎯 Deals:       ${String(counts.deals).padStart(6)}               ║`);
    console.log(`║  🖼️  Banners:     ${String(counts.banners).padStart(6)}               ║`);
    console.log("╚══════════════════════════════════════════╝");
    
    return counts;
  } catch (error) {
    console.error("\n❌ Seed Error:", error);
    throw error;
  }
}

// ==========================================
// RUN SEED
// ==========================================

if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ Connected to MongoDB");
      return seedAllData();
    })
    .then(() => {
      console.log("\n🎉 All seed data created successfully!");
      mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Fatal Error:", err.message);
      mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { seedAllData };
