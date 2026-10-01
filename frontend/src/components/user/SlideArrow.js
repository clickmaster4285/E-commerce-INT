"use client";

/* ==========================================================
   SLIDE ARROW — rows / carousels ke floating side arrows,
   Deals section wale style me: accent gradient circle, white
   chevron, hover par scale. Jis taraf slide possible na ho us
   taraf parent yeh render hi nahi karta (hide, not disable).
   ========================================================== */

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function SlideArrow({ dir = "right", onClick, label }) {
  const Icon = dir === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label || (dir === "left" ? "Previous" : "Next")}
      className={`absolute top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full shadow-xl backdrop-blur-xl transition-all hover:scale-110 active:scale-95 sm:h-11 sm:w-11 ${
        dir === "left" ? "-left-2 sm:-left-3" : "-right-2 sm:-right-3"
      }`}
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--user-accent) 20%, transparent), color-mix(in srgb, var(--user-accent-hover) 20%, transparent))",
        color: "var(--user-accent-text)",
      }}
    >
      <Icon size={18} />
    </button>
  );
}
