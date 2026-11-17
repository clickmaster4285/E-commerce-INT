import { BadgePercent, ArrowRight } from "lucide-react";

export default function PromoBanner() {
  return (
    <section aria-labelledby="promo-title" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="promo-banner relative overflow-hidden rounded-3xl px-6 py-10 text-center text-white sm:px-10 sm:py-14">
        {/* Decorative rings */}
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full border-[26px] border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-14 h-64 w-64 rounded-full border-[30px] border-black/10" />
        <div aria-hidden="true" className="pointer-events-none absolute left-1/3 top-6 h-20 w-20 rounded-full bg-white/10 blur-xl" />

        <p className="flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] text-white/85">
          <BadgePercent size={16} aria-hidden="true" /> Click Master Mega Days
        </p>
        <h2 id="promo-title" className="mx-auto mt-3 max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">
          Up to 70% OFF
          <br />
          on Kitchen &amp; Appliances
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm font-medium text-white/85 sm:text-base">
          Sirf 48 ghante — is liye order ab karo, delivery kal tak.
        </p>
        <a
          href="#deals"
          className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-white px-6 text-base font-extrabold text-[#c2410c] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
        >
          Grab the Deal
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
