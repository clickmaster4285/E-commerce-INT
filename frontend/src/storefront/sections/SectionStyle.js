/* ==========================================================
   SECTION STYLE — store editor ke common section settings (section.style)
     background → section ke peeche color (rounded card)
     padding    → none | small | medium | large (vertical spacing)
     visibility → all | desktop | mobile
   Default ({}/missing) → koi wrapper class nahi → layout purana jaisa.
   Plus: hero custom slide blocks → BannerSlider slide objects.
   ========================================================== */

import { resolveThemeLink } from "../themeLinks";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const PADDING = { small: "py-4", medium: "py-8", large: "py-14" };
const VISIBILITY = { desktop: "hidden lg:block", mobile: "lg:hidden" };

export function SectionStyle({ style, children }) {
  const background = typeof style?.background === "string" && HEX.test(style.background) ? style.background : null;
  const padding = PADDING[style?.padding] || "";
  const visibility = VISIBILITY[style?.visibility] || "";
  if (!background && !padding && !visibility) return children;

  return (
    <div
      className={`${visibility} ${padding} ${background ? "rounded-2xl px-3 sm:px-5" : ""}`.trim()}
      style={background ? { backgroundColor: background } : undefined}
    >
      {children}
    </div>
  );
}

/** Hero "custom" source: blocks → BannerSlider ke banner-like objects */
export function heroSlidesFromBlocks(blocks = []) {
  return (blocks || [])
    .filter((b) => b?.settings?.image || b?.settings?.heading)
    .map((b) => {
      const s = b.settings || {};
      const href = resolveThemeLink(s.buttonLink);
      return {
        _id: b.id,
        preLocalized: true,
        desktopImage: s.image || "",
        eyebrow: s.eyebrow || "",
        heading: s.heading || "",
        description: s.description || "",
        altText: s.heading || "",
        primaryButton: href && s.buttonLabel ? { text: s.buttonLabel, link: href, ownText: true } : null,
      };
    });
}
