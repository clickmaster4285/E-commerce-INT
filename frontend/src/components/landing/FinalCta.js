import { ArrowRight, MessageCircle } from "lucide-react";
import { WHATSAPP_NUMBER } from "./content";

export default function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" id="final-cta" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-6 sm:px-6 lg:px-8">
      <div className="promo-banner relative overflow-hidden rounded-3xl px-6 py-12 text-center text-white sm:px-10 sm:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full border-[26px] border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-14 h-64 w-64 rounded-full border-[30px] border-black/10" />

        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/85">
          Ready to ship smarter?
        </p>
        <h2 id="final-cta-title" className="mx-auto mt-3 max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">
          Your store, fully managed —
          <br />
          in one place.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm font-medium text-white/85 sm:text-base">
          Talk to our team today — we&apos;ll show you the full platform on a live demo call.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Click Master Store! Show me the full platform on a demo.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-white px-6 text-base font-extrabold text-[#c2410c] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <MessageCircle size={20} aria-hidden="true" />
            Book a Free Demo
          </a>
          <a
            href="#how-it-works"
            className="inline-flex min-h-[52px] items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-6 text-base font-bold text-white backdrop-blur transition-all duration-200 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            See How It Works
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
