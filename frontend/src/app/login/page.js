'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const loginMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await axios.post('http://localhost:5000/api/users/login', userData);
      return response.data;
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.jwtLoginToken);
      localStorage.setItem('role', data.role);
      
      if (data.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/dashboard');
      }
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Login failed!');
    }
  });

  const handleLogin = (e) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left Side - Enhanced Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-slate-950 p-12">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="text-white font-semibold text-xl tracking-wide">ClickMasters</span>
          </div>

          {/* Main Content */}
          <div className="mt-12">
            <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
              E-Commerce Inventory<br />
              <span className="text-blue-500">Management System</span>
            </h1>

            <p className="text-slate-400 text-lg mb-10 max-w-md leading-relaxed">
              Streamline your business operations. Manage products, brands, and categories seamlessly from one secure, centralized dashboard.
            </p>

            {/* Thora sa ziada info: Clean Feature Points */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Real-time inventory tracking</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Enterprise-grade security</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Fast and intuitive interface</span>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-slate-600 text-sm">
          © 2026 ClickMasters. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-950">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl">
            {/* Secure Sign-In Header */}
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-blue-500 text-sm font-semibold">SECURE SIGN-IN</span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Sign in</h2>
            <p className="text-slate-400 text-sm mb-8">Use your work account to continue.</p>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Input */}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Username or Email</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800/50 text-white pl-12 pr-4 py-3 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-slate-500"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Password</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800/50 text-white pl-12 pr-12 py-3 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-slate-500"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-slate-400 text-sm">Remember me</span>
                </label>
                <a href="#" className="text-blue-500 hover:text-blue-400 text-sm font-medium transition-colors">
                  Forgot password?
                </a>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-blue-500/25 disabled:opacity-70 disabled:cursor-not-allowed mt-6"
              >
                {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

           
          </div>
        </div>
      </div>
    </div>
  );
}