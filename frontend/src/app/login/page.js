'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import axiosInstance from "@/apis/axiosInstance";
import { Eye, EyeOff, Shield, Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await axiosInstance.post("/users/login", userData);
      return response.data;
    },
    onSuccess: (data) => {
      const allowedRoles = ['admin', 'staff', 'manager'];

      if (!allowedRoles.includes(data.user?.role)) {
        toast.error('Access Denied', {
          description: 'Your account does not have permission to access this portal.',
          duration: 4000,
        });
        axiosInstance.post("/users/logout");
        return;
      }

      const name = data.user?.name || '';
      const firstName = name.split(' ')[0];
      toast.success(`Welcome back${firstName ? `, ${firstName}` : ''}!`, {
        description: 'Redirecting you to the dashboard...',
        duration: 3000,
      });

      setTimeout(() => {
        router.push('/admin/dashboard');
      }, 1200);
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Login failed. Please try again.';
      toast.error('Authentication Failed', {
        description: message,
        duration: 4000,
      });
    }
  });

  const handleLogin = (e) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.warning('Email Required', {
        description: 'Please enter your email address.',
        duration: 3000,
      });
      return;
    }
    if (!password.trim()) {
      toast.warning('Password Required', {
        description: 'Please enter your password.',
        duration: 3000,
      });
      return;
    }

    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#0a0c14' }}>
      
      {/* ===== LEFT SIDE — Branding ===== */}
      <div 
        className="hidden lg:flex lg:w-[55%] flex-col justify-between p-10 xl:p-14 relative overflow-hidden"
        style={{ backgroundColor: '#060810' }}
      >
        {/* Subtle gradient overlay */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{ 
            background: 'radial-gradient(ellipse at 30% 50%, rgba(16, 185, 129, 0.08) 0%, transparent 70%)' 
          }} 
        />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div 
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#10b981' }}
          >
            <span className="text-white font-bold text-base">C</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">ClickMasters</span>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center -mt-16 max-w-lg">
          <div 
            className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <div className="flex items-center gap-2 mb-6">
              <div 
                className="h-px w-8"
                style={{ backgroundColor: '#10b981' }}
              />
              <span 
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: '#10b981' }}
              >
                Inventory Management
              </span>
            </div>
            
            <h1 className="text-[2.5rem] xl:text-[2.75rem] font-bold text-white mb-5 leading-[1.15] tracking-tight">
              E-Commerce<br />
              Inventory<br />
              <span style={{ color: '#10b981' }}>Operating System</span>
            </h1>
            
            <p className="text-[15px] leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Restricted Access Portal.<br />
              Authorized Administrators & Staff Only.
            </p>

            {/* Stats row */}
            <div className="flex items-center gap-8">
              {[
                { value: '99.9%', label: 'Uptime' },
                { value: '256-bit', label: 'Encrypted' },
                { value: '24/7', label: 'Monitored' },
              ].map((stat, i) => (
                <div key={i}>
                  <p className="text-white font-bold text-lg">{stat.value}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between">
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.2)' }}>© 2026 ClickMasters</p>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#10b981' }} />
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>All systems operational</span>
          </div>
        </div>
      </div>

      {/* ===== RIGHT SIDE — Login Form ===== */}
      <div 
        className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-8 relative"
        style={{ backgroundColor: '#0a0c14' }}
      >
        {/* Subtle glow */}
        <div 
          className="absolute top-1/4 right-0 w-64 h-64 rounded-full blur-[100px] opacity-20 pointer-events-none"
          style={{ backgroundColor: '#10b981' }}
        />

        <div 
          className={`w-full max-w-[400px] transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8 justify-center">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#10b981' }}
            >
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-white font-semibold text-base">ClickMasters</span>
          </div>

          {/* Secure badge */}
          <div className="flex items-center gap-2 mb-6">
            <div 
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.15)' }}
            >
              <Shield size={14} style={{ color: '#10b981' }} />
            </div>
            <span 
              className="text-[11px] font-semibold uppercase tracking-[0.15em]"
              style={{ color: '#10b981' }}
            >
              Secure Sign-In
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-[1.6rem] font-bold text-white mb-1.5 tracking-tight">
            Welcome back
          </h2>
          <p className="text-[13px] mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Sign in to your admin or staff account
          </p>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* Email */}
            <div className="space-y-2">
              <label 
                className="block text-[12px] font-medium"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                Email Address
              </label>
              <div className="relative">
                <Mail 
                  size={16} 
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-lg text-[13px] outline-none transition-all duration-200 placeholder-transparent"
                  style={{ 
                    backgroundColor: 'rgba(255,255,255,0.04)', 
                    border: '1px solid rgba(255,255,255,0.08)', 
                    color: '#fff',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label 
                className="block text-[12px] font-medium"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                Password
              </label>
              <div className="relative">
                <Lock 
                  size={16} 
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-11 rounded-lg text-[13px] outline-none transition-all duration-200 placeholder-transparent"
                  style={{ 
                    backgroundColor: 'rgba(255,255,255,0.04)', 
                    border: '1px solid rgba(255,255,255,0.08)', 
                    color: '#fff',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="••••••••"
                  required
                />
                {/* ✅ Eye Icon Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors duration-150"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-11 rounded-lg text-[13px] font-semibold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 mt-2 group"
              style={{ 
                backgroundColor: '#10b981', 
                color: '#fff',
              }}
              onMouseEnter={(e) => {
                if (!loginMutation.isPending) {
                  e.currentTarget.style.backgroundColor = '#059669';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#10b981';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.15)' }}>Protected</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Footer note */}
          <div className="flex items-center justify-center gap-2">
            <Lock size={11} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Unauthorized access is strictly prohibited
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}