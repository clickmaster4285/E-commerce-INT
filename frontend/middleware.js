import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // ✅ ADMIN routes ko protect karein
  if (pathname.startsWith('/admin')) {
    const accessToken = request.cookies.get('accessToken');
    
    // Agar cookie nahi hai, toh login page par redirect kar do
    if (!accessToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // ✅ Agar user logged in hai aur /login ya /register par jaye
  if (pathname === '/login' || pathname === '/register') {
    const accessToken = request.cookies.get('accessToken');
    if (accessToken) {
      // Logged in user ko admin dashboard par bhej do
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  // ✅ Baqi sab routes (user pages) - koi check nahi, seedha access
  return NextResponse.next();
}

// ✅ Ye middleware sirf in routes par chalega (Performance ke liye)
export const config = {
  matcher: [
    '/admin/:path*',    // Saare admin routes (protected)
    '/login',           // Login page (redirect if logged in)
    '/register',        // Register page (redirect if logged in)
    // ⚠️ User pages (/product, /category, /brand) ismein nahi hain
    // Isliye middleware un par chalega hi nahi - bilkul PUBLIC rahenge
  ],
};