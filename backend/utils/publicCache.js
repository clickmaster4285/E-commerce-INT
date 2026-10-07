// ======================================================
// ✅ PUBLIC-CACHE — expensive public GETs ke liye short-TTL
// in-memory memo (facets / deals-active / category-tiles /
// brands / categories-public / banners-active / discounts-public).
//
// - Sirf GET + status 200 cache hota hai, key = full originalUrl.
// - TTL default 30s. Output shape/status bilkul same — sirf
//   dobara compute nahi hota (DB scans se bachat).
// - Staleness contract route-level `Cache-Control: public,
//   max-age=60` ke andar hai (30s < 60s) — koi logic change nahi.
// - Admin mutations (POST/PUT/PATCH/DELETE) par jude namespaces
//   invalidate hote hain taake admin change foran reflect ho.
// ======================================================

const store = new Map(); // key -> { t, status, body }
const MAX_ENTRIES = 500;

const now = () => Date.now();

function keyOf(req) {
  return `${req.method} ${req.originalUrl || req.url}`;
}

function set(key, status, body) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { t: now(), status, body });
}

function publicCache(ttlMs = 30 * 1000) {
  return (req, res, next) => {
    if (req.method !== "GET") return next();
    const key = keyOf(req);
    const hit = store.get(key);
    if (hit && now() - hit.t < ttlMs) {
      res.set("X-Cache", "HIT");
      return res.status(hit.status).json(hit.body);
    }
    const origJson = res.json.bind(res);
    res.json = (body) => {
      try {
        // Sirf isi middleware se guzarne wale GET 200 cache hote hain
        // (route file khud decide karta hai kahan lagana hai).
        if (res.statusCode === 200) {
          set(key, 200, body);
        }
      } catch (_) {
        // cache fail → response phir bhi jaye
      }
      return origJson(body);
    };
    res.set("X-Cache", "MISS");
    next();
  };
}

// Admin ya public mutation ke baad namespace(s) drop karo.
// Namespace = URL ka pehla segment (products / deals / ...).
function invalidate(namespaces) {
  const list = Array.isArray(namespaces) ? namespaces : [namespaces];
  for (const key of [...store.keys()]) {
    if (list.some((ns) => key === `GET /api/${ns}` || key.startsWith(`GET /api/${ns}?`) || key.startsWith(`GET /api/${ns}/`))) {
      store.delete(key);
    }
  }
}

module.exports = { publicCache, invalidate };
