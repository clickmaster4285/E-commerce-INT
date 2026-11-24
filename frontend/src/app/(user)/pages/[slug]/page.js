/* ==========================================================
   STORE CUSTOM PAGE (/pages/<slug>) — store editor "Pages"
   Server component: backend /pages/public/:slug (x-store-host forward).
   Sirf published pages; draft / missing → 404.
   Content backend par sanitize hota hai (utils/themeValidator).
   ========================================================== */

import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { serverApiGet } from "@/lib/serverStore";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// generateMetadata + page dono isi ek request ko share karte hain
const getPage = cache(async (slug) => {
  if (!SLUG.test(slug || "")) return null;
  const body = await serverApiGet(`/pages/public/${slug}`);
  return body?.data || null;
});

async function localizedTitle(page) {
  const locale = (await cookies()).get("lang")?.value || "en";
  return page?.translations?.title?.[locale] || page?.title || "";
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Page not found" };
  return {
    title: page.seo?.title || (await localizedTitle(page)),
    description: page.seo?.description || undefined,
  };
}

export default async function StorePage({ params }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();
  const title = await localizedTitle(page);

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="mb-6 text-2xl font-black text-user-fg sm:text-3xl">{title}</h1>
      <div
        className="user-rich-text text-[0.9375rem] leading-relaxed text-user-fg-secondary"
        dangerouslySetInnerHTML={{ __html: page.content || "" }}
      />
    </article>
  );
}
