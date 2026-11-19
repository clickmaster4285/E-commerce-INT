import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hasAccessToken = !!request.cookies.get('accessToken');
  const hasRefreshToken = !!request.cookies.get('refreshToken');
  const hasSessionCookie = hasAccessToken || hasRefreshToken;

  // Static files ignore karein
  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Landing page + seller signup — public. Yeh default page hai jo har
  // logged-out visitor ko dikhta hai (neeche wala fallback yahin bhejta hai).
  if (pathname === '/landing' || pathname.startsWith('/landing/')) {
    return NextResponse.next();
  }

  // Super Admin panel — apna auth khud handle karta hai (SuperAdminShell
  // logged-out user ko /super-admin/login par bhej deta hai), is liye yahan
  // block nahi karte. Warna super admin login page hi nahi khulta.
  if (pathname === '/super-admin' || pathname.startsWith('/super-admin/')) {
    return NextResponse.next();
  }

  // Store setup onboarding — freshly verified seller needs to open it without a session
  if (pathname === '/store-setup') {
    return NextResponse.next();
  }

  // Admin login — public page
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  // User login — public page (log in karne ke liye yahi kholna chahiye;
  // agar logged in hai to storefront par bhej do)
  if (pathname === '/login') {
    if (hasAccessToken) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Seller application form — public
  if (pathname === '/seller/apply') {
    return NextResponse.next();
  }

  // Seller dashboard — requires session (approved sellers)
  if (pathname === '/seller/dashboard') {
    if (!hasSessionCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // Admin pages — protected
  if (pathname.startsWith('/admin')) {
    if (!hasSessionCookie) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return NextResponse.next();
  }

  // Baqi sab stores/routes unauthenticated users ke liye — default landing page dikhao
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL('/landing', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
