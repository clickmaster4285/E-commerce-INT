'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '../Component/Sidebar';
import Navbar from '../Component/Navbar';
import axiosInstance from '@/apis/axiosInstance';
import Cookies from 'js-cookie';
import { useStoreSocketSync } from '../../hooks/useStoreSocketSync';
import { io } from 'socket.io-client';

// ==========================================
// ✅ ROUTE → PERMISSION MAPPING
// ==========================================
const ROUTE_PERMISSIONS = {
  '/admin/brands': 'brands',
  '/admin/categories': 'categories',
  '/admin/products': 'products',
  '/admin/store-info': 'store',
  '/admin/profile': 'profile',
  '/admin/employees': 'employees',
};

// ✅ Singleton socket for layout permission listener
let layoutPermSocket = null;

function getLayoutPermSocket() {
  if (layoutPermSocket && layoutPermSocket.connected) return layoutPermSocket;

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

export default function AdminLayout({ children }) {
  const [theme, setTheme] = useState('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [storeData, setStoreData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [permissionCheckDone, setPermissionCheckDone] = useState(false);

  // ✅ LIVE permissions from socket — updates in real-time
  const [livePermissions, setLivePermissions] = useState(null);
  const [liveRole, setLiveRole] = useState(null);

  const router = useRouter();
  const pathname = usePathname();

  useStoreSocketSync();

  // ✅ Active permissions: prefer live socket data over API data
  const activePermissions = livePermissions || userData?.permissions || null;
  const activeRole = liveRole || userData?.role || null;

  // Theme
  useEffect(() => {
    const saved = Cookies.get('theme') || 'dark';
    setTheme(saved);
    document.documentElement.classList.toggle('light', saved === 'light');
  }, []);

  // Cached store data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = Cookies.get('storeData');
      if (cached) {
        try {
          setStoreData(JSON.parse(cached));
        } catch (e) {}
      }
    }
  }, []);

  // Store update event
  useEffect(() => {
    const handleStoreUpdate = (e) => {
      if (e.detail) setStoreData(e.detail);
    };
    window.addEventListener('storeUpdated', handleStoreUpdate);
    return () => window.removeEventListener('storeUpdated', handleStoreUpdate);
  }, []);

  // ==========================================
  // ✅ STEP 1: FETCH USER DATA (Initial Auth)
  // ==========================================
  useEffect(() => {
    const checkAuthAndFetchUser = async () => {
      try {
        const response = await axiosInstance.get('/users/profile');
        console.log('🔍 RAW API RESPONSE:', response.data);

        setIsAuthenticated(true);

        let extractedUser = null;
        if (response.data?.user) extractedUser = response.data.user;
        else if (response.data?.data?.user) extractedUser = response.data.data.user;
        else if (response.data?.role) extractedUser = response.data;
        else if (response.data?.data?.role) extractedUser = response.data.data;

        setUserData(extractedUser);

        if (extractedUser?._id) {
          localStorage.setItem('current_staff_id', extractedUser._id);
        }

        console.log('✅ USER:', extractedUser?.name, '| ROLE:', extractedUser?.role, '| PERMS:', extractedUser?.permissions);

        // Initial permission check
        const role = extractedUser?.role?.toLowerCase();
        const perms = extractedUser?.permissions;

        if (role === 'admin') {
          setPermissionCheckDone(true);
          return;
        }

        if (!perms || typeof perms !== 'object' || !Object.values(perms).some((v) => v === true)) {
          setPermissionCheckDone(true);
          router.replace('/admin/access-denied');
          return;
        }

        // Check current route
        const matched = Object.entries(ROUTE_PERMISSIONS).find(
          ([route]) => pathname === route || pathname.startsWith(route + '/')
        );
        if (matched && perms[matched[1]] === false) {
          setPermissionCheckDone(true);
          router.replace('/admin/access-denied');
          return;
        }

        setPermissionCheckDone(true);
      } catch (error) {
        console.error('❌ Auth failed:', error.message);
        setIsAuthenticated(false);
        setPermissionCheckDone(true);
        router.push('/login');
      }
    };

    checkAuthAndFetchUser();
  }, []);

  // ==========================================
  // ✅ STEP 2: SOCKET — REAL-TIME PERMISSION LISTENER
  // ==========================================
  useEffect(() => {
    const socket = getLayoutPermSocket();

    const handleConnect = () => {
      console.log('🟢 Layout perm socket connected:', socket.id);
      socket.emit('getProfile');
    };

    // Receive initial profile data
    const handleProfileData = (res) => {
      if (!res) return;
      const data = res.data || res.user || res;
      if (data?.permissions) {
        console.log('📥 Layout socket → profileData permissions:', data.permissions);
        setLivePermissions(data.permissions);
        setLiveRole(data.role || '');
      }
    };

    // ✅ CRITICAL: Real-time permission update from admin
    const handlePermissionsUpdated = (data) => {
      console.log('⚡ permissionsUpdated received:', data);

      const currentUserId = localStorage.getItem('current_staff_id');
      if (!data?.userId || !currentUserId || data.userId !== currentUserId) {
        console.log('   → Not for current user, ignoring');
        return;
      }

      const newPerms = data.permissions || {};
      console.log('🔄 Updating live permissions:', newPerms);

      // Update state immediately
      setLivePermissions(newPerms);
      if (data.role) setLiveRole(data.role);

      // ✅ INSTANT CHECK: All permissions revoked?
      const hasAnyTrue = Object.values(newPerms).some((v) => v === true);

      if (!hasAnyTrue) {
        console.log('🚫 ALL PERMISSIONS REVOKED — INSTANT REDIRECT!');
        router.replace('/admin/access-denied');
        return;
      }

      // ✅ INSTANT CHECK: Current route still allowed?
      const currentPath = window.location.pathname;
      const matched = Object.entries(ROUTE_PERMISSIONS).find(
        ([route]) => currentPath === route || currentPath.startsWith(route + '/')
      );

      if (matched && newPerms[matched[1]] === false) {
        console.log(`🚫 Route ${currentPath} REVOKED — INSTANT REDIRECT!`);
        router.replace('/admin/access-denied');
        return;
      }

      // ✅ If on access-denied page but now has permissions → go to dashboard
      if (hasAnyTrue && currentPath === '/admin/access-denied') {
        console.log('✅ Permissions GRANTED — redirecting to dashboard!');
        router.replace('/admin/dashboard');
      }
    };

    // Also handle profileUpdated
    const handleProfileUpdated = (res) => {
      const data = res?.data || res?.user || res;
      if (!data) return;

      const currentUserId = localStorage.getItem('current_staff_id');
      if (data._id && currentUserId && data._id === currentUserId && data.permissions) {
        console.log('🔄 profileUpdated → updating live permissions:', data.permissions);
        setLivePermissions(data.permissions);
        setLiveRole(data.role || '');

        const hasAnyTrue = Object.values(data.permissions).some((v) => v === true);
        if (!hasAnyTrue && window.location.pathname !== '/admin/access-denied') {
          router.replace('/admin/access-denied');
        }
      }
    };

    if (socket.connected) {
      socket.emit('getProfile');
    } else {
      socket.on('connect', handleConnect);
    }

    socket.on('profileData', handleProfileData);
    socket.on('permissionsUpdated', handlePermissionsUpdated);
    socket.on('profileUpdated', handleProfileUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('profileData', handleProfileData);
      socket.off('permissionsUpdated', handlePermissionsUpdated);
      socket.off('profileUpdated', handleProfileUpdated);
    };
  }, []);

  // ==========================================
  // ✅ STEP 3: RE-CHECK ON ROUTE CHANGE
  // ==========================================
  useEffect(() => {
    if (!permissionCheckDone || !activePermissions) return;
    if (pathname === '/admin/access-denied') return;

    const role = activeRole?.toLowerCase();
    if (role === 'admin') return;

    const hasAnyTrue = Object.values(activePermissions).some((v) => v === true);
    if (!hasAnyTrue) {
      router.replace('/admin/access-denied');
      return;
    }

    const matched = Object.entries(ROUTE_PERMISSIONS).find(
      ([route]) => pathname === route || pathname.startsWith(route + '/')
    );
    if (matched && activePermissions[matched[1]] === false) {
      router.replace('/admin/access-denied');
    }
  }, [pathname, permissionCheckDone, activePermissions, activeRole, router]);

  // ==========================================
  // ✅ LOADING SCREEN
  // ==========================================
  if (!permissionCheckDone) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0a0c14' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#10b981', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    Cookies.set('theme', newTheme, { expires: 365, path: '/' });
    document.documentElement.classList.toggle('light', newTheme === 'light');
  };

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  if (pathname === '/admin/access-denied') return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div onClick={closeSidebar} className="fixed inset-0 bg-black/50 z-40 md:hidden" aria-hidden="true" />
      )}
      <div className={`sidebar-wrapper shrink-0 h-screen z-50 fixed md:relative top-0 left-0 transition-transform duration-300 ease-in-out md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onNavigate={closeSidebar} storeData={storeData} userData={userData} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar theme={theme} toggleTheme={toggleTheme} onMenuClick={toggleSidebar} storeData={storeData} userData={userData} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[var(--bg-secondary)] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}