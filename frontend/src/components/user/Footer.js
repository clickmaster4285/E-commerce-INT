"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { categoryApi } from "@/apis/user/categoryApi";
import { storeApi } from "@/apis/user/storeApi";
import { Mail, Phone, MapPin } from "lucide-react";
import {
  FaApple,
  FaInstagram,
  FaFacebookF,
  FaYoutube,
  FaPinterest,
  FaTiktok,
  FaLinkedinIn,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

function StoreLogo({ store, sizeClass = "w-10 h-10" }) {
  const logoUrl = store?.logo?.img_url
    ? store.logo.img_url.startsWith("http")
      ? store.logo.img_url
      : `${API_ORIGIN}/${store.logo.img_url}`
    : null;
  const letter = (store?.store_name || "C").charAt(0).toUpperCase();

  if (!logoUrl) {
    return (
    <span className={`${sizeClass} rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)] text-[var(--user-text)] font-semibold text-lg flex items-center justify-center shrink-0`}>
        {letter}
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={store?.store_name || "Store"}
      className={`${sizeClass} rounded-lg object-cover shrink-0 bg-[var(--user-bg-card)]`}
    />
  );
}

const SOCIAL_ICONS = {
  instagram: { Icon: FaInstagram, label: "Instagram" },
  facebook: { Icon: FaFacebookF, label: "Facebook" },
  twitter: { Icon: FaXTwitter, label: "X" },
  tiktok: { Icon: FaTiktok, label: "TikTok" },
  youtube: { Icon: FaYoutube, label: "YouTube" },
  pinterest: { Icon: FaPinterest, label: "Pinterest" },
  linkedin: { Icon: FaLinkedinIn, label: "LinkedIn" },
};

const linkCls =
  "block text-[13px] leading-5 text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition-colors";
const badgeCls =
  "inline-flex h-7 items-center rounded-md border border-[var(--user-border)] bg-[var(--user-bg-card)] px-2 text-[9px] font-medium text-[var(--user-text-muted)]";

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
  const locationText = address ? (country ? `${address}, ${country}` : address) : country;
  const phoneHref = `tel:${(supportPhone || "").replace(/[^0-9+]/g, "")}`;

  const activeSocials = Object.entries(SOCIAL_ICONS)
    .map(([key, cfg]) => ({ key, ...cfg, url: store?.social_links?.[key] || "" }))
    .filter((s) => s.url);

  const socialsToRender =
    activeSocials.length > 0
      ? activeSocials
      : Object.entries(SOCIAL_ICONS)
          .filter(([key]) => ["instagram", "facebook", "twitter", "tiktok", "youtube", "pinterest"].includes(key))
          .map(([key, cfg]) => ({ key, ...cfg, url: "#" }));

  const footerCategories = categories.slice(0, 5);

  return (
    <footer className="storefront-footer mt-8 border-t border-[var(--user-border-soft)] text-[var(--user-text-secondary)]">
      <div className="mx-auto w-full max-w-7xl px-4 pt-7 pb-5 sm:px-6 lg:px-8">
        {/* TOP — 4 columns, image jaisa dark layout, data apna */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-[1.3fr_1fr_1fr_1.35fr]">
          {/* COMPANY INFO — apna store data */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <h3 className="text-[var(--user-text)] font-medium text-sm mb-3">Company info</h3>
            <Link href="/" className="inline-flex items-center gap-2.5 mb-2.5">
              <StoreLogo store={store} />
              <span className="font-semibold text-base tracking-tight text-[var(--user-text)]">{storeName}</span>
            </Link>
            {tagline && (
              <p className="text-[13px] leading-5 text-[var(--user-text-muted)] max-w-xs mb-3">{tagline}</p>
            )}
            <ul className="space-y-2 text-[13px] text-[var(--user-text-muted)]">
              {supportEmail && (
                <li>
                  <a href={`mailto:${supportEmail}`} className="flex items-center gap-2 hover:text-[var(--user-accent)] transition-colors">
                    <Mail size={14} className="shrink-0" />
                    <span className="truncate">{supportEmail}</span>
                  </a>
                </li>
              )}
              {supportPhone && (
                <li>
                  <a href={phoneHref} className="flex items-center gap-2 hover:text-[var(--user-accent)] transition-colors">
                    <Phone size={14} className="shrink-0" />
                    <span>{supportPhone}</span>
                  </a>
                </li>
              )}
              {locationText && (
                <li className="flex items-start gap-2">
                  <MapPin size={14} className="shrink-0 mt-0.5" />
                  <span>{locationText}</span>
                </li>
              )}
            </ul>
          </div>

          {/* CATEGORIES — apni categories */}
          <div>
            <h3 className="text-[var(--user-text)] font-medium text-sm mb-3">Customer service</h3>
            <ul className="space-y-2">
              {footerCategories.length > 0 ? (
                footerCategories.map((cat) => (
                  <li key={cat._id}>
                    <Link href={`/?category=${cat._id}`} className={linkCls}>
                      {cat.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-[13px] text-[var(--user-text-subtle)]">No categories</li>
              )}
            </ul>
          </div>

          {/* SUPPORT — apne support links */}
          <div>
            <h3 className="text-[var(--user-text)] font-medium text-sm mb-3">Help</h3>
            <ul className="space-y-2">
              {supportEmail && (
                <li>
                  <Link href={`mailto:${supportEmail}`} className={linkCls}>
                    Contact Us
                  </Link>
                </li>
              )}
              <li><Link href="#" className={linkCls}>Privacy Policy</Link></li>
              <li><Link href="#" className={linkCls}>Terms &amp; Conditions</Link></li>
              <li><Link href="#" className={linkCls}>Returns</Link></li>
              <li><Link href="/account" className={linkCls}>My Account</Link></li>
            </ul>
          </div>

          {/* SOCIALS — sirf apne socials, app buttons nahi (app hamare paas nahi hai) */}
          <div className="col-span-2 lg:col-span-1">
            <h4 className="text-[var(--user-text)] font-medium text-sm mb-3">
              Connect with {storeName || "us"}
            </h4>
            <div className="flex items-center gap-3">
              {socialsToRender.map(({ key, Icon, url, label }) => (
                <a
                  key={key}
                  href={url || "#"}
                  target={url?.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--user-border)] text-[var(--user-text-muted)] hover:border-[var(--user-border-hover)] hover:bg-[var(--user-bg-card)] hover:text-[var(--user-accent)] transition-colors"
                >
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE — image wali strip, sirf layout (koi store data nahi hota isme) */}
        <div className="grid gap-6 border-t border-[var(--user-border-soft)] pt-5 mt-6 lg:grid-cols-2">
          <div>
            <h4 className="text-[var(--user-text)] font-medium text-sm mb-2.5">Security certification</h4>
            <div className="flex flex-wrap gap-2">
              <span className={badgeCls}>PCI DSS</span>
              <span className={`${badgeCls} italic`}>VISA</span>
              <span className={badgeCls}>ID Check</span>
              <span className={badgeCls}>SafeKey</span>
              <span className={badgeCls}>ProtectBuy</span>
              <span className={badgeCls}>JCB</span>
              <span className={badgeCls}>APWG</span>
            </div>
          </div>

          <div>
            <h4 className="text-[var(--user-text)] font-medium text-sm mb-2.5">We accept</h4>
            <div className="flex flex-wrap gap-2">
              <span className={badgeCls}>JazzCash</span>
              <span className={badgeCls}>easypaisa</span>
              <span className={`${badgeCls} px-2.5 italic`}>VISA</span>
              <span className={`${badgeCls} gap-0.5`}>
                <span className="w-4 h-4 rounded-full bg-[#eb001b] inline-block" />
                <span className="w-4 h-4 rounded-full bg-[#f79e1b] -ml-2 inline-block opacity-90" />
              </span>
              <span className={`${badgeCls} text-center text-[7px] leading-none`}>AMERICAN<br />EXPRESS</span>
              <span className={`${badgeCls} text-[8px]`}>DISCOVER</span>
              <span className={`${badgeCls} text-[8px]`}>UnionPay</span>
              <span className={`${badgeCls} gap-1 text-[10px]`}>
                <FaApple size={13} /> Pay
              </span>
              <span className={`${badgeCls} gap-1 text-[10px]`}>
                <span className="font-bold">G</span> Pay
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM — apna store naam */}
        <div className="border-t border-[var(--user-border-soft)] mt-6 pt-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-[var(--user-text-muted)] text-center sm:text-left">
              Â© {new Date().getFullYear()}{" "}
              <span className="text-[var(--user-text-secondary)] font-medium">{storeName}</span>. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs text-[var(--user-text-muted)]">
              <Link href="#" className="hover:text-[var(--user-accent)] transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-[var(--user-accent)] transition-colors">Terms</Link>
              <Link href="#" className="hover:text-[var(--user-accent)] transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
