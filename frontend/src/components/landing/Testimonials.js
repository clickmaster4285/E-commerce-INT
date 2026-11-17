import { Star, Quote, BadgeCheck } from "lucide-react";
import { TESTIMONIALS, TESTIMONIAL_SUMMARY } from "./content";

/* Bento grid of real-looking quote cards — PLACEHOLDER data.
   Replace TESTIMONIALS / TESTIMONIAL_SUMMARY in content.js with real quotes. */

function Stars({ rating, size = 16 }) {
  return (
    <div className="flex gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          aria-hidden="true"
          className={i < rating ? "fill-amber-400 text-amber-400" : "fill-[var(--user-border)] text-[var(--user-border)]"}
        />
      ))}
    </div>
  );
}

function Avatar({ initials, size = "md" }) {
  const dim = size === "lg" ? "h-14 w-14 text-base" : "h-11 w-11 text-xs";
  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-2xl font-extrabold text-white shadow-md`}
      style={{ background: "linear-gradient(135deg, var(--user-accent), var(--user-accent-hover))" }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export default function Testimonials() {
  const featured = TESTIMONIALS.find((t) => t.featured) || TESTIMONIALS[0];
  const rest = TESTIMONIALS.filter((t) => t !== featured);

  return (
    <section
      aria-labelledby="testimonials-title"
      className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"
    >
      {/* Heading row: title + aggregate badge */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--user-accent)]">
            Customer Stories
          </p>
          <h2 id="testimonials-title" className="mt-2 text-2xl font-extrabold leading-tight text-[var(--user-text)] sm:text-4xl">
            Loved by stores running across Pakistan
          </h2>
        </div>

        <div
          className="flex items-center gap-4 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-5 py-3 shadow-sm"
          aria-label={`Average rating ${TESTIMONIAL_SUMMARY.rating}`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--user-accent-soft)] text-[var(--user-accent)]">
            <Star size={26} className="fill-[var(--user-accent)]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xl font-extrabold leading-none tabular-nums text-[var(--user-text)]">
              {TESTIMONIAL_SUMMARY.rating}
            </p>
            <p className="mt-1 max-w-[10rem] text-[10px] font-semibold uppercase leading-4 tracking-wide text-[var(--user-text-muted)]">
              {TESTIMONIAL_SUMMARY.text}
            </p>
          </div>
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:grid-rows-2">
        {/* Featured card */}
        <figure className="group relative overflow-hidden rounded-3xl border border-transparent p-[1.5px] shadow-xl transition-transform duration-300 hover:-translate-y-1 sm:col-span-2 lg:col-span-6 lg:row-span-2"
          style={{ background: "linear-gradient(160deg, var(--user-accent) 0%, var(--user-border) 55%)" }}
        >
          <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[calc(1.5rem-1.5px)] bg-[var(--user-bg-card)] p-6 sm:p-8">
            <Quote
              size={110}
              aria-hidden="true"
              className="absolute -right-4 -top-4 text-[var(--user-accent-soft)] transition-transform duration-500 group-hover:scale-110"
              fill="var(--user-accent-soft)"
            />
            <div className="relative">
              <Stars rating={featured.rating} size={20} />
              <blockquote className="mt-4 text-xl font-semibold leading-8 text-[var(--user-text)] sm:text-2xl sm:leading-9">
                &ldquo;{featured.text}&rdquo;
              </blockquote>
            </div>
            <figcaption className="relative mt-6 flex items-center gap-4">
              <Avatar initials={featured.initials} size="lg" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-base font-extrabold text-[var(--user-text)]">
                  {featured.name}
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-600"
                    title="Verified Click Master customer"
                  >
                    <BadgeCheck size={11} aria-hidden="true" />
                    Verified
                  </span>
                </span>
                <span className="mt-0.5 block text-xs font-medium text-[var(--user-text-muted)]">
                  {featured.role}
                </span>
              </span>
            </figcaption>
          </div>
        </figure>

        {/* Compact cards */}
        {rest.slice(0, 4).map((t) => (
          <figure
            key={t.name}
            className="landing-card flex flex-col justify-between p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg lg:col-span-3"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <Stars rating={t.rating} size={14} />
                <BadgeCheck size={16} className="text-emerald-500" aria-label="Verified customer" />
              </div>
              <blockquote className="mt-3 text-sm leading-6 text-[var(--user-text-secondary)]">
                &ldquo;{t.text}&rdquo;
              </blockquote>
            </div>
            <figcaption className="mt-4 flex items-center gap-3 border-t border-[var(--user-border)] pt-3">
              <Avatar initials={t.initials} />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13px] font-extrabold text-[var(--user-text)]">
                  {t.name}
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-medium text-[var(--user-text-muted)]">
                  {t.role}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
