'use client';

import { Menu, Sun, Moon, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Navbar({
  theme,
  toggleTheme,
  onMenuClick,
}) {
  const router = useRouter();

  const isDark = theme === 'dark';

  const handleLogout = () => {
    const confirmLogout = window.confirm(
      'Are you sure you want to logout?'
    );

    if (!confirmLogout) return;

    // Common authentication data clear
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('accessToken');

    sessionStorage.clear();

    // Login page par redirect
    router.push('/login');
  };

  return (
    <header
      className={`sticky top-0 z-40 flex h-16 items-center justify-between border-b px-4 transition-colors duration-300 sm:px-6 ${
        isDark
? 'border-slate-800 bg-slate-950'
: 'border-slate-200 bg-white'
      }`}
    >
      {/* Left Section */}
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${
            isDark
? 'border-slate-700 hover:bg-slate-800'
: 'border-slate-200 hover:bg-slate-100'
          } md:hidden`}
        >
          <Menu
            size={20}
            className={
              isDark? 'text-slate-300': 'text-slate-700'
            }
          />
        </button>

        {/* Page/Header Area */}
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-medium sm:text-base ${
              isDark? 'text-white': 'text-slate-900'
            }`}
          >
            Admin Dashboard
          </p>

          <p
            className={`hidden text-xs sm:block ${
              isDark? 'text-slate-400': 'text-slate-500'
            }`}
          >
            Manage your business
          </p>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={isDark? 'Switch to light mode': 'Switch to dark mode'}
          className={`flex h-10 w-10 items-center justify-center rounded-lg border transition ${
            isDark
? 'border-slate-700 hover:bg-slate-800'
: 'border-slate-200 hover:bg-slate-100'
          }`}
        >
          {isDark? (
            <Sun size={18} className="text-yellow-400" />
          ): (
            <Moon size={18} className="text-slate-700" />
          )}
        </button>

        {/* Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right md:block">
            <p
              className={`text-sm font-semibold ${
                isDark? 'text-white': 'text-slate-900'
              }`}
            >
              Admin
            </p>

            <p
              className={`text-xs ${
                isDark? 'text-slate-400': 'text-slate-500'
              }`}
            >
              Company Admin
            </p>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 font-semibold text-white">
            A
          </div>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          title="Logout"
          className={`flex h-10 items-center gap-2 rounded-lg border px-3 transition ${
            isDark
? 'border-red-900/60 text-red-400 hover:bg-red-950/50'
: 'border-red-200 text-red-600 hover:bg-red-50'
          }`}
        >
          <LogOut size={17} />

          <span className="hidden text-sm font-medium sm:inline">
            Logout
          </span>
        </button>
      </div>
    </header>
  );
}

