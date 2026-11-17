import { BRANDS } from "./data";

/* Infinite category/brand marquee — pauses on hover, purely CSS-driven */
export default function Marquee() {
  const items = [...BRANDS, ...BRANDS]; // duplicated for seamless -50% loop

  return (
    <div
      className="marquee overflow-hidden border-y border-[var(--user-border)] bg-[var(--user-bg-card)] py-3"
      aria-label="Popular brands available"
    >
      <div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap">
        {items.map((brand, i) => (
          <span
            key={`${brand}-${i}`}
            aria-hidden={i >= BRANDS.length}
            className="text-sm font-extrabold uppercase tracking-widest text-[var(--user-text-muted)] transition-colors hover:text-[var(--user-accent)]"
          >
            {brand}
          </span>
        ))}
      </div>
    </div>
  );
}
