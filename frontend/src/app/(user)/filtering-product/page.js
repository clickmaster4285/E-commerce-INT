/* ==========================================================
   FILTERING-PRODUCT PAGE (server shell)
   - Static shell, poora data client queries se (Shop pattern).
   - SEO metadata + Suspense-friendly (useSearchParams client me).
   ========================================================== */

import FilteringProductClient from "./FilteringProductClient";

export const metadata = {
  title: "Filtered Products",
  description:
    "Browse filtered products — filter by category, brand, price, deals, availability and discount.",
};

export default function FilteringProductPage() {
  return <FilteringProductClient />;
}
