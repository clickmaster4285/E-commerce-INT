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

  // Pending-approval screen — hamesha accessible (unauthenticated user ko yahi page dikhana hai)
  if (pathname === '/pending-approval') {
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

  // Baqi sab stores/routes unauthenticated users ke liye
  // Access ke liye Super Admin approval zaroori hai — tab tak pending-approval page dikhao
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL('/pending-approval', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
