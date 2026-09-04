"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { categoryApi } from "@/apis/user/categoryApi";
import { storeApi } from "@/apis/user/storeApi";
import { Mail, Phone, MapPin, CreditCard, Truck, ShieldCheck } from "lucide-react";
import { FaFacebookF, FaInstagram, FaTwitter, FaYoutube, FaLinkedinIn } from "react-icons/fa";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

// ✅ Store Logo — dynamic + fallback letter
function StoreLogo({ store, sizeClass = "w-9 h-9" }) {
  const logoUrl = store?.logo?.img_url
    ? store.logo.img_url.startsWith("http")
      ? store.logo.img_url
      : `${API_ORIGIN}/${store.logo.img_url}`
    : null;
  const letter = (store?.store_name || "C").charAt(0).toUpperCase();

  if (!logoUrl) {
    return (
      <span
        className={`${sizeClass} rounded-lg bg-[var(--user-accent)] text-[var(--user-accent-text)] font-black text-lg flex items-center justify-center shrink-0`}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={store?.store_name || "Store"}
      className={`${sizeClass} rounded-lg object-cover shrink-0`}
    />
  );
}

// ✅ Social icon map
const SOCIAL_ICONS = {
  facebook: { Icon: FaFacebookF, color: "#1877F2", label: "Facebook" },
  instagram: { Icon: FaInstagram, color: "#E4405F", label: "Instagram" },
  twitter: { Icon: FaTwitter, color: "#1DA1F2", label: "Twitter" },
  youtube: { Icon: FaYoutube, color: "#FF0000", label: "YouTube" },
  linkedin: { Icon: FaLinkedinIn, color: "#0A66C2", label: "LinkedIn" },
};

export default function Footer() {
  // ✅ Store info (public)
  const { data: store = null } = useQuery({
    queryKey: ["storeInfo"],
    queryFn: storeApi.getPublic,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Categories (top 5)
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

  // ✅ Active social links filter karein
  const activeSocials = Object.entries(SOCIAL_ICONS)
    .map(([key, cfg]) => ({
      key,
      ...cfg,
      url: store?.social_links?.[key] || "",
    }))
    .filter((s) => s.url);

  // ✅ Top 5 categories (footer ke liye)
  const footerCategories = categories.slice(0, 5);

  // ✅ Phone href clean karein (numbers only)
  const phoneHref = `tel:${supportPhone.replace(/[^0-9+]/g, "")}`;

  return (
<footer className="bg-[var(--user-bg-elevated)] border-t border-[var(--user-border)]">      {/* ✅ TRUST BADGES */}
      <div className="border-b border-[var(--user-border)]">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <TrustBadge
              icon={<Truck size={22} />}
              title="Free Delivery"
              subtitle="On orders over Rs. 5,000"
            />
            <TrustBadge
              icon={<ShieldCheck size={22} />}
              title="Secure Payment"
              subtitle="100% protected"
            />
            <TrustBadge
              icon={<CreditCard size={22} />}
              title="Easy Returns"
              subtitle="7-day return policy"
            />
            <TrustBadge
              icon={<Phone size={22} />}
              title="24/7 Support"
              subtitle="Dedicated help"
            />
          </div>
        </div>
      </div>

      {/* ✅ MAIN FOOTER */}
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* BRAND */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block">
              <h2 className="flex items-center gap-2.5">
                <StoreLogo store={store} />
                <span className="font-black text-xl lg:text-2xl tracking-wide text-[var(--user-text)]">
                  {storeName}
                </span>
              </h2>
            </Link>

            <p className="mt-4 text-[var(--user-text-muted)] text-sm leading-7 max-w-sm">
              {tagline}
            </p>

            <div className="mt-6 space-y-3 text-sm text-[var(--user-text-muted)]">
              <a
                href={`mailto:${supportEmail}`}
                className="flex items-center gap-3 hover:text-[var(--user-accent)] transition"
              >
                <Mail size={16} className="text-[var(--user-accent)]" />
                {supportEmail}
              </a>

              <a
                href={phoneHref}
                className="flex items-center gap-3 hover:text-[var(--user-accent)] transition"
              >
                <Phone size={16} className="text-[var(--user-accent)]" />
                {supportPhone}
              </a>

              <p className="flex items-center gap-3">
                <MapPin size={16} className="text-[var(--user-accent)]" />
                {address ? `${address}, ${country}` : country}
              </p>
            </div>
          </div>

          {/* CATEGORIES — Dynamic */}
          <div>
            <h3 className="text-[var(--user-text)] font-bold mb-5 text-sm uppercase tracking-wider">
              Categories
            </h3>

            <ul className="space-y-5 my-3 text-sm text-[var(--user-text-muted)]">
              {footerCategories.length > 0 ? (
                footerCategories.map((cat) => (
                  <FooterLink
                    key={cat._id}
                    href={`/category/${cat._id}`}
                    label={cat.name}
                  />
                ))
              ) : (
                <>
                
                </>
              )}
            </ul>
          </div>

          {/* SUPPORT */}
          <div>
            <h3 className="text-[var(--user-text)] font-bold mb-5 text-sm uppercase tracking-wider">
              Support
            </h3>

            <ul className="space-y-5 my-3 text-sm text-[var(--user-text-muted)]">
              <FooterLink href={`mailto:${supportEmail}`} label="Contact Us" />
              <FooterLink href="#" label="Privacy Policy" />
              <FooterLink href="#" label="Terms & Conditions" />
              <FooterLink href="#" label="Returns" />
              <FooterLink href="/account" label="My Account" />
            </ul>
          </div>

          {/* SOCIAL */}
          <div>
            <h3 className="text-[var(--user-text)] font-bold mb-5 text-sm uppercase tracking-wider">
              Follow Us
            </h3>

            <p className="text-sm py-3 text-[var(--user-text-muted)]  mb-4">
              Stay connected with our latest updates.
            </p>

            <div className="flex flex-wrap gap-2 my-10">
              {activeSocials.length > 0 ? (
                activeSocials.map(({ key, Icon, url, label }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-text-muted)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] hover:border-[var(--user-accent)] transition"
                    aria-label={label}
                  >
                    <Icon size={16} />
                  </a>
                ))
              ) : (
                // Fallback — static buttons
                Object.entries(SOCIAL_ICONS).map(([key, { Icon, label }]) => (
                  <button
                    key={key}
                    className="w-10 h-10 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-text-muted)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] hover:border-[var(--user-accent)] transition"
                    aria-label={label}
                  >
                    <Icon size={16} />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ BOTTOM BAR */}
      <div className="border-t border-[var(--user-border)] bg-[var(--user-bg)]">
<div className="max-w-[1400px] mx-auto px-4 lg:px-6 pt-5 pb-20 md:pb-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[11px] text-[var(--user-text-subtle)]">
            © {new Date().getFullYear()}{" "}
            <span className="text-[var(--user-text-muted)] font-semibold">
              {storeName}
            </span>
            . All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-[var(--user-text-subtle)]">
            <Link href="#" className="hover:text-[var(--user-accent)] transition">
              Privacy
            </Link>
            <Link href="#" className="hover:text-[var(--user-accent)] transition">
              Terms
            </Link>
            <Link href="#" className="hover:text-[var(--user-accent)] transition">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ✅ Reusable trust badge
function TrustBadge({ icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-11 h-11 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-accent)] shrink-0">
        {icon}
      </span>
      <div>
        <p className="text-xs lg:text-sm font-bold text-[var(--user-text)]">{title}</p>
        <p className="text-[10px] lg:text-xs text-[var(--user-text-subtle)] mt-0.5">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ✅ Reusable footer link
function FooterLink({ href, label }) {
  return (
    <li>
      <Link
        href={href}
        className="hover:text-[var(--user-accent)] transition inline-block"
      >
        {label}
      </Link>
    </li>
  );
}