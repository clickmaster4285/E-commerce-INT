/* ==========================================================
   USER HOME PAGE (server shell)
   - Banners SSR se aate hain (initialData) taake LCP image API
     round-trip ka wait na kare. Client queryKey / polling / fallback
     bilkul same — server fail ho to client fetch chalta hai.
   - Baaki poora home client hai (HomeClient) — filters/URL/sidebar
     behavior me zero change.
   - ISR 60s: shell static rehti hai, banners minute me refresh.
   ========================================================== */

import HomeClient from "./HomeClient";

export const revalidate = 60;

async function getInitialBanners() {
  try {
    const base = process.env.NEXT_PUBLIC_SERVERURL;
    if (!base) return null;
    const res = await fetch(`${base}/banners/active?limit=12`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d)) return d;
    return null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const initialBanners = await getInitialBanners();
  return (
    <>
      <HeroPreload banners={initialBanners} />
      <HomeClient initialBanners={initialBanners} />
    </>
  );
}

/* LCP preload (server): slide-0 ka URL pehle se pata hai — client API
   round-trip ka wait nahi. React <link> ko head me hoist karta hai.
   Banners na hon to kuch render nahi (client fallback same).
   ✅ FAST-CDN (picsum/fastly/unsplash): seedha CDN preload — optimizer
   round-trip (cold par seconds) se bacho. Baaki local images optimizer
   srcSet se (smartImageLoader parity). */
const FAST_CDN_PRELOAD =
  /^(picsum\.photos|fastly\.picsum\.photos|images\.unsplash\.com|cdn\.shopify\.com)$/i;

function HeroPreload({ banners }) {
  const first = Array.isArray(banners) ? banners[0] : null;
  const raw = first?.desktopImage || first?.tabletImage || first?.mobileImage;
  if (!raw) return null;
  let src = raw;
  if (!/^(https?:|blob:|data:)/i.test(src)) {
    const base = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
    if (!base) return null;
    src = `${base}${src.startsWith("/") ? "" : "/"}${src}`;
  }
  try {
    const host = new URL(src, "http://localhost").hostname;
    if (FAST_CDN_PRELOAD.test(host)) {
      return <link rel="preload" as="image" href={src} fetchPriority="high" />;
    }
  } catch {
    // neeche optimizer path
  }
  const enc = encodeURIComponent(src);
  const srcSet = [640, 1080, 1920]
    .map((w) => `/_next/image?url=${enc}&w=${w}&q=75 ${w}w`)
    .join(", ");
  return (
    <link
      rel="preload"
      as="image"
      imageSrcSet={srcSet}
      imageSizes="100vw"
      fetchPriority="high"
    />
  );
}
