import { Star, Quote, BadgeCheck } from "lucide-react";
import { TESTIMONIALS, TESTIMONIAL_SUMMARY } from "./content";

function Stars({ rating, size = 16 }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`Rated ${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          aria-hidden="true"
          className={i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-[var(--user-border)] text-[var(--user-border)]"}
        />
      ))}
    </div>
  );
}

function Avatar({ initials, size = "md" }) {
  const dim = size === "lg" ? "h-14 w-14 text-base" : "h-10 w-10 text-[11px]";
  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-[var(--user-accent)] font-extrabold text-[var(--user-accent-text)]`}
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
      className="border-y border-[var(--user-border)] bg-[color-mix(in_srgb,var(--user-accent)_4%,var(--user-bg))]"
    >
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5 sm:mb-10">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--user-accent)]">
              Customer Stories
            </p>
            <h2 id="testimonials-title" className="mt-1.5 text-2xl font-extrabold leading-[1.15] tracking-tight text-[var(--user-text)] sm:text-4xl">
              Loved by stores across Pakistan
            </h2>
          </div>

          <div
            className="flex items-center gap-3 rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)] py-2 pl-4 pr-5 shadow-sm"
            aria-label={`Average rating ${TESTIMONIAL_SUMMARY.rating}`}
          >
            <Stars rating={4.8} size={14} />
            <span className="text-sm font-extrabold tabular-nums text-[var(--user-text)]">
              {TESTIMONIAL_SUMMARY.rating}
            </span>
            <span className="hidden text-[10px] font-semibold uppercase leading-4 tracking-wide text-[var(--user-text-muted)] sm:inline">
              {TESTIMONIAL_SUMMARY.text}
            </span>
          </div>
        </div>

        {/* Featured quote — editorial split */}
        <figure className="grid overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-sm lg:grid-cols-12">
          <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-8 lg:p-10">
            <Quote size={28} strokeWidth={1.5} aria-hidden="true" className="text-[var(--user-accent)]" fill="var(--user-accent-soft)" />
            <blockquote className="mt-4 text-lg font-semibold leading-8 text-[var(--user-text)] sm:text-2xl sm:leading-[1.45]">
              &ldquo;{featured.text}&rdquo;
            </blockquote>
            <div className="mt-5">
              <Stars rating={featured.rating} size={16} />
            </div>
          </div>
          <figcaption className="flex flex-col justify-center gap-4 border-t border-[var(--user-border)] bg-[var(--user-bg-hover)] p-6 sm:p-8 lg:col-span-4 lg:border-l lg:border-t-0 lg:p-8">
            <Avatar initials={featured.initials} size="lg" />
            <div>
              <p className="text-lg font-extrabold text-[var(--user-text)]">{featured.name}</p>
              <p className="mt-1 text-sm font-medium text-[var(--user-text-muted)]">{featured.role}</p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
              <BadgeCheck size={12} aria-hidden="true" />
              Verified customer
            </span>
          </figcaption>
        </figure>

        {/* Compact cards */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rest.slice(0, 4).map((t) => (
            <figure
              key={t.name}
              className="flex h-full flex-col rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 shadow-sm transition-shadow duration-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <Stars rating={t.rating} size={14} />
                <BadgeCheck size={16} className="shrink-0 text-emerald-500" role="img" aria-label="Verified customer" />
              </div>
              <blockquote className="mt-3 flex-1 text-[13px] leading-6 text-[var(--user-text-secondary)]">
                &ldquo;{t.text}&rdquo;
              </blockquote>
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
      </div>
    </section>
  );
}
