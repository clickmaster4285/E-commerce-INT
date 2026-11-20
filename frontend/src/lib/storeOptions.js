// Store info ke shared options — seller signup aur super admin "Add store" dono yahi use karte hain

export const BUSINESS_CATEGORIES = [
  "Electronics",
  "Fashion & Apparel",
  "Home & Kitchen",
  "Beauty & Personal Care",
  "Sports & Outdoors",
  "Grocery & Food",
  "Baby & Kids",
  "Automotive",
  "Health & Wellness",
  "Books & Stationery",
  "Services",
  "Other",
];

export const STORE_DESCRIPTION_MAX = 2000;
// Store web address: DNS 63 tak allow karta hai, product limit 3–30 (backend validateStoreAddress jaisa)
export const STORE_ADDRESS_MIN = 3;
export const STORE_ADDRESS_MAX = 30;
export const DEFAULT_COUNTRY = "Pakistan";
