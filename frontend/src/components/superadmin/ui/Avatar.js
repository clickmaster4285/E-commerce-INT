/* eslint-disable @next/next/no-img-element */
import { initials } from "@/lib/superadminFormat";
import { cx } from "./cx";

const SIZES = { xs: "h-7 w-7 text-[10px]", sm: "h-8 w-8 text-[11px]", md: "h-9 w-9 text-[12px]", lg: "h-12 w-12 text-[15px]", xl: "h-16 w-16 text-[19px]" };
const PALETTE = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#db2777", "#7c3aed", "#0d9488", "#2563eb"];

// Naam se stable color — same seller hamesha same rang
const colorFor = (name = "") => {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
};

/** Initials ya image. shape: circle (people) | square (stores/logos) */
export default function Avatar({ name, src, size = "md", shape = "circle", className }) {
  const color = colorFor(name);
  const radius = shape === "square" ? "rounded-lg" : "rounded-full";
  return (
    <span
      className={cx("inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-semibold", SIZES[size] || SIZES.md, radius, src && "border border-line bg-card", className)}
      style={src ? undefined : { background: `color-mix(in srgb, ${color} 14%, var(--bg-card))`, color }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" className="h-full w-full object-contain" /> : initials(name)}
    </span>
  );
}
