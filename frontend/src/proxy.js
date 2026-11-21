import { NextResponse } from 'next/server';
import { parseTenantHost } from './lib/tenantHost';

// ==========================================================
// MULTI-TENANT ROUTING (Host header se)
// ⚠️ Next.js 16: file ka naam `proxy.js` (pehle `middleware.js`) aur app `src/`
//    me hai is liye ye file `src/` me honi zaroori hai — root par Next isay
//    ignore karta hai.
// ----------------------------------------------------------
// PLATFORM  192.168.88.35.nip.io:3000 (aur localhost / 192.168.88.35)
//   /                → landing page (/landing → / redirect)
//   /landing/*, /super-admin/*, /store-setup, /seller/apply, /admin/login (seller → apne store par handoff)
//   baaki sab        → "/" (storefront / admin sirf store subdomain par hain)
//
// STORE     <subdomain>.192.168.88.35.nip.io:3000 (ya custom domain)
//   /                → us store ka storefront (public)
//   /admin/*         → us store ka admin panel (session chahiye; backend sirf isi store ke staff ko maanta hai)
//   /super-admin/*, /landing/*, /store-setup, /seller/apply → 404
//   store DB me nahi → /store-not-found
// ==========================================================

const PLATFORM_ONLY = ['/landing', '/super-admin', '/store-setup', '/seller/apply'];
const PLATFORM_ALLOWED = [...PLATFORM_ONLY, '/admin/login', '/store-not-found'];
const matches = (pathname, list) => list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

// ── Store exists? (backend /store/resolve, 60s cache) ──
// Server-side resolve: NEXT_INTERNAL_API_URL (localhost http) — public HTTPS
// NEXT_PUBLIC_SERVERURL nginx/TLS se Node me fail ho sakta hai.
const API_BASE = (
  process.env.NEXT_INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_SERVERURL ||
  ''
).trim().replace(/\/+$/, '');
const STORE_CACHE_MS = 60 * 1000;
const storeCache = new Map(); // host → { exists, expires }

async function storeExists(host) {
  const hit = storeCache.get(host);
  if (hit && hit.expires > Date.now()) return hit.exists;
  if (!API_BASE) return false;
  try {
    // Localhost/platform address par call + asli host `x-store-host` me
    const res = await fetch(`${API_BASE}/store/resolve`, {
      // Backend `x-store-host` sirf is shared secret ke saath maanta hai
      headers: { 'x-store-host': host, 'x-internal-proxy-secret': process.env.INTERNAL_PROXY_SECRET || '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    const body = await res.json();
    const exists = Boolean(body?.data?.found);
    storeCache.set(host, { exists, expires: Date.now() + STORE_CACHE_MS });
    return exists;
  } catch {
    return false; // resolve fail → store-not-found (exist assume mat karo)
  }
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  // Har role ke alag cookies (backend utils/tokens.js). Refresh cookie (a_rt/u_rt)
  // ka path sirf backend refresh route hai — page requests ke saath nahi aata, is
  // liye `*_sess` (sirf "session hai" ka nishan, token nahi) dekhte hain.
  const has = (name) => !!request.cookies.get(name);
  const hasAdminSession = has('a_at') || has('a_sess');
  const hasCustomerAccess = has('u_at');
  const hasCustomerSession = hasCustomerAccess || has('u_sess');

  const tenant = parseTenantHost(request.headers.get('host'));
  const isStore = tenant.type === 'subdomain' || tenant.type === 'custom';

  // Server components `headers().get('x-store-host')` se tenant parh sakte hain
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-type', tenant.type);
  requestHeaders.set('x-store-host', tenant.host || '');
  if (tenant.type === 'subdomain') requestHeaders.set('x-store-subdomain', tenant.subdomain);
  const pass = () => NextResponse.next({ request: { headers: requestHeaders } });
  const rewrite = (path) => NextResponse.rewrite(new URL(path, request.url), { request: { headers: requestHeaders } });
  const redirect = (path) => NextResponse.redirect(new URL(path, request.url));
  // Platform-only page store host par → "page not available" (super admin waghera)
  const notAvailable = () => rewrite('/store-not-found?reason=page');

  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) return pass();
  // public/ files (fonts, manifest.json, robots.txt ...) dono hosts par
  if (/\.[a-z0-9]{2,5}$/i.test(pathname)) return pass();

  // "a.b.192.168.88.35.nip.io" jaisa ghalat host
  if (tenant.type === 'unknown') return rewrite('/store-not-found');

  // ======================= STORE HOST =======================
  if (isStore) {
    if (matches(pathname, PLATFORM_ONLY)) return notAvailable();

    if (!(await storeExists(tenant.host))) {
      return pathname === '/store-not-found' ? pass() : rewrite('/store-not-found');
    }

    // Platform login ke baad ka one-time sign-in page — session abhi bana nahi
    if (pathname === '/admin-handoff') return pass();
    if (pathname === '/admin/login') return pass();

    if (pathname.startsWith('/admin')) {
      if (!hasAdminSession) return redirect('/admin/login');
      return pass();
    }

    if (pathname === '/login') {
      if (hasCustomerAccess) return redirect('/');
      return pass();
    }

    if (pathname === '/seller/dashboard') {
      if (!(hasAdminSession || hasCustomerSession)) return redirect('/login');
      return pass();
    }

    // Storefront public hai — logged-out shoppers bhi browse kar sakte hain
    return pass();
  }

  // ===================== PLATFORM HOST ======================
  // Landing page ka URL "/" hai: "/" andar se /landing dikhata hai, aur seedha
  // /landing kholne par "/" par bhej dete hain (address bar me /landing nahi aata)
  if (pathname === '/') return rewrite('/landing');
  if (pathname === '/landing') return redirect('/');
  if (matches(pathname, PLATFORM_ALLOWED)) return pass();

  // Storefront, /admin/* waghera platform par nahi — landing par wapas
  return redirect('/');
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
