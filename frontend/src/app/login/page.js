"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { GoogleLogin } from "@react-oauth/google";
import { Mail, Lock, LogIn, Loader2, User, Phone, ShieldCheck } from "lucide-react";
import axiosInstance from "@/apis/axiosInstance";
import { storeApi } from "@/apis/storeApi";
import { categoryApi } from "@/apis/categoryApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

// ✅ Store Logo — dynamic + fallback letter
function StoreLogo({ store, sizeClass = "w-10 h-10" }) {
  const logoUrl = store?.logo?.img_url
    ? store.logo.img_url.startsWith("http")
      ? store.logo.img_url
      : `${API_ORIGIN}/${store.logo.img_url}`
    : null;
  const letter = (store?.store_name || "C").charAt(0).toUpperCase();

  if (!logoUrl) {
    return (
      <div
        className={`${sizeClass} rounded-lg bg-[var(--user-accent)] flex items-center justify-center shrink-0`}
      >
        <span className="text-[var(--user-accent-text)] font-black text-lg lg:text-xl">
          {letter}
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={store?.store_name || "Store"}
      className={`${sizeClass} rounded-lg object-cover shrink-0`}
    />
  );
}

// ✅ Category Badge — dynamic
function CategoryBadge({ icon, label }) {
  return (
    <div className="flex items-center gap-2 px-4 lg:px-5 py-2.5 lg:py-3 bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-xl text-[var(--user-text-secondary)] text-xs lg:text-sm">
      <span className="text-[var(--user-accent)]">{icon}</span>
      {label}
    </div>
  );
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

  // ✅ Store info (public)
  const { data: store = null } = useQuery({
    queryKey: ["storeInfo"],
    queryFn: storeApi.getPublic,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Top 3 categories (branding ke liye)
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const storeName = store?.store_name || "ClickMasters";
  const tagline =
    store?.tagline ||
    "Mobiles · Laptops · Watches · Accessories\nShop everything from one trusted store.";
  const topCategories = categories.slice(0, 3);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isLogin ? "/users/login" : "/users/register";
      
      // ✅ FIX: Register karte waqt role 'staff' set karna zaroori hai
      //        taake woh customer na bane aur admin panel access kar sake
      const payload = isLogin
        ? { email, password }
        : { 
            name, 
            username, 
            phone, 
            email, 
            password,
            role: "staff" // ✅ Explicitly setting role for new registrations
          };

      const response = await axiosInstance.post(endpoint, payload);
      
      // ✅ ROLE VALIDATION CHECK
      // Backend se jo response aaya hai usme role check karo
      const userData = response.data?.user || response.data?.data || {};
      const userRole = userData.role?.toLowerCase();

      if (userRole !== "admin" && userRole !== "staff") {
        throw new Error("Access Denied: Only Admin and Staff members are allowed to login.");
      }

      // Agar role sahi hai to redirect karo
      window.location.href = "/"; 
      
    } catch (err) {
      // Custom error handling for role restriction
      const msg = err.response?.data?.message || err.message || `${isLogin ? "Login" : "Registration"} failed.`;
      setError(msg);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (credential) => {
    setError("");
    setLoading(true);
    try {
      const response = await axiosInstance.post("/users/google-login", { credential });
      
      // ✅ GOOGLE LOGIN MEIN BHI ROLE CHECK
      const userData = response.data?.user || response.data?.data || {};
      const userRole = userData.role?.toLowerCase();

      if (userRole !== "admin" && userRole !== "staff") {
        throw new Error("Access Denied: Your Google account is not authorized as Staff/Admin.");
      }

      window.location.href = "/";
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Google login failed.");
      setLoading(false);
    }
  };

  return (
    <main className="user-theme min-h-screen flex bg-[var(--user-bg)]">
      {/* ==========================================
          LEFT SIDE — BRANDING (Desktop only)
      ========================================== */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[var(--user-bg-elevated)] relative overflow-hidden border-r border-[var(--user-border)]">
        {/* Subtle glows */}
        <div className="absolute top-[-120px] left-[-120px] w-[400px] h-[400px] rounded-full bg-[var(--user-accent)]/5 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-120px] w-[400px] h-[400px] rounded-full bg-[var(--user-accent)]/5 blur-3xl" />

        {/* TOP: Logo */}
        <div className="flex items-center gap-3 relative">
          <StoreLogo store={store} />
          <span className="text-[var(--user-text)] font-black text-xl tracking-wide">
            {storeName}
          </span>
        </div>

        {/* MIDDLE: Content */}
        <div className="flex-1 flex flex-col justify-center -mt-20 relative">
          <h1 className="text-5xl font-black text-[var(--user-text)] mb-4 leading-tight">
            Premium Shopping
            <br />
            <span className="text-[var(--user-accent)]">Experience</span>
          </h1>

          <p className="text-[var(--user-text-muted)] text-lg mb-8 max-w-md leading-relaxed whitespace-pre-line">
            {tagline}
          </p>

          {topCategories.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              {topCategories.map((cat) => (
                <CategoryBadge
                  key={cat._id}
                  icon={<span className="font-black">{cat.name.charAt(0)}</span>}
                  label={cat.name}
                />
              ))}
            </div>
          )}
        </div>

        {/* BOTTOM: Footer */}
        <div className="text-[var(--user-text-subtle)] text-sm relative">
          © {new Date().getFullYear()} {storeName}. All rights reserved.
        </div>
      </div>

      {/* ==========================================
          RIGHT SIDE — FORM
      ========================================== */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-5 sm:p-6 lg:p-8 bg-[var(--user-bg)]">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-6 lg:mb-8">
            <StoreLogo store={store} sizeClass="w-9 h-9 lg:w-10 lg:h-10" />
            <span className="text-[var(--user-text)] font-black text-lg lg:text-xl tracking-wide">
              {storeName}
            </span>
          </div>

          <div className="bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-2xl p-6 sm:p-8 shadow-[var(--user-shadow-lg)]">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-3 lg:mb-4">
              <ShieldCheck size={16} className="text-[var(--user-accent)] lg:w-[18px] lg:h-[18px]" />
              <span className="text-[var(--user-accent)] text-[10px] lg:text-xs font-bold uppercase tracking-wider">
                {isLogin ? "Staff Sign-In" : "Create Staff Account"}
              </span>
            </div>

            <h2 className="text-xl lg:text-2xl font-black text-[var(--user-text)] mb-1">
              {isLogin ? "Welcome Back" : "Join the Team"}
            </h2>
            <p className="text-[var(--user-text-muted)] text-sm mb-5 lg:mb-6">
              {isLogin
                ? "Access your admin dashboard securely."
                : "Register as a staff member to manage the store."}
            </p>

            {/* Error */}
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-[var(--user-danger)]/10 border border-[var(--user-danger)]/30 text-[var(--user-danger)] text-sm">
                {error}
              </div>
            )}

            {/* Google Button — Sirf Login */}
            {isLogin && (
              <>
                <div className="flex justify-center">
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

                <div className="flex items-center gap-3 my-5 lg:my-6">
                  <div className="flex-1 h-px bg-[var(--user-border)]" />
                  <span className="text-[var(--user-text-subtle)] text-[10px] lg:text-xs uppercase tracking-widest">
                    or with email
                  </span>
                  <div className="flex-1 h-px bg-[var(--user-border)]" />
                </div>
              </>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3 lg:space-y-4">
              {!isLogin && (
                <div className="relative">
                  <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)] lg:w-4 lg:h-4" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full h-11 lg:h-12 rounded-xl bg-[var(--user-bg-input)] border border-[var(--user-border)] pl-11 pr-4 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] transition"
                  />
                </div>
              )}

              {!isLogin && (
                <div className="relative">
                  <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)] lg:w-4 lg:h-4" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    className="w-full h-11 lg:h-12 rounded-xl bg-[var(--user-bg-input)] border border-[var(--user-border)] pl-11 pr-4 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] transition"
                  />
                </div>
              )}

              {!isLogin && (
                <div className="relative">
                  <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)] lg:w-4 lg:h-4" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number (03001234567)"
                    className="w-full h-11 lg:h-12 rounded-xl bg-[var(--user-bg-input)] border border-[var(--user-border)] pl-11 pr-4 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] transition"
                  />
                </div>
              )}

              <div className="relative">
                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)] lg:w-4 lg:h-4" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full h-11 lg:h-12 rounded-xl bg-[var(--user-bg-input)] border border-[var(--user-border)] pl-11 pr-4 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] transition"
                />
              </div>

              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)] lg:w-4 lg:h-4" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  minLength={6}
                  className="w-full h-11 lg:h-12 rounded-xl bg-[var(--user-bg-input)] border border-[var(--user-border)] pl-11 pr-4 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 lg:h-12 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] font-bold flex items-center justify-center gap-2 hover:bg-[var(--user-accent-hover)] active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <LogIn size={18} />
                )}
                {loading
                  ? isLogin
                    ? "Verifying Access..."
                    : "Creating Account..."
                  : isLogin
                  ? "Login"
                  : "Create Account"}
              </button>
            </form>

            {/* Toggle — clean text link */}
            <p className="text-center mt-5 lg:mt-6 text-[var(--user-text-muted)] text-sm">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                className="text-[var(--user-accent)] hover:underline font-semibold bg-transparent border-0 p-0 outline-none focus:outline-none"
              >
                {isLogin ? "Register" : "Login"}
              </button>
            </p>
          </div>

          <p className="text-center mt-5 text-[11px] text-[var(--user-text-subtle)]">
            By continuing, you agree to our Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </main>
  );
}