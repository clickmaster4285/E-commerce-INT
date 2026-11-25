"use client";

/* ==========================================================
   STORE EDITOR — release 5 sections
   FAQ · Video · Countdown · Logo list · Image gallery · Contact form · Map
   Sirf --user-* tokens. Settings backend themeSchema se validated aate hain
   (video url http(s), endsAt ISO, images isi store ki uploads).
   ========================================================== */

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ChevronDown, Loader2, MapPin, Send } from "lucide-react";
import { userHttp } from "@/apis/axiosInstance";
import SectionHeading from "@/components/user/SectionHeading";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useStoreTheme } from "../ThemeProvider";
import { resolveThemeLink, isExternalHref } from "../themeLinks";
import { readableOn } from "../themeCss";

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const API_ORIGIN = (process.env.NEXT_PUBLIC_SERVERURL || "").replace(/\/api\/?$/, "");
const imageSrc = (url) => (!url ? "" : /^https?:/i.test(url) ? url : `${API_ORIGIN}${url}`);

function MaybeLink({ link, className, children }) {
  const href = resolveThemeLink(link);
  if (!href) return <div className={className}>{children}</div>;
  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

// ───────────────────────── FAQ ─────────────────────────
export function FaqSection({ settings = {}, blocks = [] }) {
  const items = blocks.filter((b) => b?.settings?.question && b?.settings?.answer);
  const [open, setOpen] = useState(0);
  if (!items.length) return null;
  return (
    <section className="mx-auto w-full max-w-3xl">
      {settings.heading ? <SectionHeading title={settings.heading} className="mb-4 px-1" /> : null}
      <div className="divide-y divide-user-line overflow-hidden rounded-2xl border border-user-line bg-user-card">
        {items.map((block, i) => {
          const isOpen = open === i;
          const panelId = `faq-${block.id}`;
          return (
            <div key={block.id}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start text-sm font-semibold text-user-fg hover:bg-user-hover sm:px-5"
              >
                <span>{block.settings.question}</span>
                <ChevronDown size={16} className={`shrink-0 text-user-fg-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen ? (
                <div id={panelId} className="whitespace-pre-line px-4 pb-4 text-sm leading-relaxed text-user-fg-secondary sm:px-5">
                  {block.settings.answer}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ───────────────────────── Video ─────────────────────────
/** YouTube / Vimeo link → privacy-friendly embed URL (warna null) */
export function videoEmbedUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || ""));
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const YT_ID = /^[A-Za-z0-9_-]{6,15}$/;
  let id = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = /^\/(?:shorts|embed|live)\/([^/?#]+)/.exec(u.pathname);
      id = m?.[1] || null;
    }
  }
  if (id && YT_ID.test(id)) return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = /\/(\d{5,12})(?:$|[/?#])/.exec(u.pathname);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return null;
}

const ASPECT = { wide: "aspect-video", square: "aspect-square max-w-xl", vertical: "aspect-[9/16] max-w-sm" };

export function VideoSection({ settings = {} }) {
  const { isPreview } = useStoreTheme();
  const src = videoEmbedUrl(settings.url);
  if (!src) {
    return isPreview ? (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-user-line text-sm text-user-fg-muted">
        Paste a YouTube or Vimeo link in the store editor
      </div>
    ) : null;
  }
  return (
    <section>
      {settings.heading ? <SectionHeading title={settings.heading} className="mb-4 px-1" /> : null}
      <div className={`mx-auto w-full overflow-hidden rounded-2xl border border-user-line bg-black ${ASPECT[settings.aspect] || ASPECT.wide}`}>
        <iframe
          src={src}
          title={settings.heading || "Video"}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full"
        />
      </div>
    </section>
  );
}

// ───────────────────────── Countdown ─────────────────────────
// 1s ticker (useSyncExternalStore) — server par null → hydration mismatch nahi
const subscribeTick = (cb) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};
const nowSeconds = () => Math.floor(Date.now() / 1000);

export function CountdownSection({ settings = {} }) {
  const { t } = useTranslation();
  const { isPreview } = useStoreTheme();
  const now = useSyncExternalStore(subscribeTick, nowSeconds, () => null);
  const end = settings.endsAt ? Math.floor(Date.parse(settings.endsAt) / 1000) : NaN;

  if (!Number.isFinite(end)) {
    return isPreview ? (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-user-line text-sm text-user-fg-muted">
        Pick an end date for the countdown in the store editor
      </div>
    ) : null;
  }
  const left = now === null ? null : Math.max(0, end - now);
  const ended = left === 0;
  if (ended && settings.hideWhenEnded !== false && !isPreview) return null;

  const parts =
    left === null
      ? [null, null, null, null]
      : [Math.floor(left / 86400), Math.floor((left % 86400) / 3600), Math.floor((left % 3600) / 60), left % 60];
  const labels = [t("storefront.countdown.days"), t("storefront.countdown.hours"), t("storefront.countdown.minutes"), t("storefront.countdown.seconds")];
  const href = resolveThemeLink(settings.buttonLink);

  // Colors: khali = accent box + card button. Inline style isliye ke `.user-theme a { color: inherit }`
  // (unlayered CSS) Tailwind text-* class ko hara deta tha → button text safed par safed.
  const boxBg = HEX_COLOR.test(settings.backgroundColor || "") ? settings.backgroundColor : null;
  const boxText = HEX_COLOR.test(settings.textColor || "") ? settings.textColor : boxBg ? readableOn(boxBg) : null;
  const btnBg = HEX_COLOR.test(settings.buttonColor || "") ? settings.buttonColor : null;
  const btnText = HEX_COLOR.test(settings.buttonTextColor || "") ? settings.buttonTextColor : btnBg ? readableOn(btnBg) : null;
  const boxStyle = { backgroundColor: boxBg || "var(--user-accent)", color: boxText || "var(--user-accent-text)" };
  const buttonStyle = { backgroundColor: btnBg || "var(--user-bg-card)", color: btnText || "var(--user-accent)" };

  return (
    <section className="rounded-2xl px-5 py-7 text-center sm:px-8 sm:py-10" style={boxStyle}>
      {settings.heading ? <h2 className="text-xl font-black sm:text-2xl">{settings.heading}</h2> : null}
      {settings.subheading ? <p className="mx-auto mt-2 max-w-xl text-sm opacity-90">{settings.subheading}</p> : null}
      {ended ? (
        <p className="mt-5 text-base font-bold">{t("storefront.countdown.ended")}</p>
      ) : (
        <div className="mt-5 flex justify-center gap-2 sm:gap-3" role="timer" aria-live="off">
          {parts.map((value, i) => (
            <div key={labels[i]} className="min-w-[3.75rem] rounded-xl bg-black/15 px-2 py-2.5 sm:min-w-[4.5rem]">
              <p className="text-2xl font-black tabular-nums sm:text-3xl">{value === null ? "--" : String(value).padStart(2, "0")}</p>
              <p className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-wider opacity-80">{labels[i]}</p>
            </div>
          ))}
        </div>
      )}
      {href && settings.buttonLabel && !ended ? (
        <MaybeLink
          link={settings.buttonLink}
          className="mt-6 inline-flex h-11 items-center rounded-xl px-6 text-sm font-bold transition hover:opacity-90"
          style={buttonStyle}
        >
          {settings.buttonLabel}
        </MaybeLink>
      ) : null}
    </section>
  );
}

// ───────────────────────── Logo list ─────────────────────────
export function LogoListSection({ settings = {}, blocks = [] }) {
  const logos = blocks.filter((b) => b?.settings?.image);
  if (!logos.length) return null;
  return (
    <section>
      {settings.heading ? <SectionHeading title={settings.heading} className="mb-4 px-1" /> : null}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {logos.map((block) => (
          <MaybeLink
            key={block.id}
            link={block.settings.link}
            className="flex h-20 items-center justify-center rounded-xl border border-user-line bg-user-card p-3 transition hover:border-user-line-hover"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc(block.settings.image)}
              alt=""
              loading="lazy"
              className={`max-h-full max-w-full object-contain ${settings.grayscale ? "opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0" : ""}`}
            />
          </MaybeLink>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────── Image gallery ─────────────────────────
const GALLERY_COLS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-3 lg:grid-cols-4" };

export function GallerySection({ settings = {}, blocks = [] }) {
  const images = blocks.filter((b) => b?.settings?.image);
  if (!images.length) return null;
  return (
    <section>
      {settings.heading ? <SectionHeading title={settings.heading} className="mb-4 px-1" /> : null}
      <div className={`grid grid-cols-2 gap-3 ${GALLERY_COLS[settings.columns] || GALLERY_COLS[3]}`}>
        {images.map((block) => (
          <MaybeLink key={block.id} link={block.settings.link} className="group relative block overflow-hidden rounded-2xl border border-user-line bg-user-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc(block.settings.image)}
              alt={block.settings.caption || ""}
              loading="lazy"
              className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
            />
            {block.settings.caption ? (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 text-sm font-semibold text-white">
                {block.settings.caption}
              </span>
            ) : null}
          </MaybeLink>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────── Contact form ─────────────────────────
const fieldCls =
  "h-11 w-full rounded-xl border border-user-line bg-user-input px-3 text-sm text-user-fg outline-none placeholder:text-user-fg-subtle focus:border-user-accent";

export function ContactFormSection({ settings = {} }) {
  const { t, locale } = useTranslation();
  const { isPreview } = useStoreTheme();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", website: "" });
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (isPreview) return setState("done"); // editor preview me asli message nahi
    setState("sending");
    setErrors({});
    try {
      await userHttp.post("/contact", { ...form, locale, page: window.location.pathname });
      setState("done");
    } catch (err) {
      setErrors(err?.response?.data?.errors || { form: err?.response?.data?.message || t("storefront.contact.error") });
      setState("error");
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-user-line bg-user-card p-5 sm:p-8">
      {settings.heading ? <h2 className="text-xl font-black text-user-fg sm:text-2xl">{settings.heading}</h2> : null}
      {settings.subheading ? <p className="mt-1.5 text-sm text-user-fg-secondary">{settings.subheading}</p> : null}
      {state === "done" ? (
        <p role="status" className="mt-6 rounded-xl bg-user-success/15 px-4 py-3 text-sm font-semibold text-user-success">
          {t("storefront.contact.thanks")}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <input required maxLength={120} value={form.name} onChange={set("name")} placeholder={t("storefront.contact.name")} aria-label={t("storefront.contact.name")} className={fieldCls} />
              {errors.name ? <p className="mt-1 text-xs text-user-danger">{errors.name}</p> : null}
            </div>
            <div>
              <input required type="email" maxLength={254} value={form.email} onChange={set("email")} placeholder={t("storefront.contact.email")} aria-label={t("storefront.contact.email")} className={fieldCls} />
              {errors.email ? <p className="mt-1 text-xs text-user-danger">{errors.email}</p> : null}
            </div>
          </div>
          {settings.showPhone !== false ? (
            <input type="tel" maxLength={30} value={form.phone} onChange={set("phone")} placeholder={t("storefront.contact.phone")} aria-label={t("storefront.contact.phone")} className={fieldCls} />
          ) : null}
          <div>
            <textarea
              required
              rows={5}
              maxLength={4000}
              value={form.message}
              onChange={set("message")}
              placeholder={t("storefront.contact.message")}
              aria-label={t("storefront.contact.message")}
              className={`${fieldCls} h-auto py-2.5`}
            />
            {errors.message ? <p className="mt-1 text-xs text-user-danger">{errors.message}</p> : null}
          </div>
          {/* Honeypot — insaan ko nahi dikhta, bots bhar dete hain */}
          <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} className="hidden" aria-hidden="true" />
          {errors.form ? <p role="alert" className="text-xs text-user-danger">{errors.form}</p> : null}
          <button
            type="submit"
            disabled={state === "sending"}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-user-accent px-6 text-sm font-bold text-user-accent-fg hover:bg-user-accent-hover disabled:opacity-60"
          >
            {state === "sending" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {t("storefront.contact.send")}
          </button>
        </form>
      )}
    </section>
  );
}

// ───────────────────────── Map ─────────────────────────
const MAP_HEIGHT = { small: "h-56", medium: "h-80", large: "h-[28rem]" };

export function MapSection({ settings = {} }) {
  const { isPreview } = useStoreTheme();
  const address = String(settings.address || "").trim();
  if (!address) {
    return isPreview ? (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-user-line text-sm text-user-fg-muted">
        Add your store address in the store editor
      </div>
    ) : null;
  }
  const src = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  return (
    <section>
      {settings.heading ? <SectionHeading title={settings.heading} className="mb-4 px-1" /> : null}
      <div className={`overflow-hidden rounded-2xl border border-user-line bg-user-card ${MAP_HEIGHT[settings.height] || MAP_HEIGHT.medium}`}>
        <iframe src={src} title={settings.heading || address} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-full w-full border-0" />
      </div>
      <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-user-fg-muted">
        <MapPin size={13} className="text-user-accent" /> {address}
      </p>
    </section>
  );
}
