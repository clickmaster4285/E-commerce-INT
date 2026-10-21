'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Sidebar from '../../components/adminComponents/Sidebar';
import Navbar from '../../components/adminComponents/Navbar';
import adminHttp from '@/apis/axiosInstance';
import Cookies from 'js-cookie';
import { useStoreSocketSync } from '../../hooks/admin/useStoreSocketSync';
import { useShippingSocketSync } from '../../hooks/admin/useShippingSocketSync';
import { useOrderSocketSync } from '../../hooks/admin/useOrderSocketSync';
import { io } from 'socket.io-client';
import { useTranslation } from '../../i18n/LanguageProvider';

// ==========================================
// ROUTE → PERMISSION MAPPING
// ==========================================
const ROUTE_PERMISSIONS = {
  '/admin/dashboard': 'dashboard',
  '/admin/brands': 'brands',
    '/admin/orders': 'order',

  '/admin/categories': 'categories',
  '/admin/attributes': 'attribute',
  '/admin/products': 'products',
  // ✅ Featured Products — alag permission (legacy: products se fallback, backend undefined = allow)
  '/admin/featured-products': 'featuredProducts',
  // ✅ Reviews — alag permission (legacy: products se fallback, backend undefined = allow)
  '/admin/reviews': 'reviews',
  '/admin/store-info': 'store',
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

// ==========================================
// SINGLETON SOCKET
// ==========================================
let layoutPermSocket = null;

function getLayoutPermSocket() {
  if (layoutPermSocket && layoutPermSocket.connected) {
    return layoutPermSocket;
  }

  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

  layoutPermSocket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
  });

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
    console.error('❌ getProfile failed:', err?.message || err, '| code:', err?.code || 'N/A');
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

  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

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
    refetchOnWindowFocus: false,
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

    if (role === 'admin') {
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
        redirectTo: '/admin/access-denied',
        redirectMode: 'replace',
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
  }, [isLoginPage, userLoading, userError, userQueryError, userData, pathname]);

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
      console.error('❌ Auth failed:', userQueryError?.message || 'Authentication failed');

      router.push(authResult.redirectTo);

      return;
    }

    router.replace(authResult.redirectTo);
  }, [authResult, router, userQueryError]);

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
      userData?.role?.toLowerCase() === 'admin'
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
        String(nextRole).toLowerCase() !== 'admin' &&
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

  // ==========================================
  // MAIN LAYOUT
  // ==========================================
  return (
    <div className="admin-panel flex h-screen overflow-hidden" dir="ltr">

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
          left-0
          transition-transform
          duration-300
          ease-in-out
          md:translate-x-0
          ${
            sidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full'
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

        {/* Page */}
        <main dir={dir} lang={locale} className="flex-1 overflow-y-auto overflow-x-auto bg-[var(--bg-secondary)] px-3 sm:px-5 py-4 sm:py-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>

      </div>
    </div>
  );
}
