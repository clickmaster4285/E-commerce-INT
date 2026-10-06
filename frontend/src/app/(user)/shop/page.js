/* ==========================================================
   SHOP PAGE (server shell)
   - Saare filters/sort/search/grid/pagination yahan hain
     (HomeClient se shift — naya logic nahi).
   - Ye shell static hai; poora data client queries se aata hai
     (ghar wali page.js jaisi SSR prefetch IMPL-4 me aayegi).
   ========================================================== */

import ShopClient from "./ShopClient";

export const metadata = {
  title: "Shop",
  description: "Browse all products — filter by category, brand, price, deals and more.",
};

export default function ShopPage() {
  return <ShopClient />;
}
