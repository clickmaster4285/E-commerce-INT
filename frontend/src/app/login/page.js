"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { GoogleLogin } from "@react-oauth/google";
import {
  Mail, Lock, LogIn, Loader2, User, Phone, ShieldCheck,
  Truck, RotateCcw, Sparkles,
} from "lucide-react";
import axiosInstance from "@/apis/axiosInstance";
import { storeApi } from "@/apis/user/storeApi";
import { categoryApi } from "@/apis/user/categoryApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

// ✅ Store Logo
function StoreLogo({ store, sizeClass = "w-10 h-10" }) {
  const logoUrl = store?.logo?.img_url
    ? store.logo.img_url.startsWith("http")
      ? store.logo.img_url
      : `${API_ORIGIN}/${store.logo.img_url}`
    : null;
  const letter = (store?.store_name || "C").charAt(0).toUpperCase();

  if (!logoUrl) {
    return (
      <div className={`${sizeClass} rounded-lg bg-[var(--user-accent)] flex items-center justify-center shrink-0`}>
        <span className="text-[var(--user-accent-text)] font-black text-lg lg:text-xl">{letter}</span>
      </div>
    );
  }
  return <img src={logoUrl} alt={store?.store_name || "Store"} className={`${sizeClass} rounded-lg object-cover shrink-0`} />;
}

export default function UserLoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const { data: store = null } = useQuery({
    queryKey: ["storeInfo"],
    queryFn: storeApi.getPublic,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const storeName = store?.store_name || "ClickMasters";
  const tagline = store?.tagline || "Mobiles · Laptops · Watches · Accessories — shop everything from one trusted store.";
  const topCategories = categories.slice(0, 3);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isLogin ? "/users/login" : "/users/register";
      const payload = isLogin ? { email, password } : { name, username, phone, email, password };
      await axiosInstance.post(endpoint, payload);
      window.location.href = "/";
    } catch (err) {
      setError(err.response?.data?.message || `${isLogin ? "Login" : "Registration"} failed.`);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (credential) => {
    setError("");
    setLoading(true);
    try {
      await axiosInstance.post("/users/google-login", { credential });
      window.location.href = "/";
    } catch (err) {
      setError(err.response?.data?.message || "Google login failed.");
      setLoading(false);
    }
  };

  const inputCls =
    "w-full h-12 rounded-xl bg-[var(--user-bg-input)] border border-[var(--user-border)] pl-11 pr-4 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15 transition";

  return (
    <main className="user-theme h-screen flex bg-[var(--user-bg)] overflow-y-auto lg:overflow-hidden">
      {/* ═══════════ LEFT — BRANDING (Desktop) ═══════════ */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 xl:p-14 bg-[var(--user-bg-elevated)] relative overflow-hidden border-r border-[var(--user-border)] shrink-0">
        {/* Glows */}
        <div className="absolute top-[-140px] left-[-140px] w-[420px] h-[420px] rounded-full bg-[var(--user-accent)]/6 blur-3xl" />
        <div className="absolute bottom-[-140px] right-[-140px] w-[420px] h-[420px] rounded-full bg-[var(--user-accent)]/6 blur-3xl" />

        {/* Top: Logo */}
              {/* Top: Logo */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-3 relative cursor-pointer hover:opacity-80 transition"
          aria-label={`${storeName} home page`}
        >
          <StoreLogo store={store} />
          <span className="text-[var(--user-text)] font-black text-xl tracking-wide">{storeName}</span>
        </button>

        {/* Middle: Content */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles size={14} className="text-[var(--user-accent)]" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--user-accent)]">
              Trusted by thousands of customers
            </span>
          </div>

          <h1 className="text-5xl xl:text-[3.4rem] font-black text-[var(--user-text)] mb-5 leading-[1.08] tracking-tight">
            Premium Shopping
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--user-accent)] to-emerald-300">
              Experience
            </span>
          </h1>

          <p className="text-[var(--user-text-muted)] text-base xl:text-lg mb-8 max-w-md leading-relaxed">
            {tagline}
          </p>

          {/* Categories */}
          {topCategories.length > 0 && (
            <div className="flex gap-3 flex-wrap mb-10">
              {topCategories.map((cat) => (
                <div
                  key={cat._id}
                  className="flex items-center gap-2.5 px-4 py-2.5 bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-xl text-[var(--user-text-secondary)] text-sm"
                >
                  <span className="w-6 h-6 rounded-md bg-[var(--user-accent)]/10 text-[var(--user-accent)] flex items-center justify-center text-xs font-black">
                    {cat.name.charAt(0)}
                  </span>
                  {cat.name}
                </div>
              ))}
            </div>
          )}

          {/* Feature row */}
          <div className="flex items-center gap-7">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--user-text-muted)]">
              <Truck size={15} className="text-[var(--user-accent)]" /> Free Delivery
            </div>
            <div className="w-1 h-1 rounded-full bg-[var(--user-border)]" />
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--user-text-muted)]">
              <ShieldCheck size={15} className="text-[var(--user-accent)]" /> Secure Payment
            </div>
            <div className="w-1 h-1 rounded-full bg-[var(--user-border)]" />
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--user-text-muted)]">
              <RotateCcw size={15} className="text-[var(--user-accent)]" /> Easy Returns
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="text-[var(--user-text-subtle)] text-sm relative">
          © {new Date().getFullYear()} {storeName}. All rights reserved.
        </div>
      </div>

      {/* ═══════════ RIGHT — FORM ═══════════ */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-5 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
                    {/* Mobile Logo */}
          <button
            type="button"
            onClick={() => router.push("/")}
            className="lg:hidden flex items-center justify-center gap-3 mb-6 cursor-pointer hover:opacity-80 transition"
            aria-label={`${storeName} home page`}
          >
            <StoreLogo store={store} sizeClass="w-9 h-9" />
            <span className="text-[var(--user-text)] font-black text-lg tracking-wide">{storeName}</span>
          </button>

          <div className="bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-2xl p-6 sm:p-8 shadow-[var(--user-shadow-lg)]">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={16} className="text-[var(--user-accent)]" />
                <span className="text-[var(--user-accent)] text-[10px] font-bold uppercase tracking-widest">
                  {isLogin ? "User Sign-In" : "Create Account"}
                </span>
              </div>
              <h2 className="text-2xl font-black text-[var(--user-text)] mb-1">
                {isLogin ? "Welcome Back" : "Create Account"}
              </h2>
              <p className="text-[var(--user-text-muted)] py-2 text-sm">
                {isLogin ? "Continue shopping with your account." : "Create your account in just 30 seconds."}
              </p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-[var(--user-danger)]/10 border border-[var(--user-danger)]/30 text-[var(--user-danger)] text-sm">
                {error}
              </div>
            )}

            {/* Google */}
            {isLogin && (
              <>
                <div className="flex justify-center mb-6">
                  {googleClientId ? (
                    <GoogleLogin
                      onSuccess={(res) => handleGoogleLogin(res.credential)}
                      onError={() => setError("Google login failed. Try again.")}
                      theme="filled_black"
                      shape="pill"
                      size="large"
                      width={320}
                      text="continue_with"
                    />
                  ) : (
                    <div className="w-full py-3 rounded-full border border-[var(--user-border)] text-center text-[var(--user-text-muted)] text-sm">
                      Google login unavailable
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-[var(--user-border)]" />
                  <span className="text-[var(--user-text-subtle)] text-[10px] uppercase tracking-widest font-semibold">or with email</span>
                  <div className="flex-1 h-px bg-[var(--user-border)]" />
                </div>
              </>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {!isLogin && (
                <>
                  <div className="relative">
                    <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls} />
                  </div>
                  <div className="relative">
                    <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                    <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className={inputCls} />
                  </div>
                  <div className="relative">
                    <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => {
                        // ✅ Sirf digits allow + 14 character limit
                        const val = e.target.value.replace(/\D/g, "").slice(0, 14);
                        setPhone(val);
                      }}
                      maxLength={14}
                      placeholder="Phone number (03001234567)"
                      className={inputCls}
                    />
                  </div>
                </>
              )}

              <div className="relative">
                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className={inputCls} />
              </div>

              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={6} className={inputCls} />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                {loading ? (isLogin ? "Logging in..." : "Creating account...") : isLogin ? "Login" : "Create Account"}
              </button>
            </form>

            <p className="text-center mt-5 text-[var(--user-text-muted)] text-sm">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(""); }}
                className="text-[var(--user-accent)] pt-2 hover:underline font-semibold bg-transparent border-0 p-0 outline-none"
              >
                {isLogin ? "Register" : "Login"}
              </button>
            </p>
          </div>

          <p className="text-center mt-4 text-[11px] text-[var(--user-text-subtle)]">
            By continuing, you agree to our Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </main>
  );
}