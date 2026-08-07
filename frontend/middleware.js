import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Public routes (jahan bina login ke ja sakte hain)
  const publicRoutes = ['/login', '/register'];

  // 1. Protected Routes Check (Admin aur Dashboard)
  if (pathname.startsWith('/admin') || pathname === '/dashboard') {
    // has() use karna zyada safe hai
    const hasAccessToken = request.cookies.has('accessToken');
    
    if (!hasAccessToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // 2. Public Routes Check (Agar logged in user login page par aaye)
  if (publicRoutes.includes(pathname)) {
    const hasAccessToken = request.cookies.has('accessToken');
    
    if (hasAccessToken) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

// Sirf in routes par middleware chalega
export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/dashboard',
    '/login',
    '/register',
  ],
};