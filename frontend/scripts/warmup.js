/* ==========================================================
   WARMUP — production start ke baad cold caches garam karo.
   Pehli-hit slowness (API compute + image optimizer + route
   modules) deploy ke baad ek dafa hoti hai — ye script usay
   khud bhugat ta hai taake real users + Lighthouse ko hamesha
   warm server mile.

   Usage (do terminals ya ek ke baad ek):
     Terminal 1: npm run build  &&  npx next start -p 3000
     Terminal 2: npm run warmup
     (phir Lighthouse / real browsing)

   Env (frontend/.env se, fallback LAN default):
     NEXT_PUBLIC_SERVERURL=http://<host>:5000/api
     WARMUP_FRONT=http://<host>:3000   (ya PORT env)
   ========================================================== */

const FRONT =
  process.env.WARMUP_FRONT ||
  `http://${process.env.WARMUP_HOST || "192.168.88.39"}:${process.env.PORT || "3000"}`;
const BACK =
  process.env.NEXT_PUBLIC_SERVERURL || "http://192.168.88.39:5000/api";
const BACK_ORIGIN = BACK.replace(/\/api\/?$/, "");

const get = async (url, label) => {
  const t0 = Date.now();
  try {
    const r = await fetch(url);
    await r.arrayBuffer();
    console.log(`ok  ${Date.now() - t0}ms  ${r.status}  ${label}`);
    return r.status;
  } catch (e) {
    console.log(`ERR  ${label}  ${e.message}`);
    return 0;
  }
};

(async () => {
  console.log(`FRONT=${FRONT}`);
  console.log(`BACK=${BACK}`);

  // 1) Backend APIs (compute caches: facets/deals/tiles/brands/banners)
  await get(`${BACK}/products/facets`, "facets");
  await get(`${BACK}/products/facets`, "facets x2 (HIT)");
  await get(`${BACK}/deals/active?slim=1`, "deals slim");
  await get(`${BACK}/products/category-tiles?limit=100`, "tiles");
  await get(`${BACK}/brands`, "brands");
  await get(`${BACK}/categories/public`, "categories");
  await get(`${BACK}/banners/active?limit=12`, "banners");
  await get(`${BACK}/products?page=1&limit=20&slim=1`, "products p1");
  await get(`${BACK}/discounts/public`, "discounts");

  // 2) Frontend pages (route modules + ISR HTML)
  await get(`${FRONT}/`, "page /");
  await get(`${FRONT}/filtering-product`, "page filtering-product");
  await get(`${FRONT}/shop`, "page shop");

  // 3) Optimizer: hero banners (LCP) pehle se resize+cache
  try {
    const r = await fetch(`${BACK}/banners/active?limit=12`);
    const j = await r.json();
    const list = Array.isArray(j) ? j : j?.data || [];
    for (const b of list.slice(0, 4)) {
      const raw = b?.desktopImage || b?.tabletImage || b?.mobileImage;
      if (!raw) continue;
      const abs = /^(https?:|blob:|data:)/i.test(raw)
        ? raw
        : `${BACK_ORIGIN}${raw.startsWith("/") ? "" : "/"}${raw}`;
      await get(
        `${FRONT}/_next/image?url=${encodeURIComponent(abs)}&w=1080&q=75`,
        "hero-opt w=1080",
      );
    }
  } catch (e) {
    console.log(`ERR  hero-opt  ${e.message}`);
  }

  console.log("warmup done");
})();
