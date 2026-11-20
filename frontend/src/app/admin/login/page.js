'use client';

import FallbackImage from "@/components/common/FallbackImage";
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '@/apis/axiosInstance';
import { getStoreAdminUrl, isPlatformHost } from '@/apis/storeHandoff';
import { useDispatch, useSelector } from 'react-redux';
import { storeApi } from '@/apis/admin/storeApi';
import { setStoreInfo } from '@/redux/slices/storeInfoSlice';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageProvider';
import AdminLanguageSwitcher from '@/components/adminComponents/AdminLanguageSwitcher';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowRight,
  Users,
  Package,
  ShoppingCart,
  Settings,
  ShieldCheck,
  CheckCircle2,
  ShoppingBag,
} from 'lucide-react';

// ==========================================
// VALIDATION HELPERS
// ==========================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (value, t) => {
  const email = value.trim();
  if (!email) return t('admin.login.emailRequired');
  if (!EMAIL_REGEX.test(email)) return t('admin.login.invalidEmail');
  return '';
};

const validatePassword = (value, t) => {
  if (!value) return t('admin.login.passwordRequired');
  return '';
};

const PANEL_FEATURES = [
  { icon: Users, title: 'admin.login.featureUsers', desc: 'admin.login.featureUsersDesc' },
  { icon: Package, title: 'admin.login.featureProducts', desc: 'admin.login.featureProductsDesc' },
  { icon: ShoppingCart, title: 'admin.login.featureOrders', desc: 'admin.login.featureOrdersDesc' },
  { icon: Settings, title: 'admin.login.featureSettings', desc: 'admin.login.featureSettingsDesc' },
];

const BRAND_ORANGE = '#f57224';
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

// Store logo ki img_url relative hoti hai (e.g. "uploads/xyz.png") — is liye API origin sath lagate hain
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, '');

// Platform (seller sign-in) vs store host (staff sign-in) — client par hi pata chalta hai.
// useSyncExternalStore: server snapshot = store host, hydration ke baad sahi value.
const subscribeNoop = () => () => {};
const usePlatformHost = () => useSyncExternalStore(subscribeNoop, isPlatformHost, () => false);

// Store logo: logo upload ho to white tile par image, warna orange mark + pehla letter
function StoreLogo({ alt, logoUrl, letter, sizeClass = 'h-10 w-10', letterClass = 'text-[17px]' }) {
  const [logoFailed, setLogoFailed] = useState(false);

  if (logoUrl && !logoFailed) {
    return (
      <span className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/10`}>
        <FallbackImage src={logoUrl} alt={alt || 'Store'} onError={() => setLogoFailed(true)} className="h-full w-full object-contain p-1" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-xl shadow-[0_8px_20px_-4px_rgba(245,114,36,0.55)]`}
      style={{ background: BRAND_ORANGE }}
    >
      <span className={`font-bold uppercase text-white ${letterClass}`}>{letter}</span>
    </span>
  );
}

// ClickMaster platform brand (signup page jaisa)
function PlatformMark({ dark = false, size = 'lg' }) {
  const big = size === 'lg';
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`flex items-center justify-center rounded-xl shadow-[0_8px_20px_-4px_rgba(245,114,36,0.55)] ${big ? 'h-11 w-11' : 'h-9 w-9'}`}
        style={{ background: BRAND_ORANGE }}
      >
        <ShoppingBag size={big ? 22 : 18} strokeWidth={2.25} className="text-white" />
      </span>
      <span className="text-start leading-tight">
        <span className={`block font-bold tracking-tight ${big ? 'text-[20px]' : 'text-[16px]'} ${dark ? 'text-white' : 'text-[var(--text-primary)]'}`}>ClickMaster</span>
        <span className={`block font-bold uppercase tracking-[0.22em] ${big ? 'text-[10px]' : 'text-[9px]'}`} style={{ color: BRAND_ORANGE }}>Marketplace</span>
      </span>
    </span>
  );
}

const inputClass = (hasError) =>
  `h-12 w-full rounded-xl border bg-[var(--bg-card)] ps-11 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-[border-color,box-shadow] ${
    hasError
      ? 'border-[var(--danger)] ring-4 ring-[var(--danger-soft)]'
      : 'border-[var(--border-card)] hover:border-slate-300 focus:border-[#f57224] focus:ring-4 focus:ring-[#f57224]/15'
  }`;

export default function AdminLoginPage() {
  const { t, dir, locale } = useTranslation();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const onPlatform = usePlatformHost();

  // ==========================================
  // STORE NAME / LOGO (Redux) — store host par usi store ki branding
  // ✅ Non-blocking: store fetch background mein chalta rahe, UI block na ho
  // ==========================================
  const storeName = useSelector((state) => state.storeInfo.storeName);
  const storeLogo = useSelector((state) => state.storeInfo.logo);
  const isStoreLoaded = useSelector((state) => state.storeInfo.isLoaded);

  const { data: storeData } = useQuery({
    queryKey: ['storeInfo'],
    queryFn: storeApi.getPublic,
    staleTime: 5 * 60 * 1000,
    enabled: !isStoreLoaded,
    throwOnError: false,
    retry: false,
  });

  useEffect(() => {
    if (storeData) dispatch(setStoreInfo(storeData));
  }, [storeData, dispatch]);

  const displayName = storeName || t('admin.login.defaultStoreName');
  const firstLetter = displayName.charAt(0).toUpperCase() || 'S';
  const logoUrl = storeLogo?.img_url
    ? storeLogo.img_url.startsWith('http')
      ? storeLogo.img_url
      : `${API_ORIGIN}/${storeLogo.img_url}`
    : null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await axiosInstance.post('/users/admin/login', userData);
      return response.data;
    },

    onSuccess: async (data) => {
      const role = String(data?.user?.role || '').toLowerCase();

      if (!data?.user || !['admin', 'staff', 'manager'].includes(role)) {
        axiosInstance.post('/users/logout').catch(() => {});
        toast.error(t('admin.login.accessDenied'));
        return;
      }

      toast.success(t('admin.login.success'), {
        duration: 2000,
        icon: <CheckCircle2 className="h-5 w-5" />,
      });

      queryClient.removeQueries();

      // Full page load — pichhle user ke socket connections band ho jate hain.
      // Multi-tenant: platform par login → seller ko uske store subdomain ke admin me bhejo
      if (isPlatformHost()) {
        const storeAdminUrl = await getStoreAdminUrl();
        if (!storeAdminUrl) {
          axiosInstance.post('/users/logout').catch(() => {});
          toast.error('No store is linked to this account.');
          return;
        }
        window.location.replace(storeAdminUrl);
        return;
      }
      window.location.replace('/admin/dashboard');
    },

    onError: (err) => {
      if (err.response?.data?.message) {
        toast.error(t('admin.login.invalidCredentials'));
        return;
      }
      if (!err.response) {
        toast.error(t('admin.login.serverUnavailable'));
        return;
      }
      toast.error(t('admin.login.loginFailed'));
    },
  });

  const isSubmitting = loginMutation.isPending;

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const errors = {
      email: validateEmail(email, t),
      password: validatePassword(password, t),
    };

    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    loginMutation.mutate({ email: email.trim(), password });
  };

  // Plain render helper (component nahi) — har render par remount na ho
  const renderBrand = (dark, size) =>
    onPlatform ? (
      <PlatformMark dark={dark} size={size} />
    ) : (
      <span className="flex min-w-0 items-center gap-3">
        <StoreLogo alt={displayName} logoUrl={logoUrl} letter={firstLetter} sizeClass={size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'} letterClass={size === 'lg' ? 'text-[19px]' : 'text-[16px]'} />
        <span className="min-w-0 text-start leading-tight">
          <span className={`block truncate font-bold tracking-tight ${size === 'lg' ? 'text-[19px]' : 'text-[15px]'} ${dark ? 'text-white' : 'text-[var(--text-primary)]'}`}>{displayName}</span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: BRAND_ORANGE }}>{t('admin.login.brand')}</span>
        </span>
      </span>
    );

  return (
    <div dir={dir} lang={locale} className="flex min-h-dvh w-full bg-[var(--bg-card)] lg:h-dvh">
      {/* ============ LEFT — BRAND PANEL (signup page jaisa navy) ============ */}
      <aside className="relative hidden h-full shrink-0 overflow-hidden bg-[#0b1430] text-white lg:flex lg:w-[44%] xl:w-[48%] 2xl:w-1/2">
        <div aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(155deg, #0d1834 0%, #0a1229 55%, #070d1f 100%)' }} />
        <div aria-hidden="true" className="absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(245,114,36,0.20) 0%, transparent 62%)' }} />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-[0.18]"
          style={{
            backgroundImage: 'url(/landing/fulfillment-hub.png)',
            maskImage: 'linear-gradient(to top left, black 0%, transparent 60%)',
            WebkitMaskImage: 'linear-gradient(to top left, black 0%, transparent 60%)',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'linear-gradient(to bottom, black 0%, transparent 85%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 85%)',
          }}
        />

        <div className="relative flex min-h-0 w-full flex-col px-10 py-10 xl:px-14 xl:py-12 [@media(max-height:700px)]:py-7">
          {renderBrand(true, "lg")}

          <div className="my-auto w-full max-w-[440px] py-8">
            <h1 className="text-[clamp(30px,2.6vw,40px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
              {t('admin.login.heroTitle')}
              <span className="block" style={{ color: '#ff9a4d' }}>{t('admin.login.heroConfidence')}</span>
            </h1>
            <p className="pt-4 text-[15px] leading-[1.65] text-slate-300">{t('admin.login.heroDescription')}</p>

            <ul className="mt-9 space-y-4 [@media(max-height:700px)]:mt-6 [@media(max-height:700px)]:space-y-3">
              {PANEL_FEATURES.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-center gap-3.5">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]" style={{ color: '#ff9a4d' }}>
                    <Icon size={17} />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold text-slate-100">{t(title)}</span>
                    <span className="block text-[12.5px] text-slate-400">{t(desc)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[12px] text-slate-500">© {new Date().getFullYear()} {onPlatform ? 'ClickMaster Marketplace' : displayName}</p>
        </div>
      </aside>

      {/* ============ RIGHT — FULL WHITE PANEL ============ */}
      <main className="flex min-w-0 flex-1 flex-col items-center bg-[var(--bg-card)] px-5 sm:px-10 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-gutter:stable_both-edges] xl:px-14">
        {/* Top bar — mobile par brand; language; platform par "Create seller account" */}
        <header className="flex w-full shrink-0 items-center justify-between gap-3 py-5 lg:justify-end">
          <span className="lg:hidden">{renderBrand(false, "sm")}</span>
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg border border-[var(--border-card)] px-1.5 py-0.5">
              <AdminLanguageSwitcher />
            </div>
            {onPlatform && (
              <p className="flex items-center gap-2.5 text-[13px] text-[var(--text-muted)]">
                <span className="hidden sm:inline">{t('admin.login.newSeller')}</span>
                <Link
                  href="/landing/signup"
                  className="inline-flex h-9 items-center whitespace-nowrap rounded-lg border border-[var(--border-card)] px-3 text-[13px] font-semibold sm:px-4 text-[var(--text-primary)] transition hover:border-slate-300 hover:bg-[var(--bg-secondary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f57224]/20"
                >
                  <span className="sm:hidden">{t('admin.login.signUp')}</span>
                  <span className="hidden sm:inline">{t('admin.login.createSellerAccount')}</span>
                </Link>
              </p>
            )}
          </div>
        </header>

        <div className="my-auto w-full max-w-[420px] shrink-0 py-6 2xl:max-w-[460px]">
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)] 2xl:text-[30px]">{t('admin.login.welcomeBack')}</h2>
          <p className="pt-1.5 text-[14px] text-[var(--text-muted)]">
            {onPlatform ? t('admin.login.sellerSubtitle') : t('admin.login.panelSubtitle')}
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="admin-email" className="mb-1.5 block text-[13px] font-semibold text-[var(--text-secondary)]">{t('admin.login.email')}</label>
              <div className="group relative">
                <Mail size={16} aria-hidden="true" className={`pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 transition-colors ${fieldErrors.email ? 'text-[var(--danger)]' : 'text-[var(--text-muted)] group-focus-within:text-[#f57224]'}`} />
                <input
                  id="admin-email"
                  type="text"
                  inputMode="email"
                  spellCheck={false}
                  value={email}
                  onChange={handleEmailChange}
                  placeholder={t('admin.login.emailPlaceholder')}
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'admin-email-error' : undefined}
                  suppressHydrationWarning
                  className={`${inputClass(fieldErrors.email)} pe-4`}
                />
              </div>
              {fieldErrors.email && (
                <p id="admin-email-error" role="alert" className="flex items-center gap-1.5 pt-1.5 text-[12.5px] font-medium text-[var(--danger-text)]">
                  <AlertCircle size={13} aria-hidden="true" />{fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label htmlFor="admin-password" className="block text-[13px] font-semibold text-[var(--text-secondary)]">{t('admin.login.password')}</label>
                <button type="button" onClick={() => toast.info(t('admin.login.resetHelp'))} className="text-[12.5px] font-semibold transition hover:underline" style={{ color: '#e2641b' }}>
                  {t('admin.login.forgotPassword')}
                </button>
              </div>
              <div className="group relative">
                <Lock size={16} aria-hidden="true" className={`pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 transition-colors ${fieldErrors.password ? 'text-[var(--danger)]' : 'text-[var(--text-muted)] group-focus-within:text-[#f57224]'}`} />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyUp={(e) => setCapsLockOn(e.getModifierState?.('CapsLock') || false)}
                  onBlur={() => setCapsLockOn(false)}
                  placeholder={t('admin.login.passwordPlaceholder')}
                  autoComplete="current-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'admin-password-error' : undefined}
                  className={`${inputClass(fieldErrors.password)} pe-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('admin.login.hidePassword') : t('admin.login.showPassword')}
                  className="absolute end-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f57224]/40"
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="admin-password-error" role="alert" className="flex items-center gap-1.5 pt-1.5 text-[12.5px] font-medium text-[var(--danger-text)]">
                  <AlertCircle size={13} aria-hidden="true" />{fieldErrors.password}
                </p>
              )}
              {capsLockOn && !fieldErrors.password && (
                <p className="flex items-center gap-1.5 pt-1.5 text-[12.5px] font-semibold text-amber-600">
                  <AlertCircle size={13} aria-hidden="true" />{t('admin.login.capsLock')}
                </p>
              )}
            </div>

            {/* Remember me */}
            <label className="flex cursor-pointer select-none items-center gap-2.5 text-[13px] font-medium text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 shrink-0 cursor-pointer rounded"
                style={{ accentColor: BRAND_ORANGE }}
              />
              {t('admin.login.rememberMe')}
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white shadow-[0_10px_24px_-8px_rgba(245,114,36,0.6)] transition hover:brightness-105 active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f57224]/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              style={{ background: BRAND_ORANGE }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                  {t('admin.login.signingIn')}
                </>
              ) : (
                <>
                  {t('admin.login.signIn')}
                  <ArrowRight size={17} className="rtl:rotate-180" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Bottom anchor — trust + help */}
        <footer className="flex w-full shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--border-card)] py-4 text-[12px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} aria-hidden="true" />
            {t('admin.login.secureFooter')}
          </span>
          {SUPPORT_EMAIL ? (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium transition hover:text-[var(--text-primary)]">
              {t('admin.login.contactSupport')}
            </a>
          ) : null}
        </footer>
      </main>
    </div>
  );
}
