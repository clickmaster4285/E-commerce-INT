'use client';

import FallbackImage from "@/components/common/FallbackImage";
import { useEffect, useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '@/apis/axiosInstance';
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
  LogIn,
  Loader2,
  ArrowRight,
  Users,
  Package,
  ShoppingCart,
  Settings,
  ShieldCheck,
  CheckCircle2,
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

// CHANGE THIS PATH TO YOUR DESIRED BACKGROUND IMAGE LATER
const LOGIN_BACKGROUND_IMAGE_SRC = '/images/admin-login-bg.jpg';

// Store logo ki img_url relative hoti hai (e.g. "uploads/xyz.png") — is liye API origin sath lagate hain
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, '');

// Store logo: same treatment jo Sidebar ke top par hai. Logo upload ho chuka ho
// to safe white card par wahi image (object-contain, koi crop nahi), warna store
// ke primary color ka gradient mark + naam ka pehla letter. Image load fail ho
// jaye to bhi gradient mark par fall back ho jata hai.
function StoreLogo({
  alt,
  logoUrl,
  letter,
  color,
  sizeClass = 'h-10 w-10',
  letterClass = 'text-[17px]',
  extraClass = '',
  ringClass = 'ring-white/15',
  shadowClass = 'shadow-sm',
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  if (logoUrl && !logoFailed) {
    return (
      <span
        className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/10 ${shadowClass} ${extraClass}`}
      >
        <FallbackImage
          src={logoUrl}
          alt={alt || 'Store'}
          onError={() => setLogoFailed(true)}
          className="h-full w-full object-contain p-1"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-xl ring-1 ${ringClass} ${shadowClass} ${extraClass}`}
      style={{
        backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${color} 82%, #ffffff), color-mix(in srgb, ${color} 72%, #000000))`,
      }}
    >
      <span
        className={`font-bold uppercase tracking-tight text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] ${letterClass}`}
      >
        {letter}
      </span>
    </span>
  );
}

export default function AdminLoginPage() {
  const { t, dir, locale } = useTranslation();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();

  // ==========================================
  // STORE NAME / LOGO (Redux)
  // ==========================================
  // Sidebar ke top par jo store name dikhta hai wo isi Redux slice se aata hai.
  // Login page par sidebar/socket nahi hota, is liye wahi public store endpoint
  // call kar ke usi slice mein daal dete hain - dono jagah same name/logo aata hai.
  // ✅ Non-blocking: store fetch background mein chalta rahe, UI block na ho
  const storeName = useSelector((state) => state.storeInfo.storeName);
  const storeLogo = useSelector((state) => state.storeInfo.logo);
  const isStoreLoaded = useSelector((state) => state.storeInfo.isLoaded);

  const { data: storeData } = useQuery({
    queryKey: ['storeInfo'],
    queryFn: storeApi.getPublic,
    staleTime: 5 * 60 * 1000,
    enabled: !isStoreLoaded,
    // ✅ Non-blocking: error throw na kare, background mein rehtay hain
    throwOnError: false,
    retry: false,
  });

  useEffect(() => {
    if (storeData) dispatch(setStoreInfo(storeData));
  }, [storeData, dispatch]);

  const displayName = storeName || t('admin.login.defaultStoreName');
  const displayColor = 'var(--accent)';
  const firstLetter = displayName.charAt(0).toUpperCase() || 'S';
  const logoUrl = storeLogo?.img_url
    ? storeLogo.img_url.startsWith('http')
      ? storeLogo.img_url
      : `${API_ORIGIN}/${storeLogo.img_url}`
    : null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    email: '',
    password: '',
  });
  const [rememberMe, setRememberMe] = useState(true);
  const [capsLockOn, setCapsLockOn] = useState(false);

  // ✅ Background image check removed - avoids unnecessary network probe on login load
  // The CSS fallback color (#0f172a) handles missing images gracefully

  const loginMutation = useMutation({
    mutationFn: async (userData) => {
      const response = await axiosInstance.post('/users/admin/login', userData);
      return response.data;
    },

    onSuccess: (data) => {
      const role = String(data?.user?.role || '').toLowerCase();

      if (!data?.user || !['admin', 'staff', 'manager'].includes(role)) {
        axiosInstance.post('/users/logout').catch(() => {});
        toast.error(
          t('admin.login.accessDenied')
        );
        return;
      }

      // ✅ Show success toast before redirect - professional UX
      toast.success(t('admin.login.success'), {
        duration: 2000,
        icon: <CheckCircle2 className="h-5 w-5" />,
      });

      queryClient.removeQueries();

      // Full page load - is se wo sab socket connections band ho jate hain jo
      // pichhle user ke cookie ke sath handshake hue the. Warna naye login
      // (jaise employee) ke baad bhi profile page / Navbar purane user ka data
      // dikhate rehte hain, kyunke socket ki identity handshake par fix ho jati hai.
      window.location.replace('/admin/dashboard');
    },

    onError: (err) => {
      if (err.response?.data?.message) {
        toast.error(t('admin.login.invalidCredentials'));
        return;
      }
      if (!err.response) {
        toast.error(
          t('admin.login.serverUnavailable')
        );
        return;
      }
      toast.error(t('admin.login.loginFailed'));
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
    if (isSubmitting) return;

    const errors = {
      email: validateEmail(email, t),
      password: validatePassword(password, t),
    };

    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    loginMutation.mutate({ email: email.trim(), password });
  };

  return (
    <div dir={dir} lang={locale} className="flex min-h-screen w-full">
      {/* ============ LEFT - BRAND PANEL WITH FULL BG IMAGE ============ */}
      <aside
        className="relative z-20 hidden shrink-0 flex-col overflow-hidden px-8 py-7 text-white lg:flex lg:w-[48%] xl:w-[52%] xl:px-14 xl:py-10"
        style={{
          background: locale === 'en'
            ? '#0f172a'
            : 'radial-gradient(circle at 82% 68%, rgba(59, 130, 246, 0.42), transparent 35%), linear-gradient(135deg, #020617, #172554 58%, #1e3a8a)',
        }}
      >
        {/* Background Image Layer - CSS fallback handles missing images */}
        <>
          <div
            className={`absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-500 ${locale === 'en' ? '' : 'hidden'}`}
            style={{ backgroundImage: `url(${LOGIN_BACKGROUND_IMAGE_SRC})` }}
          />
          {/* Keep the dashboard artwork bright while preserving text contrast. */}
          <div className="absolute inset-0 z-0 bg-slate-950/10" />
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950/45 via-transparent to-slate-950/10" />
        </>

        {/* Content Wrapper */}
        <div className="relative z-10 flex h-full flex-col justify-between">
          {/* Top Section: Logo, Text, Features */}
          <div className="space-y-8">
            {/* Brand Logo - store name/logo Redux (storeInfo slice) se */}
            <div className="flex items-center gap-3.5">
              <StoreLogo
                alt={displayName}
                logoUrl={logoUrl}
                letter={firstLetter}
                color={displayColor}
                sizeClass="h-12 w-12"
                letterClass="text-[20px]"
                ringClass="ring-white/25"
                shadowClass="shadow-xl shadow-black/30"
              />
              <div className="min-w-0">
                <p className="truncate text-[18px] font-semibold tracking-tight text-white/95">
                  {displayName}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-blue-200/90">
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                  {t('admin.login.brand')}
                </p>
              </div>
            </div>

            {/* Hero Text */}
            <div className="max-w-[440px]">
              <h1 className="text-[29px] font-semibold leading-[1.2] tracking-tight text-white/95 xl:text-[34px]">
                {t('admin.login.heroTitle')}<br />{t('admin.login.heroConfidence')}
              </h1>
              <p className="mt-3 text-[12.5px] leading-[1.6] text-indigo-100/75">
                {t('admin.login.heroDescription')}
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-3">
              {PANEL_FEATURES.map((feature) => {
                const FeatureIcon = feature.icon;
                return (
                  <div key={feature.title} className="flex items-center gap-3.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg backdrop-blur-md"
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                    >
                      <FeatureIcon size={14} className="text-blue-300" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-[11px] font-medium text-white/95">{t(feature.title)}</span>
                      <span className="block text-[9px] text-indigo-200/60">{t(feature.desc)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* ============ RIGHT - LOGIN FORM PANEL ============ */}
      <main className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[var(--bg-primary)] px-6 py-10">
        {/* Soft decorative blobs */}
        <div aria-hidden="true" className="pointer-events-none absolute -end-28 -top-28 h-96 w-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(37, 99, 235, 0.10), transparent 65%)' }} />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -start-24 h-80 w-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(37, 99, 235, 0.06), transparent 65%)' }} />

        {/* Admin portal context */}
        <div className="absolute end-5 top-5 z-30 flex items-center gap-2 md:end-7 md:top-6">
          <div className="rounded-full border border-[var(--border-color)] bg-[var(--bg-card)]/90 px-2 py-1 shadow-sm backdrop-blur-sm">
            <AdminLanguageSwitcher />
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)]/90 px-3.5 py-2 text-[12px] font-medium text-[var(--text-secondary)] shadow-sm backdrop-blur-sm md:flex">
            <ShieldCheck size={15} className="text-[var(--accent)]" aria-hidden="true" />
            {t('admin.login.portal')}
          </div>
        </div>

        <div className="relative w-full max-w-[360px]">
          {/* Brand */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2.5">
              <StoreLogo
                alt={displayName}
                logoUrl={logoUrl}
                letter={firstLetter}
                color={displayColor}
                ringClass="ring-black/10"
              />
              <span className="text-start">
                <span className="block text-[19px] font-semibold leading-tight tracking-tight text-[var(--text-secondary)]">
                  {displayName}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                  {t('admin.login.brand')}
                </span>
              </span>
            </div>

            <h2 className="mt-7 text-[26px] font-medium tracking-tight text-[var(--text-secondary)]">{t('admin.login.welcomeBack')}</h2>
            <p className="mt-1.5 text-[13.5px] text-[var(--text-muted)]">{t('admin.login.panelSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-3.5">
            {/* Email Input */}
            <div>
              <div className={`flex items-start gap-3 rounded-xl border bg-[var(--bg-card)] px-3.5 py-2.5 transition-all ${fieldErrors.email ? 'border-[var(--danger)] ring-2 ring-[var(--danger-soft)]' : 'border-[var(--border-card)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]'}`}>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  <Mail size={15} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <label htmlFor="admin-email" className="block cursor-text text-[12px] font-medium text-[var(--text-secondary)]">{t('admin.login.email')}</label>
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
                    className="w-full bg-transparent pt-0.5 text-[13px] font-normal text-[var(--text-secondary)] placeholder:font-normal placeholder:text-[var(--text-muted)] focus:outline-none"
                  />
                </span>
              </div>
              {fieldErrors.email && <p role="alert" className="mt-1.5 text-xs font-medium text-[var(--danger-text)]">{fieldErrors.email}</p>}
            </div>

            {/* Password Input */}
            <div>
              <div className={`flex items-start gap-3 rounded-xl border bg-[var(--bg-card)] px-3.5 py-2.5 transition-all ${fieldErrors.password ? 'border-[var(--danger)] ring-2 ring-[var(--danger-soft)]' : 'border-[var(--border-card)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]'}`}>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  <Lock size={15} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <label htmlFor="admin-password" className="block cursor-text text-[12px] font-medium text-[var(--text-secondary)]">{t('admin.login.password')}</label>
                  <span className="relative block">
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
                      className="w-full bg-transparent pt-0.5 pe-8 text-[13px] font-normal text-[var(--text-secondary)] placeholder:font-normal placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t('admin.login.hidePassword') : t('admin.login.showPassword')}
                      className="absolute end-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] focus-visible:outline-none"
                    >
                      {showPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                    </button>
                  </span>
                </span>
              </div>
              {fieldErrors.password && <p role="alert" className="mt-1.5 text-xs font-medium text-[var(--danger-text)]">{fieldErrors.password}</p>}
              {capsLockOn && !fieldErrors.password && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-[var(--warning, #f59e0b)]">
                  <AlertCircle size={12} aria-hidden="true" />
                  {t('admin.login.capsLock')}
                </p>
              )}
            </div>

            {/* Remember Me / Forgot Password */}
            <div dir={dir} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-0.5 text-[12.5px]">
              <label className="flex min-w-0 cursor-pointer select-none items-center gap-2 text-start font-medium text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 shrink-0 cursor-pointer rounded border-[var(--border-card)] accent-[var(--accent)]"
                />
                {t('admin.login.rememberMe')}
              </label>
              <button type="button" className="font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)] hover:underline" onClick={() => toast.info(t('admin.login.resetHelp'))}>
                {t('admin.login.forgotPassword')}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-medium text-[var(--accent-text)] transition-all hover:opacity-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--info))', boxShadow: '0 10px 24px rgba(37, 99, 235, 0.30)' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  {t('admin.login.signingIn')}
                </>
              ) : (
                <>
                  <LogIn size={15} aria-hidden="true" />
                  {t('admin.login.signIn')}
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Secure Footer */}
          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] font-normal text-[var(--text-muted)]">
            <Lock size={11} aria-hidden="true" />
            {t('admin.login.secureFooter')}
          </p>
        </div>
      </main>
    </div>
  );
}
