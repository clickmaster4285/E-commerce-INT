'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axiosInstance from "@/apis/axiosInstance";
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const loginMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await axiosInstance.post("/users/admin/login", userData);
      return response.data;
    },
    onSuccess: (data) => {
      // ✅ Sirf admin ko allow karein
      if (data.user.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        // Agar user role ho, to logout karwa dein aur error dikhayein
        axiosInstance.post('/users/logout').catch(() => {});
        setError('Only admins can access this page. Please use user login instead.');
      }
    },
    onError: (error) => {
      setError(error.response?.data?.message || 'Login failed!');
    }
  });

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex bg-gray-900">
      {/* Left Side */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gray-950">
        {/* TOP */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <span className="text-white font-semibold text-xl">ClickMasters</span>
        </div>

        {/* MIDDLE */}
        <div className="flex-1 flex flex-col justify-center -mt-20">
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Admin Control<br />
            <span className="text-emerald-500">Panel</span>
          </h1>
          <p className="text-gray-400 text-lg mb-8">
            Inventory · Brands · Categories · Products · Analytics<br />
            Manage everything from one secure workspace.
          </p>
        </div>

        {/* BOTTOM */}
        <div className="text-gray-500 text-sm">© 2026 ClickMasters Admin</div>
      </div>

      {/* Right Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-900">
        <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-xl p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-emerald-500 text-xs font-bold uppercase tracking-wider">Admin Sign-In</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Admin Login</h2>
          <p className="text-gray-400 text-sm mb-6">Admin account use karein.</p>

          {/* Error Message */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-900 text-white px-4 py-3 border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500 transition placeholder-gray-500"
                placeholder="admin@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-900 text-white px-4 py-3 border border-gray-700 rounded-lg focus:outline-none focus:border-emerald-500 transition placeholder-gray-500 pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-70"
            >
              {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* User Login Link */}
          <p className="text-center mt-6 text-gray-500 text-sm">
            Normal user hain?{" "}
            <Link href="/login" className="text-emerald-500 hover:underline font-semibold">
              User Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}