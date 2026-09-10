"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { categoryApi } from "@/apis/user/categoryApi";
import { storeApi } from "@/apis/user/storeApi";
import { Mail, Phone, MapPin, CreditCard, Truck, ShieldCheck, ChevronDown } from "lucide-react";
import { FaFacebookF, FaInstagram, FaTwitter, FaYoutube, FaLinkedinIn } from "react-icons/fa";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

function StoreLogo({ store, sizeClass = "w-9 h-9" }) {
  const logoUrl = store?.logo?.img_url
    ? store.logo.img_url.startsWith("http")
      ? store.logo.img_url
      : `${API_ORIGIN}/${store.logo.img_url}`
    : null;
  const letter = (store?.store_name || "C").charAt(0).toUpperCase();

  if (!logoUrl) {
    return (
      <span className={`${sizeClass} rounded-lg bg-[var(--user-accent)] text-[var(--user-accent-text)] font-black text-lg flex items-center justify-center shrink-0`}>
        {letter}
      </span>
    );
  }

  return (
    <img src={logoUrl} alt={store?.store_name || "Store"} className={`${sizeClass} rounded-lg object-cover shrink-0`} />
  );
}

const SOCIAL_ICONS = {
  facebook: { Icon: FaFacebookF, color: "#1877F2", label: "Facebook" },
  instagram: { Icon: FaInstagram, color: "#E4405F", label: "Instagram" },
  twitter: { Icon: FaTwitter, color: "#1DA1F2", label: "Twitter" },
  youtube: { Icon: FaYoutube, color: "#FF0000", label: "YouTube" },
  linkedin: { Icon: FaLinkedinIn, color: "#0A66C2", label: "LinkedIn" },
};

// ✅ MOBILE COLLAPSIBLE SECTION — desktop pe always open
function FooterSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[var(--user-border)] lg:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 lg:py-0 lg:mb-5 lg:cursor-default text-left group"
      >
        <h3 className="text-[var(--user-text)] font-bold text-sm uppercase tracking-wider">{title}</h3>
        <ChevronDown
          size={16}
          className={`text-[var(--user-text-muted)] transition-transform duration-200 lg:hidden ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 lg:!max-h-none lg:!opacity-100 lg:!pb-0 ${
          open ? "max-h-96 opacity-100 pb-4" : "max-h-0 opacity-0 pb-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default function Footer() {
  const { data: store = null } = useQuery({
    queryKey: ["storeInfo"],
    queryFn: storeApi.getPublic,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const storeName = store?.store_name || "";
  const tagline = store?.tagline || "";
  const supportEmail = store?.support_email || store?.email || "";
  const supportPhone = store?.support_phone || store?.phone || "";
  const country = store?.country || "";
  const address = store?.address || "";

  const activeSocials = Object.entries(SOCIAL_ICONS)
    .map(([key, cfg]) => ({ key, ...cfg, url: store?.social_links?.[key] || "" }))
    .filter((s) => s.url);

  const footerCategories = categories.slice(0, 5);
  const phoneHref = `tel:${supportPhone.replace(/[^0-9+]/g, "")}`;

  return (
    <footer className="bg-[var(--user-bg-elevated)] border-t border-[var(--user-border)]">
      {/* ✅ TRUST BADGES — Mobile: 2-col compact, Desktop: 4-col */}
      <div className="border-b border-[var(--user-border)]">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-5 lg:py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
            <TrustBadge icon={<Truck size={18} />} title="Free Delivery" subtitle="Over Rs. 5,000" />
            <TrustBadge icon={<ShieldCheck size={18} />} title="Secure Payment" subtitle="100% protected" />
            <TrustBadge icon={<CreditCard size={18} />} title="Easy Returns" subtitle="7-day policy" />
            <TrustBadge icon={<Phone size={18} />} title="24/7 Support" subtitle="Dedicated help" />
          </div>
        </div>
      </div>

      {/* ✅ MAIN FOOTER — Mobile: accordion, Desktop: grid */}
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-2 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 lg:gap-8">
          {/* BRAND — Mobile pe accordion, Desktop pe col-span-2 */}
          <div className="border-b border-[var(--user-border)] lg:border-0 lg:col-span-2 lg:pr-8">
            <div className="py-4 lg:py-0">
              <Link href="/" className="inline-block">
                <h2 className="flex items-center gap-2.5">
                  <StoreLogo store={store} />
                  <span className="font-black text-xl lg:text-2xl tracking-wide text-[var(--user-text)]">{storeName}</span>
                </h2>
              </Link>
            </div>

            {tagline && (
              <p className="text-[var(--user-text-muted)] text-sm leading-6 max-w-sm mb-4 hidden lg:block">
                {tagline}
              </p>
            )}

            {/* Mobile: compact contact info in accordion */}
            <FooterSection title="Contact" defaultOpen={false}>
              <div className="space-y-2.5 text-sm text-[var(--user-text-muted)]">
                {supportEmail && (
                  <a href={`mailto:${supportEmail}`} className="flex items-center gap-2.5 hover:text-[var(--user-accent)] transition text-[13px]">
                    <Mail size={14} className="text-[var(--user-accent)] shrink-0" />
                    <span className="truncate">{supportEmail}</span>
                  </a>
                )}
                {supportPhone && (
                  <a href={phoneHref} className="flex items-center gap-2.5 hover:text-[var(--user-accent)] transition text-[13px]">
                    <Phone size={14} className="text-[var(--user-accent)] shrink-0" />
                    {supportPhone}
                  </a>
                )}
                {(address || country) && (
                  <p className="flex items-start gap-2.5 text-[13px]">
                    <MapPin size={14} className="text-[var(--user-accent)] shrink-0 mt-0.5" />
                    <span>{address ? `${address}, ${country}` : country}</span>
                  </p>
                )}
              </div>
            </FooterSection>

            {/* Desktop: inline contact (always visible) */}
            <div className="hidden lg:block mt-6 space-y-3 text-sm text-[var(--user-text-muted)]">
              {supportEmail && (
                <a href={`mailto:${supportEmail}`} className="flex items-center gap-3 hover:text-[var(--user-accent)] transition">
                  <Mail size={16} className="text-[var(--user-accent)]" /> {supportEmail}
                </a>
              )}
              {supportPhone && (
                <a href={phoneHref} className="flex items-center gap-3 hover:text-[var(--user-accent)] transition">
                  <Phone size={16} className="text-[var(--user-accent)]" /> {supportPhone}
                </a>
              )}
              {(address || country) && (
                <p className="flex items-center gap-3">
                  <MapPin size={16} className="text-[var(--user-accent)]" />
                  {address ? `${address}, ${country}` : country}
                </p>
              )}
            </div>
          </div>

          {/* CATEGORIES */}
          <FooterSection title="Categories">
            <ul className="space-y-2 lg:space-y-3 text-sm text-[var(--user-text-muted)]">
              {footerCategories.length > 0 ? (
                footerCategories.map((cat) => (
                  <li key={cat._id}>
                    <Link href={`/category/${cat._id}`} className="hover:text-[var(--user-accent)] transition inline-block text-[13px] lg:text-sm">
                      {cat.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-[13px] text-[var(--user-text-subtle)]">No categories</li>
              )}
            </ul>
          </FooterSection>

          {/* SUPPORT */}
          <FooterSection title="Support">
            <ul className="space-y-2 lg:space-y-3 text-sm text-[var(--user-text-muted)]">
              {supportEmail && (
                <li>
                  <Link href={`mailto:${supportEmail}`} className="hover:text-[var(--user-accent)] transition inline-block text-[13px] lg:text-sm">Contact Us</Link>
                </li>
              )}
              <li><Link href="#" className="hover:text-[var(--user-accent)] transition inline-block text-[13px] lg:text-sm">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-[var(--user-accent)] transition inline-block text-[13px] lg:text-sm">Terms & Conditions</Link></li>
              <li><Link href="#" className="hover:text-[var(--user-accent)] transition inline-block text-[13px] lg:text-sm">Returns</Link></li>
              <li><Link href="/account" className="hover:text-[var(--user-accent)] transition inline-block text-[13px] lg:text-sm">My Account</Link></li>
            </ul>
          </FooterSection>

          {/* FOLLOW US — Desktop pe col-span-2 */}
          <div className="lg:col-span-2 border-b border-[var(--user-border)] lg:border-0 last:border-0">
            <FooterSection title="Follow Us">
              <p className="text-[13px] text-[var(--user-text-muted)] mb-3 hidden lg:block">
                Stay connected with our latest updates.
              </p>
              <div className="flex flex-wrap gap-2">
                {activeSocials.length > 0 ? (
                  activeSocials.map(({ key, Icon, url, label }) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-text-muted)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] hover:border-[var(--user-accent)] transition active:scale-95"
                      aria-label={label}
                    >
                      <Icon size={14} />
                    </a>
                  ))
                ) : (
                  Object.entries(SOCIAL_ICONS).map(([key, { Icon, label }]) => (
                    <button
                      key={key}
                      className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-text-muted)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] hover:border-[var(--user-accent)] transition active:scale-95"
                      aria-label={label}
                    >
                      <Icon size={14} />
                    </button>
                  ))
                )}
              </div>
            </FooterSection>
          </div>
        </div>
      </div>

      {/* ✅ BOTTOM BAR — Mobile: stacked center, Desktop: row */}
      <div className="border-t border-[var(--user-border)] bg-[var(--user-bg)]">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-4 lg:py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-[var(--user-text-subtle)] text-center sm:text-left">
            © {new Date().getFullYear()}{" "}
            <span className="text-[var(--user-text-muted)] font-semibold">{storeName}</span>. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-[var(--user-text-subtle)]">
            <Link href="#" className="hover:text-[var(--user-accent)] transition">Privacy</Link>
            <Link href="#" className="hover:text-[var(--user-accent)] transition">Terms</Link>
            <Link href="#" className="hover:text-[var(--user-accent)] transition">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function TrustBadge({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-2.5 lg:gap-3">
      <span className="w-9 h-9 lg:w-11 lg:h-11 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-accent)] shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] lg:text-sm font-bold text-[var(--user-text)] leading-tight">{title}</p>
        <p className="text-[9px] lg:text-xs text-[var(--user-text-subtle)] mt-0.5 leading-tight">{subtitle}</p>
      </div>
    </div>
  );
}