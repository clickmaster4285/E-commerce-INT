'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '@/apis/axiosInstance';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// ==========================================
// VALIDATION HELPERS
// ==========================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (value) => {
  const email = value.trim();

  if (!email) return 'Email address is required.';
  if (!EMAIL_REGEX.test(email)) return 'Enter a valid email address.';

  return '';
};

const validatePassword = (value) => {
  if (!value) return 'Password is required.';

  return '';
};

export default function AdminLoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await axiosInstance.post(
        '/users/admin/login',
        userData
      );

      return response.data;
    },

    onSuccess: (data) => {
      /*
       * IMPORTANT
       * Backend (/users/admin/login) already rejects non-admin
       * roles BEFORE issuing cookies — this is only a safety net
       * for an unexpected response shape. Guarded so it can never
       * throw and silently swallow the redirect.
       */
      const role = String(data?.user?.role || '').toLowerCase();

      if (
        !data?.user ||
        !['admin', 'staff', 'manager'].includes(role)
      ) {
        axiosInstance.post('/users/logout').catch(() => {});
        setError(
          'Access denied. Only administrators, managers and staff members can log in.'
        );
        return;
      }

      /*
       * Fresh session — drop any cached queries from a previous
       * account so the dashboard fetches everything for the user
       * who just logged in.
       */
      queryClient.removeQueries();

      router.replace('/admin/dashboard');
    },

    onError: (err) => {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
        return;
      }

      if (!err.response) {
        setError(
          'Unable to reach the server. Please check your connection and try again.'
        );
        return;
      }

      setError('Login failed. Please try again.');
    },
  });

  const isSubmitting = loginMutation.isPending;

  const handleEmailChange = (e) => {
    setEmail(e.target.value);

    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: '' }));
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);

    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (isSubmitting) return;

    const errors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };

    setFieldErrors(errors);

    if (errors.email || errors.password) return;

    setError('');
    loginMutation.mutate({ email: email.trim(), password });
  };

  return (
    <div className="flex min-h-screen w-full bg-[var(--bg-secondary)]">
      {/* ================= LEFT — BRAND PANEL ================= */}

      <aside className="hidden shrink-0 flex-col justify-between border-r border-[var(--border-color)] bg-[var(--bg-primary)] p-12 lg:flex lg:w-[44%] xl:w-1/2">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]">
            <span className="text-lg font-bold text-white">C</span>
          </div>

          <span className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            ClickMaster
          </span>
        </div>

        {/* Hero */}
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="max-w-md text-[34px] font-bold leading-[1.15] tracking-tight text-[var(--text-primary)] xl:text-[42px]">
            Admin Control
            <br />
            <span className="text-[var(--accent)]">Panel</span>
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--text-muted)]">
            Inventory · Brands · Categories · Products · Analytics.
            <span className="mt-2 block text-[var(--text-secondary)]">
              Manage everything from one secure workspace.
            </span>
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-[var(--text-muted)]">
          © 2026 ClickMaster Admin
        </p>
      </aside>

      {/* ================= RIGHT — LOGIN FORM ================= */}

      <main className="flex flex-1 items-center justify-center p-4 py-8 sm:p-8">
        <div className="w-full max-w-[400px]">

          {/* Mobile brand */}
          <div className="mb-6 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]">
              <span className="text-sm font-bold text-white">C</span>
            </div>

            <span className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
              ClickMaster
            </span>
          </div>

          {/* Card */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-sm sm:p-8">
            {/* Header */}
            <div className="mb-6">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1">
                <ShieldCheck
                  size={13}
                  className="text-[var(--accent)]"
                  aria-hidden="true"
                />

                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Admin Panel
                </span>
              </div>

              <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                Welcome back
              </h2>

              <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                Sign in to your admin account.
              </p>
            </div>

            {/* Global error */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] px-3.5 py-2.5"
              >
                <AlertCircle
                  size={15}
                  className="mt-0.5 shrink-0 text-[var(--danger)]"
                  aria-hidden="true"
                />

                <p className="text-[13px] leading-snug text-[var(--danger)]">
                  {error}
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-5">

              {/* Email */}
              <div>
                <label
                  htmlFor="admin-email"
                  className="mb-1.5 block text-[13px] font-medium text-[var(--text-secondary)]"
                >
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                    aria-hidden="true"
                  />

                  <input
                    id="admin-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    autoComplete="email"
                    placeholder="you@company.com"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={
                      fieldErrors.email ? 'admin-email-error' : undefined
                    }
                    className={`h-11 w-full rounded-lg border bg-[var(--bg-input)] pl-10 pr-3.5 text-[16px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[var(--accent-soft)] ${
                      fieldErrors.email
                        ? 'border-[var(--danger)]'
                        : 'border-[var(--border-color)]'
                    }`}
                  />
                </div>

                {fieldErrors.email && (
                  <p
                    id="admin-email-error"
                    role="alert"
                    className="mt-1.5 text-xs text-[var(--danger)]"
                  >
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="admin-password"
                  className="mb-1.5 block text-[13px] font-medium text-[var(--text-secondary)]"
                >
                  Password
                </label>

                <div className="relative">
                  <Lock
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                    aria-hidden="true"
                  />

                  <input
                    id="admin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={
                      fieldErrors.password
                        ? 'admin-password-error'
                        : undefined
                    }
                    className={`h-11 w-full rounded-lg border bg-[var(--bg-input)] pl-10 pr-11 text-[16px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[var(--accent-soft)] ${
                      fieldErrors.password
                        ? 'border-[var(--danger)]'
                        : 'border-[var(--border-color)]'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((prev) => !prev)
                    }
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                    aria-pressed={showPassword}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]"
                  >
                    {showPassword ? (
                      <EyeOff size={16} aria-hidden="true" />
                    ) : (
                      <Eye size={16} aria-hidden="true" />
                    )}
                  </button>
                </div>

                {fieldErrors.password && (
                  <p
                    id="admin-password-error"
                    role="alert"
                    className="mt-1.5 text-xs text-[var(--danger)]"
                  >
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] text-sm font-semibold text-[var(--accent-text)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

            </form>

            {/* User login link */}
            <p className="mt-6 border-t border-[var(--border-color)] pt-4 text-center text-[13px] text-[var(--text-muted)]">
              Regular customer?{' '}
              <Link
                href="/login"
                className="font-medium text-[var(--accent)] hover:underline"
              >
                User Login
              </Link>
            </p>

          </div>

          {/* Mobile footer */}
          <p className="mt-5 text-center text-xs text-[var(--text-muted)] lg:hidden">
            © 2026 ClickMaster Admin
          </p>

        </div>
      </main>
    </div>
  );
}
