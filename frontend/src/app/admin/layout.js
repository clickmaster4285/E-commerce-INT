'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  // Navigation links
  const navLinks = [
    { name: 'Home', href: '/admin/dashboard', icon: '🏠' },
    { name: 'Brands', href: '/admin/brands', icon: '🏷️' },
    { name: 'Categories', href: '/admin/categories', icon: '📂' },
    { name: 'Products', href: '/admin/products', icon: '📦' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      
      {/* --- BLUE SIDEBAR --- */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-blue-600 to-indigo-700 border-r border-blue-500 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Logo */}
          <div className="flex items-center justify-center h-20 border-b border-white/20">
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <span className="text-3xl"></span> Inventory App
            </h1>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-white text-blue-600 font-bold shadow-lg' 
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer (Logout) */}
          <div className="p-4 border-t border-white/20">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors font-semibold shadow-md"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* BLUE HEADER */}
        <header className="h-16 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between px-6 shadow-md relative z-30">
          {/* Mobile Menu Button */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Header Title */}
          <h2 className="text-lg font-bold text-white hidden md:block drop-shadow-sm">
            Dashboard Overview
          </h2>

          {/* Right side of header (User info) */}
          <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm border border-white/30 px-4 py-2 rounded-xl">
            <div className="w-8 h-8 bg-white text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm">
              U
            </div>
            <span className="text-sm font-semibold text-white hidden sm:block">Admin User</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}