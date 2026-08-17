'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldX, Mail, Lock, AlertTriangle, LogOut } from 'lucide-react';
import axiosInstance from '@/apis/axiosInstance';
import { toast } from 'sonner';

export default function AccessDeniedPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState(20);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      handleLogout();
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await axiosInstance.post('/users/logout');
    } catch (err) {
      console.error('Logout error:', err);
    }
    toast.info('Logged out', {
      description: 'Please contact your admin for access.',
      duration: 3000,
    });
    setTimeout(() => {
      router.replace('/login');
    }, 800);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: '#060810' }}
    >
      {/* Background glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[150px] opacity-[0.07] pointer-events-none"
        style={{ backgroundColor: '#ef4444' }}
      />
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* ===== MAIN CARD ===== */}
      <div
        className={`relative z-10 w-full max-w-[640px] transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div
          className="rounded-2xl p-10 sm:p-12 text-center"
          style={{
            backgroundColor: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(30px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Top accent line */}
          <div
            className="absolute top-0 left-1/4 right-1/4 h-[2px] rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
              opacity: 0.5,
            }}
          />

          {/* Shield Icon */}
          <div className="flex justify-center mb-6">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                boxShadow: '0 0 40px rgba(239, 68, 68, 0.1)',
              }}
            >
              <ShieldX size={38} style={{ color: '#ef4444' }} />
            </div>
          </div>

          {/* Badge */}
          <div className="flex justify-center mb-5">
            <div
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
              }}
            >
              <AlertTriangle size={12} style={{ color: '#f87171' }} />
              <span
                className="text-[11px] font-bold uppercase tracking-[0.12em]"
                style={{ color: '#f87171' }}
              >
                403 — Forbidden
              </span>
            </div>
          </div>

          {/* Heading */}
          <h1
            className="text-[2rem] sm:text-[2.25rem] font-bold mb-3 tracking-tight"
            style={{ color: '#fff' }}
          >
            Access Denied
          </h1>

          {/* Description */}
          <p
            className="text-[14px] leading-relaxed mb-1.5 max-w-[440px] mx-auto"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            You don&apos;t have any permissions enabled for your account.
          </p>
          <p
            className="text-[13px] leading-relaxed mb-8 max-w-[480px] mx-auto"
            style={{ color: 'rgba(255,255,255,0.28)' }}
          >
            Please contact your{' '}
            <span style={{ color: '#10b981', fontWeight: 600 }}>administrator</span> or{' '}
            <span style={{ color: '#10b981', fontWeight: 600 }}>staff manager</span> to
            request access. They can enable permissions from{' '}
            <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
              Employee Settings → Access Permissions
            </span>
            .
          </p>

          {/* Info Box */}
          <div
            className="rounded-xl p-5 mb-8 text-left max-w-[520px] mx-auto"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.03)',
              border: '1px solid rgba(16, 185, 129, 0.08)',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.12)',
                }}
              >
                <Mail size={14} style={{ color: '#10b981' }} />
              </div>
              <div>
                <p
                  className="text-[13px] font-semibold mb-2"
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                >
                  What can you do?
                </p>
                <ul className="space-y-1.5">
                  {[
                    'Ask your admin to grant you the required permissions',
                    'Once enabled, log in again to access the dashboard',
                    'Your account is active — you just need permission access',
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="text-[12px] leading-relaxed flex items-start gap-2"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      <span
                        className="mt-1.5 w-1 h-1 rounded-full shrink-0"
                        style={{ backgroundColor: 'rgba(16, 185, 129, 0.5)' }}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full sm:w-auto h-11 px-7 rounded-xl text-[13px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
              style={{
                backgroundColor: '#ef4444',
                color: '#fff',
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.2)',
              }}
              onMouseEnter={(e) => {
                if (!isLoggingOut) {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                  e.currentTarget.style.boxShadow = '0 6px 30px rgba(239, 68, 68, 0.35)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ef4444';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(239, 68, 68, 0.2)';
              }}
            >
              <LogOut size={15} />
              {isLoggingOut ? 'Logging out...' : 'Logout & Go to Login'}
            </button>

            <button
              onClick={() => {
                toast.info('Contact your admin', {
                  description: 'Ask them to enable permissions from Employee Settings.',
                  duration: 4000,
                });
              }}
              className="w-full sm:w-auto h-11 px-7 rounded-xl text-[13px] font-medium transition-all duration-200 flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
              }}
            >
              <Mail size={15} />
              How to Get Access?
            </button>
          </div>

          {/* Countdown */}
          <div className="max-w-[300px] mx-auto">
            <div
              className="w-full h-1 rounded-full overflow-hidden mb-2"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${((20 - countdown) / 20) * 100}%`,
                  backgroundColor: '#ef4444',
                  opacity: 0.6,
                }}
              />
            </div>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
              Auto logout in{' '}
              <span className="font-semibold tabular-nums" style={{ color: 'rgba(239, 68, 68, 0.5)' }}>
                {countdown}s
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-5">
          <Lock size={11} style={{ color: 'rgba(255,255,255,0.1)' }} />
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.12)' }}>
            This action has been logged for security purposes
          </p>
        </div>
      </div>
    </div>
  );
}