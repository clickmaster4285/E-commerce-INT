"use client";

import FallbackImage from "@/components/common/FallbackImage";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { newsletterApi } from "@/apis/user/newsletterApi";
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
  FaXTwitter,
} from "@/lib/socialIcons";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";
import { useStoreTheme } from "@/storefront/ThemeProvider";
import { resolveThemeLink, isExternalHref, safeUrl } from "@/storefront/themeLinks";

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
    <span className={`${sizeClass} rounded-lg border border-user-line bg-user-card text-user-fg font-semibold text-lg flex items-center justify-center shrink-0`}>
        {letter}
      </span>
    );
  }

  return (
    <FallbackImage
      src={logoUrl}
      alt={store?.store_name || "Store"}
      className={`${sizeClass} rounded-lg object-cover shrink-0 bg-user-card`}
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
  "block text-[13px] leading-5 text-user-fg-muted hover:text-user-accent transition-colors";
const badgeCls =
  "inline-flex h-7 items-center rounded-md border border-user-line bg-user-card px-2 text-[9px] font-medium text-user-fg-muted";

// Footer column builder: top-level link + sub-links = apna column (2..7 columns)
const GRID_COLS = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
  7: "lg:grid-cols-7",
};

function FooterLink({ href, children }) {
  return isExternalHref(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkCls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={linkCls}>
      {children}
    </Link>
  );
}

/* Store editor Theme → Footer → "newsletter signup" (default off) */
function FooterNewsletter({ title }) {
  const { t, locale } = useTranslation();
  const { isPreview } = useStoreTheme();
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    // Editor preview me asli subscriber na bane
    if (isPreview) return setState("done");
    setState("sending");
    setError("");
    try {
      await newsletterApi.subscribe({ email, locale, source: "footer" });
      setState("done");
    } catch (err) {
      setError(err?.response?.data?.message || t("storefront.newsletter.error"));
      setState("error");
    }
  };

  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-user-line-soft pb-6 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-sm font-medium text-user-fg">{title}</p>
      {state === "done" ? (
        <p role="status" className="text-sm font-semibold text-user-success">
          {t("storefront.newsletter.thanks")}
        </p>
      ) : (
        <form onSubmit={submit} className="flex w-full max-w-md gap-2">
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("storefront.newsletter.placeholder")}
            aria-label={t("storefront.newsletter.placeholder")}
            className="h-10 min-w-0 flex-1 rounded-lg border border-user-line bg-user-card px-3 text-[13px] text-user-fg placeholder:text-user-fg-subtle"
          />
          <button
            type="submit"
            disabled={state === "sending"}
            className="h-10 shrink-0 rounded-lg bg-user-accent px-4 text-[13px] font-semibold text-user-accent-fg hover:bg-user-accent-hover disabled:opacity-60"
          >
            {t("storefront.newsletter.subscribe")}
          </button>
        </form>
      )}
      {state === "error" ? <p role="alert" className="text-xs font-medium text-user-danger">{error}</p> : null}
    </div>
  );
}

export default function Footer() {
  const { t } = useTranslation();
  const { fieldOf } = useLocalized();
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
  // Store editor Theme → Footer (khali text / missing = purana footer)
  const { theme: storeTheme } = useStoreTheme();
  const footerCfg = storeTheme?.settings?.footer || {};
  const showCategories = footerCfg.showCategories !== false;
  const showHelp = footerCfg.showHelp !== false;
  const showSocials = footerCfg.showSocials !== false;
  const showBadges = footerCfg.showBadges !== false;
  const paymentMethods = String(footerCfg.paymentMethods || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 16);

  const tagline = footerCfg.aboutText || fieldOf(store, "tagline") || t("store.defaultTagline");
  const supportEmail = store?.support_email || store?.email || "";
  const supportPhone = store?.support_phone || store?.phone || "";
  const country = store?.country || "";
  const address = store?.address || "";
  const locationText = address ? (country ? `${address}, ${country}` : address) : country;
  const phoneHref = `tel:${(supportPhone || "").replace(/[^0-9+]/g, "")}`;

  const activeSocials = Object.entries(SOCIAL_ICONS)
    .map(([key, cfg]) => ({ key, ...cfg, url: safeUrl(store?.social_links?.[key], { allowMailto: false }) || "" }))
    .filter((s) => s.url);

  const socialsToRender =
    activeSocials.length > 0
      ? activeSocials
      : Object.entries(SOCIAL_ICONS)
          .filter(([key]) => ["instagram", "facebook", "twitter", "tiktok", "youtube", "pinterest"].includes(key))
          .map(([key, cfg]) => ({ key, ...cfg, url: "#" }));

  const footerCategories = categories.slice(0, 5);

  const footerItems = (storeTheme?.menus?.footer || []).map((item) => ({
    id: item.id,
    label: item.label,
    href: resolveThemeLink(item.link),
    children: (item.children || [])
      .map((c) => ({ id: c.id, label: c.label, href: resolveThemeLink(c.link) }))
      .filter((c) => c.label && c.href),
  }));
  // Sub-links wale items = apne columns; baaki Help column me (purana behavior)
  const footerColumns = footerItems.filter((item) => item.label && item.children.length);
  const footerMenu = footerItems.filter((item) => !item.children.length && item.label && item.href);
  const columnCount = 1 + Number(showCategories) + Number(showHelp) + footerColumns.length + Number(showSocials);
  const gridCols = footerColumns.length
    ? GRID_COLS[Math.min(7, Math.max(2, columnCount))]
    : "lg:grid-cols-[1.3fr_1fr_1fr_1.35fr]";

  return (
    <footer className="storefront-footer mt-8 border-t border-user-line-soft text-user-fg-secondary">
      <div className="mx-auto w-full max-w-7xl px-4 pt-7 pb-5 sm:px-6 lg:px-8">
        {footerCfg.showNewsletter ? <FooterNewsletter title={footerCfg.newsletterTitle || t("storefront.newsletter.subscribe")} /> : null}

        {/* TOP — 4 columns (custom columns ho to zyada), data apna */}
        <div className={`grid grid-cols-2 gap-x-6 gap-y-6 ${footerColumns.length ? "sm:grid-cols-3" : ""} ${gridCols}`}>
          {/* COMPANY INFO — apna store data */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <h3 className="text-user-fg font-medium text-sm mb-3">{t("footer.companyInfo")}</h3>
            <Link href="/" className="inline-flex items-center gap-2.5 mb-2.5">
              <StoreLogo store={store} />
              <span className="font-semibold text-base tracking-tight text-user-fg">{storeName}</span>
            </Link>
            {tagline && (
              <p className="text-[13px] leading-5 text-user-fg-muted max-w-xs mb-3">{tagline}</p>
            )}
            <ul className="space-y-2 text-[13px] text-user-fg-muted">
              {supportEmail && (
                <li>
                  <a href={`mailto:${supportEmail}`} className="flex items-center gap-2 hover:text-user-accent transition-colors">
                    <Mail size={14} className="shrink-0" />
                    <span className="truncate">{supportEmail}</span>
                  </a>
                </li>
              )}
              {supportPhone && (
                <li>
                  <a href={phoneHref} className="flex items-center gap-2 hover:text-user-accent transition-colors">
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
          {showCategories && (
          <div>
            <h3 className="text-user-fg font-medium text-sm mb-3">{t("footer.customerService")}</h3>
            <ul className="space-y-2">
              {footerCategories.length > 0 ? (
                footerCategories.map((cat) => (
                  <li key={cat._id}>
                    <Link href={`/?category=${cat._id}`} className={linkCls}>
                      {fieldOf(cat, "name")}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-[13px] text-user-fg-subtle">{t("footer.noCategories")}</li>
              )}
            </ul>
          </div>
          )}

          {/* SUPPORT — apne support links */}
          {showHelp && (
          <div>
            <h3 className="text-user-fg font-medium text-sm mb-3">{footerCfg.helpTitle || t("footer.help")}</h3>
            <ul className="space-y-2">
              {supportEmail && (
                <li>
                  <Link href={`mailto:${supportEmail}`} className={linkCls}>
                    {t("footer.contactUs")}
                  </Link>
                </li>
              )}
              {/* Store editor footer menu — ho to placeholder (#) links ki jagah */}
              {footerMenu.length > 0 ? (
                footerMenu.map((item) => (
                  <li key={item.id}>
                    {isExternalHref(item.href) ? (
                      <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkCls}>{item.label}</a>
                    ) : (
                      <Link href={item.href} className={linkCls}>{item.label}</Link>
                    )}
                  </li>
                ))
              ) : (
                <>
                  <li><Link href="#" className={linkCls}>{t("footer.privacyPolicy")}</Link></li>
                  <li><Link href="#" className={linkCls}>{t("footer.termsConditions")}</Link></li>
                  <li><Link href="#" className={linkCls}>{t("footer.returns")}</Link></li>
                </>
              )}
              <li><Link href="/account" className={linkCls}>{t("footer.myAccount")}</Link></li>
            </ul>
          </div>
          )}

          {/* STORE EDITOR FOOTER COLUMNS (Menus → Footer menu → sub-links) */}
          {footerColumns.map((column) => (
            <div key={column.id}>
              <h3 className="text-user-fg font-medium text-sm mb-3">{column.label}</h3>
              <ul className="space-y-2">
                {column.children.map((link) => (
                  <li key={link.id}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* SOCIALS — sirf apne socials, app buttons nahi (app hamare paas nahi hai) */}
          {showSocials && (
          <div className="col-span-2 lg:col-span-1">
            <h4 className="text-user-fg font-medium text-sm mb-3">
              {t("footer.connectWith", { name: storeName || "us" })}
            </h4>
            <div className="flex items-center gap-3">
              {socialsToRender.map(({ key, Icon, url, label }) => (
                <a
                  key={key}
                  href={url || "#"}
                  target={url?.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-user-line text-user-fg-muted hover:border-user-line-hover hover:bg-user-card hover:text-user-accent transition-colors"
                >
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>
          )}
        </div>

        {/* MIDDLE — image wali strip, sirf layout (koi store data nahi hota isme) */}
        {showBadges && (
        <div className="grid gap-6 border-t border-user-line-soft pt-5 mt-6 lg:grid-cols-2">
          <div>
            <h4 className="text-user-fg font-medium text-sm mb-2.5">{t("footer.securityCertification")}</h4>
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
            <h4 className="text-user-fg font-medium text-sm mb-2.5">{t("footer.weAccept")}</h4>
            {paymentMethods.length > 0 ? (
              /* Store editor: seller ke apne payment methods */
              <div className="flex flex-wrap gap-2">
                {paymentMethods.map((method) => (
                  <span key={method} className={badgeCls}>{method}</span>
                ))}
              </div>
            ) : (
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
            )}
          </div>
        </div>
        )}

        {/* BOTTOM — apna store naam */}
        <div className="border-t border-user-line-soft mt-6 pt-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-user-fg-muted text-center sm:text-left">
              © {new Date().getFullYear()}{" "}
              <span className="text-user-fg-secondary font-medium">{storeName}</span>. {footerCfg.copyright || t("header.allRightsReserved")}
            </p>
            <div className="flex items-center gap-4 text-xs text-user-fg-muted">
              <Link href="#" className="hover:text-user-accent transition-colors">{t("footer.privacyPolicy")}</Link>
              <Link href="#" className="hover:text-user-accent transition-colors">{t("footer.termsConditions")}</Link>
              <Link href="#" className="hover:text-user-accent transition-colors">{t("footer.cookies")}</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
