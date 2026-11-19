import { NextResponse } from 'next/server';
import { parseTenantHost, platformUrl } from './src/lib/tenantHost';

// ==========================================================
// MULTI-TENANT ROUTING (Host header se)
// ----------------------------------------------------------
//   192.168.88.35.nip.io:3000           → PLATFORM: landing, seller signup, super-admin
//   alistore.192.168.88.35.nip.io:3000  → STORE "alistore": storefront + /admin
//   eastore.test:3000 (hosts file)      → STORE via customDomain
//   localhost / 192.168.88.35:3000      → PLATFORM (purana single-store flow, unchanged)
// ==========================================================

// Ye pages sirf platform (root domain) par hain — store host par aayein to root par bhej do
const PLATFORM_ONLY = ['/landing', '/super-admin', '/store-setup', '/seller/apply'];
const isPlatformOnlyPath = (pathname) =>
  PLATFORM_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const hasAccessToken = !!request.cookies.get('accessToken');
  const hasRefreshToken = !!request.cookies.get('refreshToken');
  const hasSessionCookie = hasAccessToken || hasRefreshToken;

  const tenant = parseTenantHost(request.headers.get('host'));
  const isStore = tenant.type === 'subdomain' || tenant.type === 'custom';

  // Server components / route handlers `headers().get('x-store-host')` se tenant parh sakte hain
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-type', tenant.type);
  requestHeaders.set('x-store-host', tenant.host || '');
  if (tenant.type === 'subdomain') requestHeaders.set('x-store-subdomain', tenant.subdomain);
  const pass = () => NextResponse.next({ request: { headers: requestHeaders } });

  // Static files ignore karein
  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return pass();
  }

  // "a.b.192.168.88.35.nip.io" jaise ghalat host → platform par
  if (tenant.type === 'unknown') {
    return NextResponse.redirect(platformUrl('/landing', request.nextUrl.protocol));
  }

  // ======================= STORE HOST =======================
  if (isStore) {
    if (isPlatformOnlyPath(pathname)) {
      return NextResponse.redirect(platformUrl(`${pathname}${search}`, request.nextUrl.protocol));
    }

    if (pathname === '/admin/login') return pass();

    // Store ka admin panel — session chahiye
    if (pathname.startsWith('/admin')) {
      if (!hasSessionCookie) return NextResponse.redirect(new URL('/admin/login', request.url));
      return pass();
    }

    if (pathname === '/login') {
      if (hasAccessToken) return NextResponse.redirect(new URL('/', request.url));
      return pass();
    }

    if (pathname === '/seller/dashboard') {
      if (!hasSessionCookie) return NextResponse.redirect(new URL('/login', request.url));
      return pass();
    }

    // Storefront public hai — logged-out shoppers bhi browse kar sakte hain
    return pass();
  }

  // ===================== PLATFORM HOST ======================

  // Landing page + seller signup — public. Yeh default page hai jo har
  // logged-out visitor ko dikhta hai (neeche wala fallback yahin bhejta hai).
  if (pathname === '/landing' || pathname.startsWith('/landing/')) {
    return pass();
  }

  // Super Admin panel — apna auth khud handle karta hai (SuperAdminShell
  // logged-out user ko /super-admin/login par bhej deta hai), is liye yahan
  // block nahi karte. Warna super admin login page hi nahi khulta.
  if (pathname === '/super-admin' || pathname.startsWith('/super-admin/')) {
    return pass();
  }

  // Store setup onboarding — freshly verified seller needs to open it without a session
  if (pathname === '/store-setup') {
    return pass();
  }

  // Admin login — public page
  if (pathname === '/admin/login') {
    return pass();
  }

  // User login — public page (log in karne ke liye yahi kholna chahiye;
  // agar logged in hai to storefront par bhej do)
  if (pathname === '/login') {
    if (hasAccessToken) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return pass();
  }

  // Seller application form — public
  if (pathname === '/seller/apply') {
    return pass();
  }

  // Seller dashboard — requires session (approved sellers)
  if (pathname === '/seller/dashboard') {
    if (!hasSessionCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return pass();
  }

  // Admin pages — protected
  if (pathname.startsWith('/admin')) {
    if (!hasSessionCookie) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return pass();
  }

  // Baqi sab stores/routes unauthenticated users ke liye — default landing page dikhao
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL('/landing', request.url));
  }

  return pass();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
