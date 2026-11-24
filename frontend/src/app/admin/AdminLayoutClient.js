'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { isAdminRole } from "@/lib/roles";
import { useRouter, usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '../../components/adminComponents/Sidebar';
import Navbar from '../../components/adminComponents/Navbar';
import adminHttp from '@/apis/axiosInstance';
import { notifySellerPendingLocked } from '@/apis/sellerPendingToast';
import { toast } from 'sonner';
import Cookies from 'js-cookie';
import { useStoreSocketSync } from '../../hooks/admin/useStoreSocketSync';
import { useShippingSocketSync } from '../../hooks/admin/useShippingSocketSync';
import { useOrderSocketSync } from '../../hooks/admin/useOrderSocketSync';
import { io } from 'socket.io-client';
import { attachSocketAuthSync } from "@/lib/socketAuthSync";
import { getBackendOrigin } from "@/lib/tenantHost";
import { useTranslation } from '../../i18n/LanguageProvider';

// ==========================================
// ROUTE → PERMISSION MAPPING
// ==========================================
const ROUTE_PERMISSIONS = {
  '/admin/dashboard': 'dashboard',
  '/admin/brands': 'brands',
    '/admin/orders': 'order',
    '/admin/chats': 'order',

  '/admin/categories': 'categories',
  '/admin/attributes': 'attribute',
  '/admin/products': 'products',
  // ✅ Featured Products — alag permission (legacy: products se fallback, backend undefined = allow)
  '/admin/featured-products': 'featuredProducts',
  // ✅ Reviews — alag permission (legacy: products se fallback, backend undefined = allow)
  '/admin/reviews': 'reviews',
  '/admin/store-info': 'store',
  '/admin/terms-conditions': 'store',
  // ✅ Store editor + custom pages (legacy records me missing → store se fallback)
  '/admin/store-editor': 'storeEditor',
  '/admin/pages': 'storeEditor',
  // ✅ Newsletter subscribers = customer data
  '/admin/subscribers': 'customers',
  '/admin/shipping': 'shipping',
  '/admin/profile': 'profile',
  '/admin/employees': 'employees',
  '/admin/discounts': 'discounts',
  '/admin/deals': 'deals',
  '/admin/banners': 'banners',
  '/admin/manage-stock': 'manageStock',
  '/admin/vendors': 'vendors',
  '/admin/purchase-orders': 'purchaseOrders',
  '/admin/quotes': 'quotes',
  '/admin/invoices': 'invoices',
};

const KNOWN_ADMIN_ROUTE_PREFIXES = [
  ...Object.keys(ROUTE_PERMISSIONS),
  '/admin/customers',
  '/admin/leads',
  '/admin/pos',
  '/admin/access-denied',
];

// Pending seller = view-only. Writes are blocked by the click guard below AND
// by the API (403 SELLER_PENDING). Leading glyphs/icons ignored: "+ Add Brand".
const SELLER_PENDING_ACTION_REGEX =
  /^[^a-z0-9]*(add|create|new|save|update|edit|delete|remove|archive|duplicate|approve|publish|submit|confirm|refund|ship|send|assign|restore|reset|import|upload|bulk)\b/i;

// ==========================================
// SINGLETON SOCKET
// ==========================================
let layoutPermSocket = null;

function getLayoutPermSocket() {
  if (layoutPermSocket && layoutPermSocket.connected) {
    return layoutPermSocket;
  }

  const SOCKET_URL = getBackendOrigin(); // page host ke saath aligned (tenantHost.js)

  layoutPermSocket = io(SOCKET_URL, {
    withCredentials: true,
    auth: { aud: "admin" }, // backend isi session ka cookie dekhta hai (a_at / u_at)
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
  });
  attachSocketAuthSync(layoutPermSocket, "admin");

  return layoutPermSocket;
}

// ==========================================j7
// USER PROFILE API
// ==========================================
const getProfile = async () => {
  try {
    const response = await adminHttp.get('/users/profile', { timeout: 10000 });

    let extractedUser = null;

    if (response.data?.user) {
      extractedUser = response.data.user;
    } else if (response.data?.data?.user) {
      extractedUser = response.data.data.user;
    } else if (response.data?.role) {
      extractedUser = response.data;
    } else if (response.data?.data?.role) {
      extractedUser = response.data.data;
    }

    return extractedUser;
  } catch (err) {
    // A missing/expired session is expected on protected routes and is handled
    // by the login redirect below. Keep the console for unexpected failures.
    const status = err?.response?.status;
    if (status !== 401 && status !== 403) {
      console.error('getProfile failed:', err?.message || err, '| code:', err?.code || 'N/A');
    }
    throw err;
  }
};

// ==========================================
// STORE DATA API
// ==========================================
// Agar tumhare backend ka store endpoint different hai
// to sirf yahan endpoint change karna hoga.
const getStoreData = async () => {
  const response = await adminHttp.get('/store');

  return (
    response.data?.store ||
    response.data?.data?.store ||
    response.data?.data ||
    response.data
  );
};

// ==========================================
// ADMIN LAYOUT
// ==========================================
export default function AdminLayout({ children }) {
  const { t: __t, locale, dir } = useTranslation();
  const t = (key, params) => __t(`admin.layout.${key}`, params);
  const adminMainRef = useRef(null);

  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const isUnknownAdminPath =
    pathname?.startsWith('/admin/') &&
    !KNOWN_ADMIN_ROUTE_PREFIXES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

  // A direction change can leave the browser's previous horizontal scroll
  // offset in place. Since every admin route shares this scrollport, reset it
  // whenever the locale changes so page headers, toolbars, and buttons remain
  // in the visible layout area in both LTR and RTL languages.
  useEffect(() => {
    const scrollport = adminMainRef.current;
    if (!scrollport) return;
    scrollport.scrollLeft = 0;
  }, [locale]);

  // ==========================================
  // LOGIN PAGE
  // ==========================================
  const isLoginPage = pathname === '/admin/login';

  // ==========================================
  // STORE SOCKET SYNC
  // ==========================================
  useStoreSocketSync();

  // ==========================================
  // SHIPPING SOCKET SYNC
  // ==========================================
  useShippingSocketSync();

  // ==========================================
  // ORDER SOCKET SYNC
  // ==========================================
  useOrderSocketSync();

  // ==========================================
  // USER QUERY
  // ==========================================
  const {
    data: userData,
    isLoading: userLoading,
    isError: userError,
    error: userQueryError,
  } = useQuery({
    queryKey: ['admin-user-profile'],
    queryFn: getProfile,
    enabled: !isLoginPage,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    // Pending seller: approval check (har 45s + tab focus par) taake approve hote hi
    // panel khud unlock ho jaye. Approved users par koi polling nahi.
    refetchInterval: (query) => (query.state.data?.seller_pending ? 45 * 1000 : false),
    refetchOnWindowFocus: (query) => (query.state.data?.seller_pending ? 'always' : false),
  });

  // ==========================================
  // DERIVED AUTH + PERMISSION RESULT
  // (setState ki jagah render ke waqt derive)
  // ==========================================
  const authResult = useMemo(() => {
    if (isLoginPage) {
      return { isAuthenticated: true, checkComplete: true, redirectTo: null };
    }

    if (userLoading) {
      return {
        isAuthenticated: null,
        checkComplete: false,
        redirectTo: null,
      };
    }

    if (userError) {
      const status = userQueryError?.response?.status;
      const authenticationRejected = status === 401 || status === 403;
      return {
        isAuthenticated: false,
        checkComplete: true,
        redirectTo: authenticationRejected ? '/admin/login' : null,
        redirectMode: authenticationRejected ? 'push' : undefined,
        transientError: !authenticationRejected,
      };
    }

    if (!userData) {
      return { isAuthenticated: false, checkComplete: true, redirectTo: '/admin/login', redirectMode: 'push' };
    }

    // ==========================================
    // ADMIN HAS FULL ACCESS
    // ==========================================
    const role = userData?.role?.toLowerCase();

    if (isAdminRole(role)) {
      return {
        isAuthenticated: true,
        checkComplete: true,
        redirectTo: null,
      };
    }

    // ==========================================
    // USER PERMISSIONS
    // ==========================================
    const perms = userData?.permissions;

    if (
      !perms ||
      typeof perms !== 'object' ||
      !Object.values(perms).some((value) => value === true)
    ) {
      return {
        isAuthenticated: true,
        checkComplete: true,
        redirectTo: isUnknownAdminPath ? '/admin/login' : '/admin/access-denied',
        redirectMode: isUnknownAdminPath ? 'push' : 'replace',
      };
    }

    // ==========================================
    // CURRENT ROUTE PERMISSION
    // ==========================================
    const matched = Object.entries(ROUTE_PERMISSIONS).find(
      ([route]) =>
        pathname === route ||
        pathname.startsWith(route + '/')
    );

    // ✅ featuredProducts/reviews legacy records me missing ho sakte hain —
    // backend undefined = allow, is liye products se fallback lo
    const ROUTE_FALLBACK = {
      featuredProducts: 'products',
      reviews: 'products',
      storeEditor: 'store',
    };
    const effectivePerm = (key) => {
      const v = perms[key];
      if (v !== undefined) return v;
      const fb = ROUTE_FALLBACK[key];
      if (fb) return perms[fb];
      return undefined;
    };

    if (matched && effectivePerm(matched[1]) === false) {
      return {
        isAuthenticated: true,
        checkComplete: true,
        redirectTo: '/admin/access-denied',
        redirectMode: 'replace',
      };
    }

    return {
      isAuthenticated: true,
      checkComplete: true,
      redirectTo: null,
    };
  }, [isLoginPage, userLoading, userError, userQueryError, userData, pathname, isUnknownAdminPath]);

  // ==========================================
  // STORE QUERY
  // ==========================================
  const {
    data: storeData,
    isLoading: storeLoading,
  } = useQuery({
    queryKey: ['store'],
    queryFn: getStoreData,
    enabled: !isLoginPage && authResult.isAuthenticated === true,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // ==========================================
  // THEME
  // ==========================================
  useEffect(() => {
    const saved = Cookies.get('theme') || 'light';

    document.documentElement.classList.toggle(
      'dark',
      saved === 'dark'
    );

    const frame = requestAnimationFrame(() => setTheme(saved));

    return () => cancelAnimationFrame(frame);
  }, []);

  // ==========================================
  // AUTH REDIRECT SIDE-EFFECT
  // ==========================================
  useEffect(() => {
    if (!authResult.redirectTo) return;

    if (authResult.redirectMode === 'push') {
      const status = userQueryError?.response?.status;
      if (status !== 401 && status !== 403) {
        console.error('Admin auth check failed:', userQueryError?.message || 'Authentication failed');
      }

      router.push(authResult.redirectTo);

      return;
    }

    router.replace(authResult.redirectTo);
  }, [authResult, router, userQueryError]);

  // ==========================================
  // PENDING SELLER LOCK — view-only panel
  // Clicks on any write action (Add/Save/Delete/Send/…) are swallowed here and
  // answered with a professional "awaiting approval" notice. Icon-only buttons
  // that can't be label-matched are still stopped by the API-layer 403 toast.
  // ==========================================
  const pendingLock = !!userData?.seller_pending;

  // Pending → approved (isi session me) — seller ko batao ke store live hai
  const wasPendingRef = useRef(false);
  useEffect(() => {
    if (!userData) return;
    if (wasPendingRef.current && !pendingLock) {
      toast.success('Your store has been approved!', {
        id: 'seller-approved',
        description: 'Your store is now live and your admin panel is fully unlocked. You can start adding products.',
        duration: 8000,
      });
    }
    wasPendingRef.current = pendingLock;
  }, [pendingLock, userData]);

  useEffect(() => {
    if (!pendingLock) return undefined;
    const onClickCapture = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest(
        'button, [role="button"], a, input[type="submit"], input[type="button"]'
      );
      if (!control) return;
      const label = (
        control.textContent ||
        control.getAttribute('aria-label') ||
        control.getAttribute('value') ||
        control.getAttribute('title') ||
        ''
      )
        .trim()
        .slice(0, 90);
      if (!label) return;
      if (SELLER_PENDING_ACTION_REGEX.test(label)) {
        event.preventDefault();
        event.stopPropagation();
        notifySellerPendingLocked();
      }
    };
    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [pendingLock]);

  // ==========================================
  // PENDING SELLER WELCOME DIALOG
  // Signup ke baad admin panel khulte hi ek baar (har browser session) batao ke
  // account approval ka wait kar raha hai. Banner neeche hamesha rehta hai.
  // ==========================================
  const [pendingNoticeClosed, setPendingNoticeClosed] = useState(false);
  const pendingNoticeKey = userData?._id ? `seller-pending-notice:${userData._id}` : null;
  const pendingNoticeSeen = (() => {
    if (!pendingNoticeKey || typeof window === 'undefined') return true;
    try {
      return window.sessionStorage.getItem(pendingNoticeKey) === '1';
    } catch {
      return false;
    }
  })();
  const showPendingNotice = pendingLock && !isLoginPage && !pendingNoticeClosed && !pendingNoticeSeen;

  const closePendingNotice = () => {
    try {
      if (pendingNoticeKey) window.sessionStorage.setItem(pendingNoticeKey, '1');
    } catch {
      // storage blocked — sirf is render ke liye band
    }
    setPendingNoticeClosed(true);
  };

  useEffect(() => {
    if (!showPendingNotice) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') closePendingNotice();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPendingNotice]);

  // ==========================================
  // USER LOG
  // ==========================================
  useEffect(() => {
    if (!userData) return;

  }, [userData]);

  // ==========================================
  // LIVE STORE SOCKET UPDATE
  // ==========================================
  useEffect(() => {
    const handleStoreUpdate = (event) => {
      if (!event.detail) return;


      queryClient.setQueryData(
        ['store'],
        event.detail
      );
    };

    window.addEventListener(
      'storeUpdated',
      handleStoreUpdate
    );

    return () => {
      window.removeEventListener(
        'storeUpdated',
        handleStoreUpdate
      );
    };
  }, [queryClient]);

  // ==========================================
  // LIVE PERMISSION SOCKET
  // ==========================================
  useEffect(() => {
    if (
      isLoginPage ||
      !userData?._id ||
      isAdminRole(userData?.role)
    ) {
      return;
    }

    const socket = getLayoutPermSocket();

    // ==========================================
    // RECONNECT SAFEGUARD
    // Socket reconnect hote hi profile refetch —
    // koi permission event miss ho jaye (disconnect,
    // laptop sleep) to sidebar + route guard khud
    // fresh permissions par converge kar jate hain.
    // ==========================================
    const handlePermissionSocketConnect = () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-user-profile'],
      });
    };

    socket.on('connect', handlePermissionSocketConnect);

    const handlePermissionUpdate = (updatedData) => {

      const payload =
        updatedData?.data ||
        updatedData?.user ||
        updatedData?.employee ||
        updatedData;

      const updatedUser = payload?.userId && typeof payload.userId === 'object'
        ? payload.userId
        : payload;

      if (!updatedUser) return;

      const targetUserId = updatedData?.userId || updatedUser?._id;
      if (targetUserId && String(targetUserId) !== String(userData._id)) return;

      const nextRole = updatedUser.role ?? userData.role;
      const nextPermissions = updatedUser.permissions ?? updatedData?.permissions ?? userData.permissions ?? {};
      const matchedRoute = Object.entries(ROUTE_PERMISSIONS).find(
        ([route]) => pathname === route || pathname.startsWith(`${route}/`)
      );

      // ✅ dashboard legacy payloads me missing ho sakta hai — sirf explicit false par redirect
      // ✅ featuredProducts/reviews legacy me missing hon to products se fallback (backend undefined = allow)
      const nextEffective = (key) => {
        const v = nextPermissions[key];
        if (v !== undefined) return v;
        if (key === 'featuredProducts' || key === 'reviews') return nextPermissions.products;
        return undefined;
      };
      const routeRevoked =
        !isAdminRole(nextRole) &&
        matchedRoute &&
        (matchedRoute[1] === 'dashboard'
          ? nextPermissions.dashboard === false
          : nextEffective(matchedRoute[1]) === false);
      if (routeRevoked) {
        router.replace('/admin/access-denied');
      }

      // ==========================================
      // UPDATE TANSTACK USER CACHE
      // ==========================================
      queryClient.setQueryData(
        ['admin-user-profile'],
        (oldUser) => {
          if (!oldUser) return oldUser;

          return {
            ...oldUser,
            ...updatedUser,
            permissions: nextPermissions,
            role:
              nextRole,
          };
        }
      );
    };

    socket.on(
      'permissionsUpdated',
      handlePermissionUpdate
    );

    socket.on(
      'authPermissionsUpdated',
      handlePermissionUpdate
    );

    socket.on(
      'employeeUpdated',
      handlePermissionUpdate
    );

    return () => {
      socket.off(
        'connect',
        handlePermissionSocketConnect
      );

      socket.off(
        'permissionsUpdated',
        handlePermissionUpdate
      );

      socket.off(
        'authPermissionsUpdated',
        handlePermissionUpdate
      );

      socket.off(
        'employeeUpdated',
        handlePermissionUpdate
      );
    };
  }, [
    isLoginPage,
    userData?._id,
    userData?.role,
    pathname,
    queryClient,
  ]);

  // ==========================================
  // LOGIN PAGE
  // ==========================================
  if (isLoginPage) {
    return <div className="contents" dir={dir} lang={locale}>{children}</div>;
  }

  // ==========================================
  // AUTH LOADING
  // ==========================================
  if (
    authResult.isAuthenticated === null ||
    !authResult.checkComplete
  ) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{
          backgroundColor: '#0a0c14',
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{
              borderColor: '#10b981',
              borderTopColor: 'transparent',
            }}
          />

          <p
            className="text-sm"
            style={{
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            {t('verifyingAccess')}
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // NOT AUTHENTICATED / TIMEOUT ERROR FALLBACK
  // ==========================================
  if (!authResult.isAuthenticated) {
    return (
      <div
        className="flex min-h-screen items-center justify-center flex-col gap-4 px-6"
        style={{ backgroundColor: '#0a0c14' }}
      >
        <div className="text-red-400 text-4xl">⚠️</div>
        <div className="text-center">
          <h2 className="text-white text-lg font-bold">{t('accessVerificationFailed')}</h2>
          <p className="text-sm text-white/50 mt-2 max-w-md">
            {authResult.transientError ? t('verificationUnavailable') : t('notAuthorized')}
          </p>
        </div>
        {!authResult.transientError && <button
          onClick={() => {
            window.location.href = '/admin/login';
          }}
          className="mt-4 px-5 py-2.5 rounded-md text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: '#10b981' }}
        >
          {t('goToLogin')}
        </button>}
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['admin-user-profile'] });
          }}
          className="text-xs text-white/40 hover:text-white/70 underline mt-2"
        >
          {t('retryVerification')}
        </button>
      </div>
    );
  }

  // ==========================================
  // THEME
  // ==========================================
  const toggleTheme = () => {
    const newTheme =
      theme === 'dark'
        ? 'light'
        : 'dark';

    setTheme(newTheme);

    Cookies.set(
      'theme',
      newTheme,
      {
        expires: 365,
        path: '/',
      }
    );

    document.documentElement.classList.toggle(
      'dark',
      newTheme === 'dark'
    );
  };

  // ==========================================
  // SIDEBAR
  // ==========================================
  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // ==========================================
  // ACCESS DENIED
  // ==========================================
  if (pathname === '/admin/access-denied') {
    return <div className="contents" dir={dir} lang={locale}>{children}</div>;
  }

  // ✅ Store editor full-screen (apna top bar) — auth/permission upar check ho chuka
  if (pathname === '/admin/store-editor' || pathname.startsWith('/admin/store-editor/')) {
    return <div className="admin-panel contents" dir={dir} lang={locale}>{children}</div>;
  }

  // ==========================================
  // MAIN LAYOUT
  // ==========================================
  return (
    <div className="admin-panel flex h-screen overflow-hidden" dir={dir} lang={locale}>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          sidebar-wrapper
          shrink-0
          h-screen
          z-50
          fixed
          md:relative
          top-0
          ${dir === 'rtl' ? 'right-0 left-auto' : 'left-0 right-auto'}
          transition-transform
          duration-300
          ease-in-out
          md:translate-x-0
          ${
            sidebarOpen
              ? 'translate-x-0'
              : dir === 'rtl' ? 'translate-x-full' : '-translate-x-full'
          }
        `}
      >
        <Sidebar
          onNavigate={closeSidebar}
          storeName={storeData?.store_name || storeData?.storeName || undefined}
          userData={userData}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* Navbar */}
        <Navbar
          theme={theme}
          toggleTheme={toggleTheme}
          onMenuClick={toggleSidebar}
          userData={userData}
        />

        {/* Pending approval banner — seller account until the Super Admin approves it */}
        {userData?.seller_pending ? (
          <div
            role="status"
            className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[12px] font-medium text-amber-900"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/25 text-amber-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
            <p>
              <strong className="font-bold">Your store application is pending Super Admin approval.</strong>{" "}
              You can view all pages but cannot create or edit anything yet — we&apos;ll email you once it&apos;s approved.
            </p>
          </div>
        ) : null}

        {showPendingNotice ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closePendingNotice();
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="seller-pending-title"
              aria-describedby="seller-pending-desc"
              className="w-full max-w-md rounded-2xl border border-line-card bg-card p-6 text-fg shadow-[0_24px_60px_-12px_rgba(15,23,42,0.45)] sm:p-7"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/15 text-amber-600" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span>
              <h2 id="seller-pending-title" className="mt-4 text-[19px] font-bold leading-tight">
                Your account is pending approval
              </h2>
              <p id="seller-pending-desc" className="mt-2 text-[13.5px] leading-6 text-fg-muted">
                Welcome to your store admin panel. Your seller account has been created and is waiting for approval from our team.
              </p>
              <ul className="mt-4 space-y-2.5 rounded-xl border border-line-card bg-page-alt p-4 text-[13px] leading-5">
                <li className="flex gap-2.5">
                  <span className="mt-0.5 text-emerald-600" aria-hidden="true">✓</span>
                  <span>You can explore every page of your admin panel.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-0.5 text-amber-600" aria-hidden="true">●</span>
                  <span>Creating and editing are locked until your account is approved.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-0.5 text-[#f57224]" aria-hidden="true">✉</span>
                  <span>
                    We&apos;ll email you{userData?.email ? <> at <strong className="font-semibold">{userData.email}</strong></> : null} as soon as you&apos;re approved.
                  </span>
                </li>
              </ul>
              <button
                type="button"
                autoFocus
                onClick={closePendingNotice}
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#f57224] px-5 text-[14px] font-semibold text-white transition hover:bg-[#e8651a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f57224]/30"
              >
                Got it, let me explore
              </button>
            </div>
          </div>
        ) : null}

        {/* Page */}
        {/* Keep the scrollport LTR so switching to an RTL locale does not move
            its horizontal origin and crop the left side of admin pages. Apply
            locale direction to the content wrapper instead. */}
        <main ref={adminMainRef} dir="ltr" className={`min-h-0 min-w-0 flex-1 ${pathname === '/admin/chats' ? 'overflow-hidden p-0' : 'overflow-y-auto overflow-x-auto overscroll-contain px-3 py-4 sm:px-5 sm:py-6'} bg-page-alt`}>
          <div dir={dir} lang={locale} className={pathname === '/admin/chats' ? "h-full min-w-0 w-full" : "mx-auto min-w-0 w-full max-w-[1600px]"}>{children}</div>
        </main>

      </div>
    </div>
  );
}
