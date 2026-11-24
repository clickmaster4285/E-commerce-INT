/* ==========================================================
   SECTION REGISTRY — theme section `type` → React component
   ----------------------------------------------------------
   Types + settings backend config/themeSchema.js define karta hai.
   Naya type: backend schema + yahan entry. Unknown type → render nahi
   (purana frontend naye backend type par crash nahi karta).

   `minHeight` ViewportSection ke liye (CLS / lazy-mount placeholder).
   Built-in sections ko HomeClient apna data (tiles / brands / counts)
   props me deta hai — isliye unke components wahan wire hote hain.
   ========================================================== */

import dynamic from "next/dynamic";

const pulse = (h) =>
  function SectionSkeleton() {
    return <div className={`${h} animate-pulse rounded-2xl bg-user-card`} />;
  };

const generic = (name, h) =>
  dynamic(() => import("./GenericSections").then((m) => m[name]), { ssr: true, loading: pulse(h) });

export const GENERIC_SECTIONS = {
  rich_text: { Component: generic("RichTextSection", "h-[10rem]"), minHeight: 160 },
  image_with_text: { Component: generic("ImageWithTextSection", "h-[20rem]"), minHeight: 320 },
  product_carousel: { Component: generic("ProductCarouselSection", "h-[20rem]"), minHeight: 320 },
  newsletter: { Component: generic("NewsletterSection", "h-[12rem]"), minHeight: 200 },
  testimonials: { Component: generic("TestimonialsSection", "h-[14rem]"), minHeight: 220 },
  spacer: { Component: generic("SpacerSection", "h-8"), minHeight: 8, eager: true },
};

// Built-in (HomeClient-wired) section types — sirf ek instance
export const BUILTIN_SECTION_TYPES = [
  "hero_banners",
  "category_tiles",
  "deals",
  "featured_products",
  "popular_categories",
  "brand_strip",
  "brand_showcase",
];
