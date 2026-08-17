'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '../Component/Sidebar';
import Navbar from '../Component/Navbar';
import axiosInstance from '@/apis/axiosInstance';
import Cookies from 'js-cookie';
import { useStoreSocketSync } from '../../hooks/useStoreSocketSync';

export default function AdminLayout({ children }) {
  const [theme, setTheme] = useState('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [storeData, setStoreData] = useState(null);

  const router = useRouter();
  const pathname = usePathname();

  // ✅ Login page par layout apply NAHI karna
  const isLoginPage = pathname === '/admin/login';

  useStoreSocketSync();

  // Theme
  useEffect(() => {
    const saved = Cookies.get('theme') || 'dark';
    setTheme(saved);
    document.documentElement.classList.toggle('light', saved === 'light');
  }, []);

  // Store data cache
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

  // Socket listener
  useEffect(() => {
    const handleStoreUpdate = (e) => {
      if (e.detail) setStoreData(e.detail);
    };
    window.addEventListener('storeUpdated', handleStoreUpdate);
    return () => window.removeEventListener('storeUpdated', handleStoreUpdate);
  }, []);

  // ✅ Authentication Check — SIRF login page ke ilawa
  useEffect(() => {
    if (isLoginPage) {
      setIsAuthenticated(true); // Login page ko bypass karo
      return;
    }

    const checkAuth = async () => {
      try {
        await axiosInstance.get('/users/profile');
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
        // ✅ Admin login par bhejo (user login par nahi)
        router.push('/admin/login');
      }
    };

    checkAuth();
  }, [router, pathname, isLoginPage]);

  // ✅ Login page — bina Sidebar/Navbar ke sirf children
  if (isLoginPage) {
    return <>{children}</>;
  }

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

  if (!isAuthenticated) {
    return null;
  }

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
        <Sidebar onNavigate={closeSidebar} storeData={storeData} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar theme={theme} toggleTheme={toggleTheme} onMenuClick={toggleSidebar} storeData={storeData} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[var(--bg-secondary)] p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}