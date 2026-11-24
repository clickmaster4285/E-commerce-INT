"use client";

/* ==========================================================
   GENERIC STORE EDITOR SECTIONS
   Sirf `--user-*` tokens use karte hain (har theme / dark mode me sahi).
   Settings backend config/themeSchema.js se validated aate hain.
   Rich text backend par sanitize hota hai; yahan DOMPurify doosri layer.
   ========================================================== */

import Link from "next/link";
import DOMPurify from "dompurify";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { productApi } from "@/apis/user/productApi";
import ProductCard from "@/components/user/ProductCard";
import SectionHeading from "@/components/user/SectionHeading";
import { resolveThemeLink } from "../themeLinks";
import { useStoreTheme } from "../ThemeProvider";
import { newsletterApi } from "@/apis/user/newsletterApi";
import { useTranslation } from "@/i18n/LanguageProvider";

const API_ORIGIN = (process.env.NEXT_PUBLIC_SERVERURL || "").replace(/\/api\/?$/, "");
const imageSrc = (url) => (!url ? "" : /^https?:/i.test(url) ? url : `${API_ORIGIN}${url}`);

function SafeHtml({ html, className = "" }) {
  const clean = useMemo(() => {
    if (!html) return "";
    // SSR par DOMPurify (window nahi) — backend sanitized HTML hi render
    if (typeof window === "undefined" || !DOMPurify.isSupported) return html;
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }, [html]);
  if (!clean) return null;
  return <div className={`user-rich-text ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}

export function RichTextSection({ settings = {} }) {
  const center = settings.align === "center";
  if (!settings.heading && !settings.body) return null;
  return (
    <section className={`rounded-2xl border border-user-line bg-user-card p-5 sm:p-8 ${center ? "text-center" : ""}`}>
      {settings.heading ? (
        <h2 className="mb-3 text-xl font-black text-user-fg sm:text-2xl">{settings.heading}</h2>
      ) : null}
      <SafeHtml html={settings.body} className="text-[0.9375rem] leading-relaxed text-user-fg-secondary" />
    </section>
  );
}

export function ImageWithTextSection({ settings = {} }) {
  const href = resolveThemeLink(settings.buttonLink);
  const imageEnd = settings.imagePosition === "end";
  if (!settings.image && !settings.heading && !settings.body) return null;
  return (
    <section className="grid items-center gap-6 overflow-hidden rounded-2xl border border-user-line bg-user-card md:grid-cols-2">
      {settings.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc(settings.image)}
          alt={settings.heading || ""}
          loading="lazy"
          className={`h-full max-h-[26rem] w-full object-cover ${imageEnd ? "md:order-2" : ""}`}
        />
      ) : null}
      <div className="p-5 sm:p-8">
        {settings.heading ? (
          <h2 className="mb-3 text-xl font-black text-user-fg sm:text-2xl">{settings.heading}</h2>
        ) : null}
        <SafeHtml html={settings.body} className="text-[0.9375rem] leading-relaxed text-user-fg-secondary" />
        {href && settings.buttonLabel ? (
          <Link
            href={href}
            className="mt-5 inline-flex h-11 items-center rounded-xl bg-user-accent px-5 text-sm font-bold text-user-accent-fg hover:bg-user-accent-hover"
          >
            {settings.buttonLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function ProductCarouselSection({ settings = {} }) {
  const limit = Math.min(24, Math.max(4, Number(settings.limit) || 8));
  const params = { page: 1, limit, slim: 1 };
  if (settings.source === "new") params.sort = "newest";
  if (settings.source === "offers") params.sort = "discount-desc";
  if (settings.source === "category" && settings.categoryId) params.category_id = settings.categoryId;
  if (settings.source === "brand" && settings.brandId) params.brand_id = settings.brandId;

  const { data, isLoading } = useQuery({
    queryKey: ["themeProductCarousel", params],
    queryFn: () => productApi.getAllPaginated(params),
    staleTime: 2 * 60 * 1000,
  });
  const products = data?.products || [];
  if (!isLoading && !products.length) return null;

  return (
    <section>
      {settings.heading ? <SectionHeading title={settings.heading} className="mb-4 px-1" /> : null}
      <div className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-72 w-48 shrink-0 animate-pulse rounded-2xl bg-user-card" />
            ))
          : products.map((product) => (
              <div key={product._id} className="w-48 shrink-0 snap-start sm:w-56">
                <ProductCard product={product} />
              </div>
            ))}
      </div>
    </section>
  );
}

export function NewsletterSection({ settings = {} }) {
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
      await newsletterApi.subscribe({ email, locale });
      setState("done");
    } catch (err) {
      setError(err?.response?.data?.message || t("storefront.newsletter.error"));
      setState("error");
    }
  };

  return (
    <section className="rounded-2xl bg-user-accent-soft p-6 text-center sm:p-10">
      {settings.heading ? <h2 className="text-xl font-black text-user-fg sm:text-2xl">{settings.heading}</h2> : null}
      {settings.subheading ? (
        <p className="mx-auto mt-2 max-w-xl text-sm text-user-fg-secondary">{settings.subheading}</p>
      ) : null}
      {state === "done" ? (
        <p role="status" className="mt-5 text-sm font-bold text-user-success">
          {t("storefront.newsletter.thanks")}
        </p>
      ) : (
        <form className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row" onSubmit={submit}>
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("storefront.newsletter.placeholder")}
            aria-label={t("storefront.newsletter.placeholder")}
            className="h-11 min-w-0 flex-1 rounded-xl border border-user-line bg-user-input px-3 text-sm text-user-fg placeholder:text-user-fg-subtle"
          />
          <button
            type="submit"
            disabled={state === "sending"}
            className="h-11 shrink-0 rounded-xl bg-user-accent px-5 text-sm font-bold text-user-accent-fg hover:bg-user-accent-hover disabled:opacity-60"
          >
            {settings.buttonLabel || t("storefront.newsletter.subscribe")}
          </button>
        </form>
      )}
      {state === "error" ? <p role="alert" className="mt-2 text-xs font-medium text-user-danger">{error}</p> : null}
    </section>
  );
}

export function TestimonialsSection({ settings = {}, blocks = [] }) {
  const items = blocks.filter((b) => b?.settings?.quote);
  if (!items.length) return null;
  return (
    <section>
      {settings.heading ? <SectionHeading title={settings.heading} className="mb-4 px-1" /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((block) => (
          <figure key={block.id} className="rounded-2xl border border-user-line bg-user-card p-5">
            <div className="mb-2 flex gap-0.5 text-user-accent" aria-label={`${block.settings.rating || 5}/5`}>
              {Array.from({ length: Math.min(5, Math.max(1, block.settings.rating || 5)) }, (_, i) => (
                <Star key={i} size={14} className="fill-current" />
              ))}
            </div>
            <blockquote className="text-sm leading-relaxed text-user-fg-secondary">“{block.settings.quote}”</blockquote>
            {block.settings.author ? (
              <figcaption className="mt-3 text-xs font-bold text-user-fg">— {block.settings.author}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}

export function SpacerSection({ settings = {} }) {
  const height = Math.min(160, Math.max(8, Number(settings.height) || 32));
  return <div aria-hidden="true" style={{ height }} />;
}
