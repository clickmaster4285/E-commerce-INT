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
        className="w-full flex items-center justify-between py-4 lg:py-0 lg:mb-3 lg:cursor-default text-left group"
      >
        <h3 className="text-[var(--user-text)] font-bold text-sm lg:text-xs uppercase tracking-wider">{title}</h3>
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
        <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-5 lg:py-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
            <TrustBadge icon={<Truck size={18} />} title="Free Delivery" subtitle="Over Rs. 5,000" />
            <TrustBadge icon={<ShieldCheck size={18} />} title="Secure Payment" subtitle="100% protected" />
            <TrustBadge icon={<CreditCard size={18} />} title="Easy Returns" subtitle="7-day policy" />
            <TrustBadge icon={<Phone size={18} />} title="24/7 Support" subtitle="Dedicated help" />
          </div>
        </div>
      </div>

      {/* ✅ MAIN FOOTER — Mobile: accordion, Desktop: grid */}
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-2 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 lg:gap-6">
          {/* BRAND — Mobile pe accordion, Desktop pe col-span-2 */}
          <div className="border-b border-[var(--user-border)] lg:border-0 lg:col-span-2 lg:pr-6">
            <div className="py-4 lg:py-0">
              <Link href="/" className="inline-block">
                <h2 className="flex items-center gap-2.5 lg:gap-2">
                  <StoreLogo store={store} sizeClass="w-9 h-9 lg:w-8 lg:h-8" />
                  <span className="font-black text-xl lg:text-lg tracking-wide text-[var(--user-text)]">{storeName}</span>
                </h2>
              </Link>
            </div>

            {tagline && (
              <p className="text-[var(--user-text-muted)] text-sm lg:text-[0.8125rem] leading-6 lg:leading-5 max-w-sm mb-4 lg:mb-3 hidden lg:block">
                {tagline}
              </p>
            )}

            {/* Mobile: compact contact info in accordion */}
            <FooterSection title="Contact" defaultOpen={false}>
              <div className="space-y-2.5 text-sm text-[var(--user-text-muted)]">
                {supportEmail && (
                  <a href={`mailto:${supportEmail}`} className="flex items-center gap-2.5 hover:text-[var(--user-accent)] transition text-[0.8125rem]">
                    <Mail size={14} className="text-[var(--user-accent)] shrink-0" />
                    <span className="truncate">{supportEmail}</span>
                  </a>
                )}
                {supportPhone && (
                  <a href={phoneHref} className="flex items-center gap-2.5 hover:text-[var(--user-accent)] transition text-[0.8125rem]">
                    <Phone size={14} className="text-[var(--user-accent)] shrink-0" />
                    {supportPhone}
                  </a>
                )}
                {(address || country) && (
                  <p className="flex items-start gap-2.5 text-[0.8125rem]">
                    <MapPin size={14} className="text-[var(--user-accent)] shrink-0 mt-0.5" />
                    <span>{address ? `${address}, ${country}` : country}</span>
                  </p>
                )}
              </div>
            </FooterSection>

            {/* Desktop: inline contact (always visible) */}
            <div className="hidden lg:block mt-6 lg:mt-4 space-y-3 lg:space-y-2 text-sm lg:text-[0.8125rem] text-[var(--user-text-muted)]">
              {supportEmail && (
                <a href={`mailto:${supportEmail}`} className="flex items-center gap-3 lg:gap-2 hover:text-[var(--user-accent)] transition">
                  <Mail size={16} className="text-[var(--user-accent)] shrink-0" /> <span className="truncate">{supportEmail}</span>
                </a>
              )}
              {supportPhone && (
                <a href={phoneHref} className="flex items-center gap-3 lg:gap-2 hover:text-[var(--user-accent)] transition">
                  <Phone size={16} className="text-[var(--user-accent)] shrink-0" /> {supportPhone}
                </a>
              )}
              {(address || country) && (
                <p className="flex items-center gap-3 lg:gap-2">
                  <MapPin size={16} className="text-[var(--user-accent)] shrink-0" />
                  {address ? `${address}, ${country}` : country}
                </p>
              )}
            </div>
          </div>

          {/* CATEGORIES */}
          <FooterSection title="Categories">
            <ul className="space-y-2 lg:space-y-2 text-sm text-[var(--user-text-muted)]">
              {footerCategories.length > 0 ? (
                footerCategories.map((cat) => (
                  <li key={cat._id}>
                    <Link href={`/?category=${cat._id}`} className="hover:text-[var(--user-accent)] transition inline-block text-[0.8125rem] lg:text-[0.8125rem]">
                      {cat.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-[0.8125rem] text-[var(--user-text-subtle)]">No categories</li>
              )}
            </ul>
          </FooterSection>

          {/* SUPPORT */}
          <FooterSection title="Support">
            <ul className="space-y-2 lg:space-y-2 text-sm text-[var(--user-text-muted)]">
              {supportEmail && (
                <li>
                  <Link href={`mailto:${supportEmail}`} className="hover:text-[var(--user-accent)] transition inline-block text-[0.8125rem] lg:text-[0.8125rem]">Contact Us</Link>
                </li>
              )}
              <li><Link href="#" className="hover:text-[var(--user-accent)] transition inline-block text-[0.8125rem] lg:text-[0.8125rem]">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-[var(--user-accent)] transition inline-block text-[0.8125rem] lg:text-[0.8125rem]">Terms & Conditions</Link></li>
              <li><Link href="#" className="hover:text-[var(--user-accent)] transition inline-block text-[0.8125rem] lg:text-[0.8125rem]">Returns</Link></li>
              <li><Link href="/account" className="hover:text-[var(--user-accent)] transition inline-block text-[0.8125rem] lg:text-[0.8125rem]">My Account</Link></li>
            </ul>
          </FooterSection>

          {/* FOLLOW US — Desktop pe col-span-2 */}
          <div className="lg:col-span-2 border-b border-[var(--user-border)] lg:border-0 last:border-0">
            <FooterSection title="Follow Us">
              <p className="text-[0.8125rem] lg:text-xs text-[var(--user-text-muted)] mb-3 lg:mb-2 hidden lg:block">
                Stay connected with our latest updates.
              </p>
              <div className="flex flex-wrap gap-2 lg:gap-1.5">
                {activeSocials.length > 0 ? (
                  activeSocials.map(({ key, Icon, url, label }) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 lg:w-8 lg:h-8 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-text-muted)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] hover:border-[var(--user-accent)] transition active:scale-95"
                      aria-label={label}
                    >
                      <Icon size={14} />
                    </a>
                  ))
                ) : (
                  Object.entries(SOCIAL_ICONS).map(([key, { Icon, label }]) => (
                    <button
                      key={key}
                      className="w-9 h-9 lg:w-8 lg:h-8 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-text-muted)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] hover:border-[var(--user-accent)] transition active:scale-95"
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
        <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4 lg:py-3 flex flex-col sm:flex-row items-center justify-between gap-2 lg:gap-1.5">
          <p className="text-[0.6875rem] text-[var(--user-text-subtle)] text-center sm:text-left">
            © {new Date().getFullYear()}{" "}
            <span className="text-[var(--user-text-muted)] font-semibold">{storeName}</span>. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-[0.6875rem] text-[var(--user-text-subtle)]">
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
      <span className="w-9 h-9 lg:w-9 lg:h-9 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-accent)] shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[0.6875rem] lg:text-[0.8125rem] font-bold text-[var(--user-text)] leading-tight">{title}</p>
        <p className="text-[0.5625rem] lg:text-[0.6875rem] text-[var(--user-text-subtle)] mt-0.5 leading-tight">{subtitle}</p>
      </div>
    </div>
  );
}