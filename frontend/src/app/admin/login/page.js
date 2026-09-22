'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '@/apis/axiosInstance';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  Users,
  Package,
  ShoppingCart,
  Settings,
  Globe,
  ChevronDown,
  LayoutDashboard,
  LayoutGrid,
  ClipboardList,
  UserCog,
} from 'lucide-react';

// ==========================================
// VALIDATION HELPERS (unchanged)
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

const PANEL_FEATURES = [
  { icon: Users, title: 'User Management', desc: 'Admins, Staff & Customers' },
  { icon: Package, title: 'Product Management', desc: 'Products, Variants & Inventory' },
  { icon: ShoppingCart, title: 'Order Management', desc: 'Track & Manage Orders' },
  { icon: Settings, title: 'Store Settings', desc: 'Configure Your Store' },
];

const MOCKUP_MENU = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Products', icon: Package },
  { label: 'Categories', icon: LayoutGrid },
  { label: 'Orders', icon: ClipboardList },
  { label: 'Customers', icon: Users },
  { label: 'Users', icon: UserCog },
  { label: 'Settings', icon: Settings },
];

const MOCKUP_STATS = [
  { icon: Package, label: 'Total Products', value: '248', chip: 'var(--accent)' },
  { icon: ClipboardList, label: 'Total Orders', value: '1,248', chip: 'var(--teal)' },
  { icon: Users, label: 'Active Customers', value: '892', chip: 'var(--success)' },
];

const MOCKUP_ORDERS = [
  ['#ORD-101', '$129.99', 'Pending'],
  ['#ORD-102', '$89.50', 'Complete'],
  ['#ORD-103', '$245.00', 'Pending'],
  ['#ORD-104', '$56.25', 'Complete'],
];

// Add the reference artwork at frontend/public/images/admin-login-left.png.
const LOGIN_PANEL_IMAGE_SRC = '/images/admin-login-left.png';

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
  const [hasPanelImage, setHasPanelImage] = useState(true);

  const loginMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await axiosInstance.post(
        '/users/admin/login',
        userData
      );

      return response.data;
    },

    onSuccess: (data) => {
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
    <div className="flex min-h-screen w-full">
      {/* ============ LEFT — BRAND PANEL (sidebar-matched tokens) ============ */}
      <aside
        className="relative z-20 hidden shrink-0 flex-col overflow-hidden px-8 py-7 text-white lg:flex lg:w-[48%] xl:w-[52%] xl:px-14 xl:py-10"
        style={{
          background:
            'radial-gradient(62% 54% at 82% 42%, color-mix(in srgb, var(--accent) 38%, transparent), transparent 65%), linear-gradient(148deg, var(--bg-sidebar) 0%, color-mix(in srgb, var(--bg-sidebar) 82%, var(--accent)) 100%)',
        }}
      >
        {/* Clipped decorative layer (plant silhouette) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <svg
            viewBox="0 0 220 330"
            className="absolute bottom-0 left-0 h-[240px]"
            fill="none"
          >
            <path
              d="M104 272 C102 196 82 146 48 114 C90 128 112 174 114 230 C118 182 108 130 80 86 C120 112 134 166 130 224 Z"
              style={{
                fill: 'color-mix(in srgb, var(--accent) 24%, var(--bg-sidebar))',
              }}
            />
            <path
              d="M136 272 C136 190 144 126 176 70 C186 126 172 190 154 244 Z"
              style={{
                fill: 'color-mix(in srgb, var(--accent) 14%, var(--bg-sidebar))',
              }}
            />
            <path
              d="M64 272 C70 212 66 170 38 136 C72 144 94 186 96 242 Z"
              style={{
                fill: 'color-mix(in srgb, var(--accent) 14%, var(--bg-sidebar))',
              }}
            />
            <rect
              x="56"
              y="264"
              width="116"
              height="16"
              rx="7"
              style={{
                fill: 'color-mix(in srgb, var(--accent) 10%, var(--bg-sidebar))',
              }}
            />
            <path
              d="M62 280 H166 L154 318 C152 324 147 328 141 328 H87 C81 328 76 324 74 318 Z"
              style={{
                fill: 'color-mix(in srgb, var(--bg-sidebar) 55%, #000000)',
              }}
            />
          </svg>
        </div>

        {/* Brand */}
        <div className="relative flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, var(--info), var(--accent))',
              boxShadow: '0 10px 24px rgba(37, 99, 235, 0.35)',
            }}
          >
            <ShoppingCart size={22} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[17px] font-bold tracking-tight text-[var(--text-inverse)]">
              Ecom
              <span
                style={{
                  color: 'color-mix(in srgb, var(--accent) 45%, #ffffff)',
                }}
              >
                Admin
              </span>
            </p>
            <p className="text-[10px] text-indigo-200/75">
              E-commerce Admin Panel
            </p>
          </div>
        </div>

        {/* Hero */}
        <div className="relative mt-9 max-w-[440px]">
          <h1 className="text-[29px] font-extrabold leading-[1.16] tracking-tight text-white xl:text-[34px]">
            Manage Your Store
            <br />
            with{' '}
            <span
              style={{
                  color: 'color-mix(in srgb, var(--accent) 45%, #ffffff)',
              }}
            >
              Confidence
            </span>
          </h1>
          <p className="mt-3 text-[12.5px] leading-[1.55] text-indigo-100/70">
            Control your products, categories, orders, users and more — all in
            one powerful admin panel.
          </p>
        </div>

        {/* Feature list */}
        <div className="relative mt-6 space-y-2">
          {PANEL_FEATURES.map((feature) => {
            const FeatureIcon = feature.icon;

            return (
              <div key={feature.title} className="flex items-center gap-3.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: 'color-mix(in srgb, var(--accent) 20%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                  }}
                >
                  <FeatureIcon size={14} aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[11px] font-semibold text-white">
                    {feature.title}
                  </span>
                  <span className="block text-[9px] text-indigo-100/65">
                    {feature.desc}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Dashboard mockup — decorative illustration (flat, reference style) */}
        <div
          aria-hidden="true"
          className={`relative z-10 -mb-3 mt-auto pl-10 ${hasPanelImage ? 'flex' : 'hidden xl:flex'}`}
        >
          {hasPanelImage && (
            <img
              src={LOGIN_PANEL_IMAGE_SRC}
              alt="EcomAdmin dashboard preview"
              className="h-auto max-h-[330px] w-[510px] object-contain object-left-bottom"
              onError={() => setHasPanelImage(false)}
            />
          )}
          {!hasPanelImage && (
            <div
              className="flex w-full max-w-[720px] gap-2 rounded-2xl p-2"
              style={{
                background:
                  'color-mix(in srgb, var(--bg-sidebar) 72%, #000000)',
                border:
                  '1px solid color-mix(in srgb, var(--text-inverse) 10%, transparent)',
                boxShadow:
                  '0 24px 48px rgba(2, 6, 23, 0.45), 0 6px 16px rgba(2, 6, 23, 0.35)',
              }}
            >
              {/* Mini sidebar */}
              <div
                className="w-36 shrink-0 rounded-xl p-3"
                style={{
                  background:
                    'color-mix(in srgb, var(--bg-sidebar) 90%, var(--accent))',
                }}
              >
                <div className="mb-3 flex items-center gap-1.5 px-1">
                  <span
                    className="flex h-[18px] w-[18px] items-center justify-center rounded-md"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--info), var(--accent))',
                    }}
                  >
                    <ShoppingCart size={10} strokeWidth={2.5} />
                  </span>
                  <span className="text-[10px] font-bold text-[var(--text-sidebar)]">
                    EcomAdmin
                  </span>
                </div>
                <nav className="space-y-1">
                  {MOCKUP_MENU.map((item) => {
                    const ItemIcon = item.icon;

                    return (
                      <div
                        key={item.label}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-[7px] text-[10px] font-medium"
                        style={
                          item.active
                            ? {
                                background: 'var(--bg-sidebar-active)',
                                color: 'var(--text-inverse)',
                              }
                            : { color: 'var(--text-sidebar-muted)' }
                        }
                      >
                        <ItemIcon size={11} />
                        {item.label}
                      </div>
                    );
                  })}
                </nav>
              </div>

              {/* Mini content — fixed light illustration */}
              <div className="min-w-0 flex-1 rounded-xl bg-white p-3.5 text-slate-800">
                {/* Top bar: search + admin chip */}
                <div className="flex items-center justify-between">
                  <span className="flex w-[46%] items-center gap-1.5 rounded-full bg-slate-100/80 px-2 py-[3px]">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="2.5"
                      className="h-[7px] w-[7px]"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.2-3.2" strokeLinecap="round" />
                    </svg>
                    <span className="text-[6.5px] font-medium text-slate-400">
                      Search
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="flex h-[10px] w-[10px] items-center justify-center rounded-full text-[5px] font-bold text-white"
                      style={{ background: 'var(--accent)' }}
                    >
                      A
                    </span>
                    <span className="text-[6.5px] font-semibold text-slate-600">
                      Admin
                    </span>
                    <ChevronDown size={6} className="text-slate-400" />
                  </span>
                </div>

                <p className="mt-2 text-[8.5px] font-medium text-slate-400">
                  Good Morning,
                </p>
                <p className="text-[14px] font-bold text-slate-900">Admin</p>

                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {MOCKUP_STATS.map((stat) => {
                    const StatIcon = stat.icon;

                    return (
                      <div
                        key={stat.label}
                        className="rounded-lg border border-slate-100 bg-white p-2 shadow-sm"
                      >
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-md"
                          style={{ background: stat.chip }}
                        >
                          <StatIcon size={10} className="text-white" />
                        </span>
                        <p className="mt-1.5 text-[7.5px] font-medium text-slate-400">
                          {stat.label}
                        </p>
                        <p className="text-[13px] font-extrabold text-slate-900">
                          {stat.value}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2 grid grid-cols-[1.35fr_1fr] gap-2">
                  <div className="rounded-lg border border-slate-100 p-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-[8.5px] font-bold text-slate-700">
                        Sales Overview
                      </p>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[6.5px] font-semibold"
                        style={{
                          background: 'var(--accent-soft)',
                          color: 'var(--accent)',
                        }}
                      >
                        This Month
                      </span>
                    </div>
                    <svg
                      viewBox="0 0 300 80"
                      preserveAspectRatio="none"
                      className="mt-1 h-[56px] w-full"
                    >
                      <path
                        d="M0 62 C25 55 40 40 60 43 C85 47 95 26 120 28 C145 30 155 49 180 45 C205 41 215 17 240 15 C262 13 280 27 300 21 L300 80 L0 80 Z"
                        fill="rgba(37, 99, 235, 0.14)"
                      />
                      <path
                        d="M0 62 C25 55 40 40 60 43 C85 47 95 26 120 28 C145 30 155 49 180 45 C205 41 215 17 240 15 C262 13 280 27 300 21"
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle
                        cx="240"
                        cy="15"
                        r="3.5"
                        fill="var(--accent)"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>

                  <div className="rounded-lg border border-slate-100 p-2.5 shadow-sm">
                    <p className="text-[8.5px] font-bold text-slate-700">
                      Recent Orders
                    </p>
                    <div className="mt-2 space-y-[8px]">
                      {MOCKUP_ORDERS.map(([id, amount, status]) => (
                        <div
                          key={id}
                          className="flex items-center justify-between"
                        >
                          <span className="text-[7.5px] font-semibold text-slate-500">
                            {id}
                          </span>
                          <span className="text-[7.5px] font-bold text-slate-800">
                            {amount}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-[1px] text-[6px] font-bold ${
                              status === 'Pending'
                                ? 'bg-[var(--warning-soft)] text-[var(--warning-text)]'
                                : 'bg-[var(--success-soft)] text-[var(--success-text)]'
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Secure badge */}
        <div
          className="absolute bottom-8 left-10 z-20 hidden items-center gap-2.5 rounded-xl px-3.5 py-2.5 xl:flex"
          style={{
            background: 'var(--bg-sidebar-hover)',
            border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
            boxShadow: '0 18px 40px rgba(2, 6, 23, 0.5)',
          }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              background: 'linear-gradient(135deg, var(--info), var(--accent))',
            }}
          >
            <ShieldCheck size={13} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[11px] font-bold text-[var(--text-inverse)]">
              Secure &amp; Reliable
            </span>
            <span className="block text-[9px] text-[var(--text-sidebar-muted)]">
              Your data is always protected
            </span>
          </span>
        </div>
      </aside>

      {/* ============ RIGHT — LOGIN FORM PANEL (theme tokens) ============ */}
      <main className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[var(--bg-primary)] px-6 py-10">
        {/* Soft decorative blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(37, 99, 235, 0.10), transparent 65%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(37, 99, 235, 0.06), transparent 65%)',
          }}
        />

        {/* Language pill (decorative) */}
        <div
          aria-hidden="true"
          className="absolute right-7 top-6 hidden select-none items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-[12.5px] font-semibold text-[var(--text-secondary)] md:flex"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <Globe size={13} className="text-[var(--text-muted)]" />
          English
          <ChevronDown size={13} className="text-[var(--text-muted)]" />
        </div>

        <div className="relative w-full max-w-[360px]">
          {/* Brand */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: 'var(--accent-soft)' }}
              >
                <ShoppingCart
                  size={20}
                  strokeWidth={2.5}
                  style={{ color: 'var(--accent)' }}
                  aria-hidden="true"
                />
              </span>
              <span className="text-left">
                <span className="block text-[19px] font-extrabold leading-tight tracking-tight">
                  <span style={{ color: 'var(--accent-hover)' }}>Ecom</span>
                  <span style={{ color: 'var(--info)' }}>Admin</span>
                </span>
                <span className="block text-[10.5px] font-medium text-[var(--text-muted)]">
                  E-commerce Admin Panel
                </span>
              </span>
            </div>

            <h2 className="mt-7 text-[26px] font-extrabold tracking-tight text-[var(--text-primary)]">
              Welcome Back
            </h2>
            <p className="mt-1.5 text-[13.5px] text-[var(--text-muted)]">
              Sign in to your admin account
            </p>
          </div>

          {/* API / access error banner */}
          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] font-medium"
              style={{
                background: 'var(--danger-soft)',
                borderColor:
                  'color-mix(in srgb, var(--danger) 30%, transparent)',
                color: 'var(--danger-text)',
              }}
            >
              <AlertCircle
                size={16}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-6 space-y-3.5"
          >
            {/* Email */}
            <div>
              <div
                className={`flex items-start gap-3 rounded-xl border bg-[var(--bg-card)] px-3.5 py-2.5 transition-all ${
                  fieldErrors.email
                    ? 'border-[var(--danger)] ring-2 ring-[var(--danger-soft)]'
                    : 'border-[var(--border-card)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]'
                }`}
              >
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                  }}
                >
                  <Mail size={15} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <label
                    htmlFor="admin-email"
                    className="block cursor-text text-[12px] font-bold text-[var(--text-primary)]"
                  >
                    Email Address
                  </label>
                  <input
                    id="admin-email"
                    type="text"
                    inputMode="email"
                    spellCheck={false}
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="Enter your email"
                    autoComplete="off"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={
                      fieldErrors.email ? 'admin-email-error' : undefined
                    }
                    className="w-full bg-transparent pt-0.5 text-[13px] font-medium text-[var(--text-primary)] placeholder:font-normal placeholder:text-[var(--text-muted)] focus:outline-none"
                  />
                </span>
              </div>
              {fieldErrors.email && (
                <p
                  id="admin-email-error"
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-[var(--danger-text)]"
                >
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div
                className={`flex items-start gap-3 rounded-xl border bg-[var(--bg-card)] px-3.5 py-2.5 transition-all ${
                  fieldErrors.password
                    ? 'border-[var(--danger)] ring-2 ring-[var(--danger-soft)]'
                    : 'border-[var(--border-card)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]'
                }`}
              >
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                  }}
                >
                  <Lock size={15} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <label
                    htmlFor="admin-password"
                    className="block cursor-text text-[12px] font-bold text-[var(--text-primary)]"
                  >
                    Password
                  </label>
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="Enter your password"
                    autoComplete="new-password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={
                      fieldErrors.password ? 'admin-password-error' : undefined
                    }
                    className="w-full bg-transparent pt-0.5 pr-7 text-[13px] font-medium text-[var(--text-primary)] placeholder:font-normal placeholder:text-[var(--text-muted)] focus:outline-none"
                  />
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                  aria-pressed={showPassword}
                  className="-ml-7 mt-4 h-6 w-6 shrink-0 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]"
                >
                  {showPassword ? (
                    <EyeOff size={15} className="mx-auto" aria-hidden="true" />
                  ) : (
                    <Eye size={15} className="mx-auto" aria-hidden="true" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p
                  id="admin-password-error"
                  role="alert"
                  className="mt-1.5 text-xs font-medium text-[var(--danger-text)]"
                >
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Remember me / Forgot password */}
            <div className="flex items-center justify-between pt-0.5 text-[12.5px]">
              <label className="flex cursor-pointer select-none items-center gap-2 font-medium text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 cursor-pointer rounded border-[var(--border-card)] accent-[var(--accent)]"
                />
                Remember me
              </label>
              <button
                type="button"
                className="font-semibold text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)] hover:underline"
                onClick={() =>
                  setError(
                    'Please contact your store administrator to reset your password.'
                  )
                }
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-[var(--accent-text)] transition-all hover:opacity-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background:
                  'linear-gradient(135deg, var(--accent), var(--info))',
                boxShadow: '0 10px 24px rgba(37, 99, 235, 0.30)',
              }}
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
                <>
                  <RefreshCw size={15} aria-hidden="true" />
                  Sign In
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Secure footer */}
          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-[var(--text-muted)]">
            <Lock size={11} aria-hidden="true" />
            Secure login · Your data is protected
          </p>
        </div>
      </main>
    </div>
  );
}
