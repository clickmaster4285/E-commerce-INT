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
      <span className={`${sizeClass} rounded-xl bg-white text-black font-black text-lg flex items-center justify-center shrink-0`}>
        {letter}
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={store?.store_name || "Store"}
      className={`${sizeClass} rounded-xl object-cover shrink-0 bg-white`}
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
  "block text-[13px] leading-5 text-[#c7c7c7] hover:text-white hover:underline underline-offset-4 transition";

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
    <footer className="bg-[#1a1a1a] text-[#e8e8e8] mt-10">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        {/* TOP — 4 columns, image jaisa dark layout, data apna */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-[1.3fr_1fr_1fr_1.35fr]">
          {/* COMPANY INFO — apna store data */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <h3 className="text-white font-bold text-[14px] mb-4">Company info</h3>
            <Link href="/" className="inline-flex items-center gap-2.5 mb-3">
              <StoreLogo store={store} />
              <span className="font-extrabold text-lg tracking-tight text-white">{storeName}</span>
            </Link>
            {tagline && (
              <p className="text-[13px] leading-5 text-[#c7c7c7] max-w-xs mb-4">{tagline}</p>
            )}
            <ul className="space-y-2.5 text-[13px] text-[#c7c7c7]">
              {supportEmail && (
                <li>
                  <a href={`mailto:${supportEmail}`} className="flex items-center gap-2 hover:text-white transition">
                    <Mail size={14} className="shrink-0" />
                    <span className="truncate">{supportEmail}</span>
                  </a>
                </li>
              )}
              {supportPhone && (
                <li>
                  <a href={phoneHref} className="flex items-center gap-2 hover:text-white transition">
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
            <h3 className="text-white font-bold text-[14px] mb-4">Customer service</h3>
            <ul className="space-y-3">
              {footerCategories.length > 0 ? (
                footerCategories.map((cat) => (
                  <li key={cat._id}>
                    <Link href={`/?category=${cat._id}`} className={linkCls}>
                      {cat.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-[13px] text-[#777]">No categories</li>
              )}
            </ul>
          </div>

          {/* SUPPORT — apne support links */}
          <div>
            <h3 className="text-white font-bold text-[14px] mb-4">Help</h3>
            <ul className="space-y-3">
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
            <h4 className="text-white font-bold text-[14px] mb-3">
              Connect with {storeName || "us"}
            </h4>
            <div className="flex items-center gap-5">
              {socialsToRender.map(({ key, Icon, url, label }) => (
                <a
                  key={key}
                  href={url || "#"}
                  target={url?.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-white hover:text-[#bbb] transition"
                >
                  <Icon size={22} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE — image wali strip, sirf layout (koi store data nahi hota isme) */}
        <div className="grid gap-8 lg:grid-cols-2 mt-10">
          <div>
            <h4 className="text-white font-bold text-[14px] mb-3">Security certification</h4>
            <div className="flex flex-wrap gap-1.5">
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center text-[9px] font-black text-[#2e7d32]">PCI DSS</span>
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center text-[10px] font-black italic text-[#1a1f71]">VISA</span>
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center text-[9px] font-bold text-black">ID Check</span>
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center text-[9px] font-bold text-[#333]">SafeKey</span>
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center text-[8px] font-bold text-[#2e7d32]">ProtectBuy</span>
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center text-[9px] font-black text-[#0066b3]">JCB</span>
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center text-[9px] font-black text-[#2e7d32]">APWG</span>
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold text-[14px] mb-3">We accept</h4>
            <div className="flex flex-wrap gap-1.5">
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center text-[9px] font-black text-[#e11d2e]">JazzCash</span>
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center text-[9px] font-black text-[#0a8a3c]">easypaisa</span>
              <span className="h-7 px-2.5 rounded-[3px] bg-white flex items-center text-[11px] font-black italic text-[#1a1f71]">VISA</span>
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center">
                <span className="w-4 h-4 rounded-full bg-[#eb001b] inline-block" />
                <span className="w-4 h-4 rounded-full bg-[#f79e1b] -ml-2 inline-block opacity-90" />
              </span>
              <span className="h-7 px-2 rounded-[3px] bg-[#2e77bc] flex items-center text-[7px] font-black text-white leading-none text-center">AMERICAN<br />EXPRESS</span>
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center text-[8px] font-black text-black">DISCOVER</span>
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center text-[8px] font-black text-[#1a1f71]">UnionPay</span>
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center gap-1 text-[10px] font-bold text-black">
                <FaApple size={13} /> Pay
              </span>
              <span className="h-7 px-2 rounded-[3px] bg-white flex items-center gap-1 text-[10px] font-bold text-black">
                <span className="font-black text-[#4285f4]">G</span> Pay
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM — apna store naam */}
        <div className="border-t border-white/10 mt-8 pt-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-[#8f8f8f] text-center sm:text-left">
              © {new Date().getFullYear()}{" "}
              <span className="text-[#c7c7c7] font-semibold">{storeName}</span>. All rights reserved.
            </p>
            <div className="flex items-center gap-5 text-xs text-[#8f8f8f]">
              <Link href="#" className="hover:text-white transition">Privacy</Link>
              <Link href="#" className="hover:text-white transition">Terms</Link>
              <Link href="#" className="hover:text-white transition">Cookies</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
