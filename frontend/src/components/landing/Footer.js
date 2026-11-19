import {
  MousePointerClick,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { FaFacebookF, FaInstagram, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { SITE, FOOTER } from "./content";

const SOCIAL_ICONS = {
  Facebook: FaFacebookF,
  Instagram: FaInstagram,
  "X (Twitter)": FaXTwitter,
  YouTube: FaYoutube,
};

export default function Footer() {
  return (
    <footer id="contact" className="landing-footer scroll-mt-24" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Click Master Store — footer
      </h2>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-4">
            <a href="/" className="flex min-h-[44px] items-center gap-2" aria-label="Click Master Store — home">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)]">
                <MousePointerClick size={20} aria-hidden="true" />
              </span>
              <span className="font-heading leading-none">
                <span className="block text-lg font-extrabold text-white">Click Master</span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-[#f57224]">Store</span>
              </span>
            </a>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[#a1aab6]">
              The complete commerce operating system for Pakistan — orders, quotes, invoices, shipping, inventory, POS, CRM and finance in one dashboard.
            </p>
            <div className="mt-4 flex gap-2">
              {FOOTER.socials.map(({ label, href }) => {
                const Icon = SOCIAL_ICONS[label] || FaFacebookF;
                return (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Click Master Store on ${label}`}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#28313c] bg-[#151a21] text-[#d1d5db] transition-all hover:border-[#f57224] hover:text-[#f57224] focus-visible:outline-2 focus-visible:outline-[#f57224]"
                  >
                    <Icon size={18} aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER.columns.map((col) => (
            <nav key={col.title} className="md:col-span-2" aria-label={col.title}>
              <p className="text-xs font-extrabold uppercase tracking-widest text-white">{col.title}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="inline-flex min-h-[32px] items-center text-[#a1aab6] transition-colors hover:text-[#f57224]">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* Contact */}
          <div className="md:col-span-4">
            <p className="text-xs font-extrabold uppercase tracking-widest text-white">Contact</p>
            <ul className="mt-3 space-y-2 text-sm text-[#a1aab6]">
              <li className="flex items-center gap-2">
                <MapPin size={16} className="shrink-0 text-[#f57224]" aria-hidden="true" />
                {SITE.address}
              </li>
              <li className="flex items-center gap-2">
                <Phone size={16} className="shrink-0 text-[#f57224]" aria-hidden="true" />
                <a href={`tel:${SITE.phone.replace(/\s/g, "")}`} className="inline-flex min-h-[32px] items-center hover:text-[#f57224]">{SITE.phone}</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={16} className="shrink-0 text-[#f57224]" aria-hidden="true" />
                <a href={`mailto:${SITE.email}`} className="inline-flex min-h-[32px] items-center hover:text-[#f57224]">{SITE.email}</a>
              </li>
            </ul>

            <p className="mt-6 text-xs font-extrabold uppercase tracking-widest text-white">Payments</p>
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Accepted payment methods">
              {FOOTER.payments.map((p) => (
                <li key={p} className="pay-badge">{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1c232c]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-[#8fa3bf] sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Click Master Store. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="/terms-conditions" className="hover:text-[#f57224]">Terms</a>
            <a href="/account" className="hover:text-[#f57224]">Privacy</a>
            <a href="#faq" className="hover:text-[#f57224]">FAQ</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
