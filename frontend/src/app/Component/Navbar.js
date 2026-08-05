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

    // Login page redirect
    router.push('/login');
  };

  return (
    <header
      className={`sticky top-0 z-40 flex h-16 items-center justify-between border-b px-4 transition-all duration-300 sm:px-6 backdrop-blur-md ${
        isDark
          ? 'border-slate-800/50 bg-slate-950/80 shadow-sm shadow-slate-900/20'
          : 'border-slate-200/60 bg-white/80 shadow-sm shadow-slate-200/50'
      }`}
    >
      {/* Left Section */}
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors duration-200 active:scale-95 ${
            isDark
              ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
              : 'border-slate-200 hover:bg-slate-100 text-slate-700'
          } md:hidden`}
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Theme Toggle — Simple, No Border */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 active:scale-95 ${
            isDark
              ? 'hover:bg-slate-800 text-slate-300'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right md:block">
            <p
              className={`text-sm font-semibold ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Admin
            </p>

            <p
              className={`text-xs ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Company Admin
            </p>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 font-semibold text-white shadow-md shadow-violet-500/20 ring-2 ring-white/10">
            A
          </div>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          title="Logout"
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 active:scale-95 ${
            isDark
              ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
              : 'text-red-500 hover:bg-red-50 hover:text-red-600'
          }`}
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}