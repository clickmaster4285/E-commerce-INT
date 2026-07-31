'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../Component/Sidebar';
import Navbar from '../Component/Navbar';

export default function AdminLayout({ children }) {
  const [theme, setTheme] = useState('light');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light';
    setTheme(saved);
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 40,
            display: 'block',
          }}
          className="mobile-only"
        />
      )}

      {/* Sidebar */}
      <div
        className={`sidebar-wrapper ${mobileOpen ? 'sidebar-open' : ''}`}
        style={{
          position: 'relative',
          zIndex: 50,
        }}
      >
        <Sidebar />
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar
          theme={theme}
          toggleTheme={toggleTheme}
          onMenuToggle={() => setMobileOpen(!mobileOpen)}
        />

        <main
          style={{
            flex: 1,
            padding: '24px',
            backgroundColor: 'var(--bg-secondary)',
            overflow: 'auto',
          }}
        >
          {children}
        </main>
      </div>

      {/* Responsive Styles */}
      <style jsx global>{`
        .mobile-only {
          display: none !important;
        }
        .hide-mobile {
          display: block;
        }
        .sidebar-wrapper {
          flex-shrink: 0;
        }
        @media (max-width: 768px) {
          .mobile-only {
            display: block !important;
          }
          .hide-mobile {
            display: none !important;
          }
          .sidebar-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }
          .sidebar-wrapper.sidebar-open {
            transform: translateX(0);
          }
          main {
            padding: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}