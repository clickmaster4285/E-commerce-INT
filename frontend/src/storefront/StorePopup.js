"use client";

/* ==========================================================
   STORE POPUP — store editor Theme → Popup
   settings.popup = { enabled, type: newsletter|offer, image, heading, text,
     couponCode, buttonLabel, buttonLink, trigger: delay|scroll|exit,
     delaySeconds, scrollPercent, frequency: once|session|always, pages: all|home }

   • Client-only, trigger ke baad hi khulta hai → SSR / hydration flash nahi.
   • "Dekh liya" flag CONTENT ke hash se — seller offer badle to dobara dikhe.
     (once → localStorage, session → sessionStorage, always → kuch save nahi)
   • Cart / checkout par kabhi nahi. Editor preview: foran dikhta, live update.
   • Exit intent sirf mouse par hota hai → touch devices par 15s delay fallback.
   ========================================================== */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Copy, Loader2, X } from "lucide-react";
import { useStoreTheme } from "./ThemeProvider";
import { resolveThemeLink, isExternalHref } from "./themeLinks";
import { newsletterApi } from "@/apis/user/newsletterApi";
import { useTranslation } from "@/i18n/LanguageProvider";

const HIDDEN_ON = ["/checkout", "/cart"];
const API_ORIGIN = (process.env.NEXT_PUBLIC_SERVERURL || "").replace(/\/api\/?$/, "");
const imageSrc = (url) => (!url ? "" : /^https?:/i.test(url) ? url : `${API_ORIGIN}${url}`);

/** Chhota stable hash (content badle → naya key) */
function hashOf(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const storageFor = (frequency) => {
  try {
    if (frequency === "once") return window.localStorage;
    if (frequency === "session") return window.sessionStorage;
  } catch {
    // storage blocked (private mode) → har visit par
  }
  return null;
};

function CouponCode({ code }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <span className="rounded-lg border-2 border-dashed border-user-accent px-4 py-2 font-mono text-lg font-black tracking-widest text-user-accent">{code}</span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // clipboard blocked — code dikh raha hai, user khud copy kar le
          }
        }}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-user-hover px-3 text-xs font-semibold text-user-fg hover:bg-user-line"
      >
        {copied ? <Check size={14} className="text-user-success" /> : <Copy size={14} />}
        {copied ? t("storefront.popup.copied") : t("storefront.popup.copy")}
      </button>
    </div>
  );
}

export default function StorePopup() {
  const { theme, isPreview } = useStoreTheme();
  const { t, locale } = useTranslation();
  const pathname = usePathname() || "/";
  const cfg = theme?.settings?.popup;
  // Hook deps ke liye plain values (React Compiler optional-chain deps preserve nahi karta)
  const frequency = cfg?.frequency;
  const trigger = cfg?.trigger;
  const delaySeconds = cfg?.delaySeconds;
  const scrollPercent = cfg?.scrollPercent;

  const contentKey = useMemo(
    () => (cfg ? `store-popup:${hashOf([cfg.type, cfg.heading, cfg.text, cfg.couponCode, cfg.image].join("|"))}` : ""),
    [cfg],
  );
  const pageAllowed =
    Boolean(cfg?.enabled) &&
    !HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`)) &&
    (cfg?.pages !== "home" || pathname === "/");

  const [triggeredKey, setTriggeredKey] = useState("");
  const [dismissedKey, setDismissedKey] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [error, setError] = useState("");
  const closeRef = useRef(null);

  // ── Live triggers (preview me nahi — wahan foran dikhta hai) ──
  useEffect(() => {
    if (isPreview || !pageAllowed || !contentKey) return undefined;
    const storage = storageFor(frequency);
    try {
      if (storage?.getItem(contentKey)) return undefined; // pehle dekh chuka
    } catch {
      // ignore
    }
    const fire = () => setTriggeredKey(contentKey);
    const cleanups = [];

    if (trigger === "scroll") {
      const pct = (Number(scrollPercent) || 40) / 100;
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max <= 0 || window.scrollY / max >= pct) fire();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
    } else if (trigger === "exit") {
      const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
      if (coarse) {
        const id = setTimeout(fire, 15000);
        cleanups.push(() => clearTimeout(id));
      } else {
        const onOut = (e) => {
          if (!e.relatedTarget && e.clientY <= 0) fire();
        };
        document.addEventListener("mouseout", onOut);
        cleanups.push(() => document.removeEventListener("mouseout", onOut));
      }
    } else {
      const id = setTimeout(fire, Math.max(0, Number(delaySeconds) || 0) * 1000);
      cleanups.push(() => clearTimeout(id));
    }
    return () => cleanups.forEach((fn) => fn());
  }, [isPreview, pageAllowed, contentKey, trigger, delaySeconds, scrollPercent, frequency]);

  const open = pageAllowed && dismissedKey !== contentKey && (isPreview || triggeredKey === contentKey);

  const close = useCallback(() => {
    setDismissedKey(contentKey);
    if (isPreview) return;
    try {
      storageFor(frequency)?.setItem(contentKey, "1");
    } catch {
      // ignore
    }
  }, [contentKey, isPreview, frequency]);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || !cfg) return null;

  const isNewsletter = cfg.type !== "offer";
  const href = resolveThemeLink(cfg.buttonLink);
  const subscribed = state === "done";

  const subscribe = async (event) => {
    event.preventDefault();
    if (isPreview) return setState("done");
    setState("sending");
    setError("");
    try {
      await newsletterApi.subscribe({ email, locale, source: "popup" });
      setState("done");
      try {
        storageFor(cfg.frequency)?.setItem(contentKey, "1"); // subscribe ke baad dobara mat dikhao
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err?.response?.data?.message || t("storefront.newsletter.error"));
      setState("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-popup-heading"
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-user-card text-center shadow-2xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label={t("storefront.popup.close")}
          className="absolute end-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-user-card/90 text-user-fg-muted shadow-sm hover:text-user-fg"
        >
          <X size={16} />
        </button>
        {cfg.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc(cfg.image)} alt="" className="h-40 w-full object-cover sm:h-48" />
        ) : null}
        <div className="px-6 pb-6 pt-7">
          {cfg.heading ? (
            <h2 id="store-popup-heading" className="text-xl font-black text-user-fg">
              {cfg.heading}
            </h2>
          ) : null}
          {cfg.text ? <p className="mt-2 whitespace-pre-line text-sm text-user-fg-secondary">{cfg.text}</p> : null}

          {/* Newsletter: coupon subscribe ke BAAD; offer: foran */}
          {cfg.couponCode && (!isNewsletter || subscribed) ? <CouponCode code={cfg.couponCode} /> : null}

          {isNewsletter ? (
            subscribed ? (
              <p role="status" className="mt-4 text-sm font-semibold text-user-success">
                {t("storefront.newsletter.thanks")}
              </p>
            ) : (
              <form onSubmit={subscribe} className="mt-5 flex flex-col gap-2">
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("storefront.newsletter.placeholder")}
                  aria-label={t("storefront.newsletter.placeholder")}
                  className="h-11 w-full rounded-xl border border-user-line bg-user-input px-3 text-sm text-user-fg placeholder:text-user-fg-subtle focus:border-user-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-user-accent text-sm font-bold text-user-accent-fg hover:bg-user-accent-hover disabled:opacity-60"
                >
                  {state === "sending" ? <Loader2 size={15} className="animate-spin" /> : null}
                  {t("storefront.newsletter.subscribe")}
                </button>
                {state === "error" ? <p role="alert" className="text-xs text-user-danger">{error}</p> : null}
              </form>
            )
          ) : href && cfg.buttonLabel ? (
            isExternalHref(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer" onClick={close} className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-user-accent text-sm font-bold text-user-accent-fg hover:bg-user-accent-hover">
                {cfg.buttonLabel}
              </a>
            ) : (
              <Link href={href} onClick={close} className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-user-accent text-sm font-bold text-user-accent-fg hover:bg-user-accent-hover">
                {cfg.buttonLabel}
              </Link>
            )
          ) : null}

          <button type="button" onClick={close} className="mt-3 text-xs text-user-fg-muted underline-offset-2 hover:underline">
            {t("storefront.popup.noThanks")}
          </button>
        </div>
      </div>
    </div>
  );
}
