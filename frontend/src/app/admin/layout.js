'use client';
 
import { useState, useEffect } from 'react';
import Sidebar from '../Component/Sidebar';
import Navbar from '../Component/Navbar';
 
export default function AdminLayout({ children }) {
  const [theme, setTheme] = useState('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
 
  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    setTheme(saved);
    document.documentElement.classList.toggle('light', saved === 'light');
  }, []);
 
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
  };
 
  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);
 
  return (
    <div className="flex h-screen overflow-hidden">
 
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          aria-hidden="true"
        />
      )}
 
      {/* Sidebar */}
      <div
        className={`
          sidebar-wrapper shrink-0 h-screen z-50
          fixed md:relative top-0 left-0
          transition-transform duration-300 ease-in-out
          md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar onNavigate={closeSidebar} />
      </div>
 
      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
 
        <Navbar theme={theme} toggleTheme={toggleTheme} onMenuClick={toggleSidebar} />
 
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[var(--bg-secondary)] p-4 sm:p-6">
          {children}
        </main>
 
      </div>
    </div>
  );
}
 