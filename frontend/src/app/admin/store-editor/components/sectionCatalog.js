/* ==========================================================
   STORE EDITOR — section catalog (sirf editor UI ke liye)
   Backend schema type/label/limit deta hai; yahan icon, category
   aur ek line description — "Add section" gallery + section list.
   Naya backend type yahan na ho to bhi kaam karta hai (fallback).
   ========================================================== */

import {
  Award,
  BadgePercent,
  CircleHelp,
  Flame,
  GalleryHorizontal,
  Grid3x3,
  ImageIcon,
  Images,
  LayoutGrid,
  LayoutTemplate,
  Layers,
  Mail,
  MapPin,
  MessageSquare,
  MoveVertical,
  Quote,
  Star,
  Tags,
  Timer,
  Type,
  Video,
} from "lucide-react";

export const SECTION_CATEGORIES = [
  { id: "hero", label: "Hero & banners" },
  { id: "products", label: "Products & catalog" },
  { id: "content", label: "Text & media" },
  { id: "social", label: "Trust & social proof" },
  { id: "forms", label: "Forms & contact" },
  { id: "layout", label: "Layout" },
];

export const SECTION_CATALOG = {
  hero_banners: { icon: LayoutTemplate, category: "hero", description: "Full-width slideshow at the top of the page." },
  countdown: { icon: Timer, category: "hero", description: "Sale timer that counts down to a date." },
  category_tiles: { icon: LayoutGrid, category: "products", description: "Your categories as image tiles." },
  deals: { icon: Flame, category: "products", description: "Today's active deals with timers." },
  featured_products: { icon: Star, category: "products", description: "Products you mark as featured." },
  popular_categories: { icon: Grid3x3, category: "products", description: "Best-selling categories with products." },
  product_carousel: { icon: GalleryHorizontal, category: "products", description: "Sliding row of new, sale, category or brand products." },
  brand_strip: { icon: Tags, category: "products", description: "Scrolling strip of brand logos." },
  brand_showcase: { icon: BadgePercent, category: "products", description: "Spotlight on your top brands." },
  rich_text: { icon: Type, category: "content", description: "Heading and formatted text." },
  image_with_text: { icon: ImageIcon, category: "content", description: "Image next to text and a button." },
  image_gallery: { icon: Images, category: "content", description: "Grid of images with captions." },
  video: { icon: Video, category: "content", description: "Embed a YouTube or Vimeo video." },
  testimonials: { icon: Quote, category: "social", description: "Customer quotes with star ratings." },
  logo_list: { icon: Award, category: "social", description: "Partner, press or certification logos." },
  faq: { icon: CircleHelp, category: "social", description: "Questions and answers that expand." },
  newsletter: { icon: Mail, category: "forms", description: "Email signup box." },
  contact_form: { icon: MessageSquare, category: "forms", description: "Message form — replies land in Messages." },
  map: { icon: MapPin, category: "forms", description: "Google map of your shop address." },
  spacer: { icon: MoveVertical, category: "layout", description: "Empty space between sections." },
};

export const catalogOf = (type) => SECTION_CATALOG[type] || { icon: Layers, category: "layout", description: "" };

/** Section ka chhota naam: "Rich text · About us" */
export function sectionLabel(schema, section) {
  const base = schema?.sectionTypes?.[section?.type]?.label || section?.type || "Section";
  const custom = typeof section?.settings?.heading === "string" ? section.settings.heading.trim() : "";
  return custom ? `${base} · ${custom}` : base;
}

/** Block ka title: pehla bhara text field (heading / question / author / caption) */
export function blockTitle(def, block, index) {
  for (const key of ["heading", "question", "author", "caption", "eyebrow", "quote"]) {
    const v = block?.settings?.[key];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 40);
  }
  return `${def.label} ${index + 1}`;
}
