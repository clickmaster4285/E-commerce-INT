"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GoogleLogin } from "@react-oauth/google";
import {
  Mail, Lock, LogIn, Loader2, User, Phone, ShieldCheck, X,
} from "lucide-react";
import axiosInstance from "@/apis/axiosInstance";

export default function LoginModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // ✅ ESC key se close — useEffect sirf CLIENT pe chalta hai (server pe nahi)
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isLogin ? "/users/login" : "/users/register";
      const payload = isLogin ? { email, password } : { name, username, phone, email, password };
      await axiosInstance.post(endpoint, payload);

      // User data refresh
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });

      resetForm();
      onClose();
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
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      resetForm();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Google login failed.");
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName(""); setUsername(""); setPhone(""); setEmail(""); setPassword("");
    setError(""); setLoading(false);
  };

  const inputCls =
    "w-full h-11 rounded-xl bg-[var(--user-bg-input)] border border-[var(--user-border)] pl-11 pr-4 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15 transition";

  if (!isOpen) return null;

  return (
    <>
      {/* OVERLAY */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
      />

      {/* MODAL */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-2xl shadow-[var(--user-shadow-lg)] w-full max-w-md max-h-[90vh] overflow-y-auto relative">

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center hover:bg-[var(--user-danger)]/10 transition z-10"
          >
            <X size={16} className="text-[var(--user-text)]" />
          </button>

          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="mb-6 pr-8">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={16} className="text-[var(--user-accent)]" />
                <span className="text-[var(--user-accent)] text-[10px] font-bold uppercase tracking-widest">
                  {isLogin ? "User Sign-In" : "Create Account"}
                </span>
              </div>
              <h2 className="text-2xl font-black text-[var(--user-text)] mb-1">
                {isLogin ? "Welcome Back" : "Create Account"}
              </h2>
              <p className="text-[var(--user-text-muted)] text-sm">
                {isLogin ? "Continue shopping with your account." : "Create your account in 30 seconds."}
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
                      onError={() => setError("Google login failed.")}
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
            <form onSubmit={handleSubmit} className="space-y-3">
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
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 14))}
                      maxLength={14}
                      placeholder="Phone number"
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
                className="w-full h-11 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 mt-1"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                {loading ? (isLogin ? "Logging in..." : "Creating account...") : isLogin ? "Login" : "Create Account"}
              </button>
            </form>

            <p className="text-center py-2 mt-5 text-[var(--user-text-muted)] text-sm">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(""); }}
                className="text-[var(--user-accent)] hover:underline font-semibold"
              >
                {isLogin ? "Register" : "Login"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}