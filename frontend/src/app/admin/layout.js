'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '../Component/Sidebar';
import Navbar from '../Component/Navbar';
import axiosInstance from '@/apis/axiosInstance';
import Cookies from 'js-cookie';

// ✅ IMPORT store socket sync hook
import { useStoreSocketSync } from '../../hooks/useStoreSocketSync';

export default function AdminLayout({ children }) {
  const [theme, setTheme] = useState('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = checking
  
  // ✅ Store data state - socket se real-time update hoga
  const [storeData, setStoreData] = useState(null);

  const router = useRouter();
  const pathname = usePathname();

  // ✅ Socket sync initialize karo - yeh store updates automatically sunega
  useStoreSocketSync();

  // ✅ FIXED: localStorage → Cookies
  useEffect(() => {
    const saved = Cookies.get('theme') || 'dark';
    setTheme(saved);
    document.documentElement.classList.toggle('light', saved === 'light');
  }, []);

  // ✅ FIXED: localStorage → Cookies (cached store data load)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = Cookies.get('storeData');
      if (cached) {
        try {
          setStoreData(JSON.parse(cached));
        } catch (e) {
          console.error('Failed to parse cached storeData:', e);
        }
      }
    }
  }, []);

  // ✅ Custom event listener - jab socket se store update aaye
  useEffect(() => {
    const handleStoreUpdate = (e) => {
      console.log('🔄 Layout received storeUpdated event:', e.detail?.store_name);
      if (e.detail) {
        setStoreData(e.detail);
      }
    };

    window.addEventListener('storeUpdated', handleStoreUpdate);
    return () => window.removeEventListener('storeUpdated', handleStoreUpdate);
  }, []);

  // Authentication Check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await axiosInstance.get('/users/profile');
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, pathname]);

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <p className="text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect will happen via useEffect
  if (!isAuthenticated) {
    return null;
  }

  // ✅ FIXED: localStorage → Cookies
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    Cookies.set('theme', newTheme, { expires: 365, path: '/' });
    document.documentElement.classList.toggle('light', newTheme === 'light');
  };

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          aria-hidden="true"
        />
      )}
      
      <div
        className={`
          sidebar-wrapper shrink-0 h-screen z-50
          fixed md:relative top-0 left-0
          transition-transform duration-300 ease-in-out
          md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* ✅ storeData pass karo Sidebar ko */}
        <Sidebar onNavigate={closeSidebar} storeData={storeData} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* ✅ storeData pass karo Navbar ko bhi */}
        <Navbar theme={theme} toggleTheme={toggleTheme} onMenuClick={toggleSidebar} storeData={storeData} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[var(--bg-secondary)] p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}