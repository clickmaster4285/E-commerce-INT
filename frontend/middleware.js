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

  // ✅ Admin Login — public page
  // Token ho ya na ho, login page hamesha khulna chahiye. Pehle yahan token
  // hone par /admin/dashboard par redirect ho jata tha, jis se expired/stale
  // token ki surat mein admin dobara login hi nahi kar pata tha.
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  // ✅ User Login — public page
  if (pathname === '/login') {
    if (hasAccessToken) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // ✅ Baqi sab ADMIN pages — protected
  if (pathname.startsWith('/admin')) {
    // Let the admin layout's API auth interceptor refresh an expired/missing
    // access token when the long-lived refresh cookie is still present.
    if (!hasSessionCookie) {
      console.warn('🔒 Middleware blocked:', pathname, '| auth cookies missing');
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    // ✅ Success case: token present — allow through
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
