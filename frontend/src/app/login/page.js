"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import LazyGoogleLogin from "@/components/user/LazyGoogleLogin";
import {
  Mail, Lock, LogIn, Loader2, User, Phone, ShieldCheck,
  Truck, RotateCcw, Sparkles, KeyRound, MailCheck, ArrowLeft, AlertCircle,
} from "lucide-react";
import { storeApi } from "@/apis/user/storeApi";
import { categoryApi } from "@/apis/user/categoryApi";
import { authApi, getApiErrorMessage, isValidEmail } from "@/apis/user/authApi";
import OtpVerifyCard from "@/components/user/OtpVerifyCard";
import ResetPasswordCard from "@/components/user/ResetPasswordCard";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");

  // ✅ AUTH FLOW STEPS
  // auth | verify-email | forgot | forgot-otp | reset
  const [step, setStep] = useState("auth");
  const [otpEmail, setOtpEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");

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

  // ✅ Backend 400 field errors ko form fields par dikhao (LoginModal jaisa)
  const parseBackendError = (err) => {
    const responseData = err.response?.data || {};
    const message =
      responseData?.message ||
      responseData?.error ||
      responseData?.msg ||
      err.message ||
      "";
    const fieldErrors =
      responseData?.errors || responseData?.fieldErrors || responseData?.details || {};
    const newErrors = {};

    if (fieldErrors && typeof fieldErrors === "object" && Object.keys(fieldErrors).length > 0) {
      Object.entries(fieldErrors).forEach(([field, msg]) => {
        const errorMsg = Array.isArray(msg) ? msg[0] : msg;
        const fieldMap = {
          userName: "username",
          user_name: "username",
          phoneNumber: "phone",
          phone_number: "phone",
          emailAddress: "email",
          email_address: "email",
        };
        newErrors[fieldMap[field] || field] = errorMsg;
      });
      setErrors(newErrors);
      return;
    }

    const lowerMsg = String(message).toLowerCase();
    if (lowerMsg.includes("email") && (lowerMsg.includes("exist") || lowerMsg.includes("already") || lowerMsg.includes("taken"))) {
      setErrors({ email: message });
      return;
    }
    if (lowerMsg.includes("username") && (lowerMsg.includes("exist") || lowerMsg.includes("already") || lowerMsg.includes("taken"))) {
      setErrors({ username: message });
      return;
    }
    if (lowerMsg.includes("phone") && (lowerMsg.includes("exist") || lowerMsg.includes("already") || lowerMsg.includes("taken"))) {
      setErrors({ phone: message });
      return;
    }
    if (message) {
      setGeneralError(message);
      return;
    }
    setGeneralError(`${isLogin ? "Login" : "Registration"} failed. Please try again.`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setGeneralError("");
    setLoading(true);
    try {
      if (isLogin) {
        await authApi.login({ email, password });
        window.location.href = "/";
        return;
      }

      // ✅ REGISTER → User NAHI banta, sirf pending + OTP jata hai, phir verify screen
      const res = await authApi.register({ name, username, phone, email, password });
      setOtpEmail(res?.email || email);
      setStep("verify-email");
      toast.success(res?.message || `Verification code sent to ${res?.email || email}`);
      setLoading(false);
    } catch (err) {
      // 🔁 Email verify nahi hui — seedha OTP screen dikhao
      if (err.response?.data?.needsVerification) {
        setOtpEmail(err.response.data.email || email);
        setStep("verify-email");
        toast.info(err.response.data.message || "Please verify your email first.");
        setLoading(false);
        return;
      }
      parseBackendError(err);
      toast.error(getApiErrorMessage(err, `${isLogin ? "Login" : "Registration"} failed.`));
      setLoading(false);
    }
  };

  // ==========================================
  // 📧 EMAIL VERIFICATION (OTP)
  // ==========================================
  const handleVerifyEmailOtp = async (otp) => {
    await authApi.verifyEmailOtp(otpEmail, otp);
    toast.success("Email verified successfully! Welcome aboard.");
    window.location.href = "/";
  };

  const handleResendEmailOtp = async () => {
    const res = await authApi.sendEmailOtp(otpEmail);
    toast.success(res?.message || "A new verification code has been sent.");
  };

  // ==========================================
  // 🔐 FORGOT PASSWORD (OTP)
  // ==========================================
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!isValidEmail(forgotEmail)) {
      setForgotError("Please enter a valid email address.");
      return;
    }
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await authApi.sendForgotOtp(forgotEmail.trim());
      setOtpEmail(forgotEmail.trim());
      setStep("forgot-otp");
      toast.success(res?.message || "Password reset code sent to your email.");
    } catch (err) {
      setForgotError(getApiErrorMessage(err, "Could not send the reset code."));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyResetOtp = async (otp) => {
    const res = await authApi.verifyResetOtp(otpEmail, otp);
    setResetToken(res?.resetToken || "");
    setStep("reset");
    toast.success(res?.message || "Code verified. Please set a new password.");
  };

  const handleResendResetOtp = async () => {
    const res = await authApi.sendForgotOtp(otpEmail);
    toast.success(res?.message || "A new reset code has been sent.");
  };

  const handleResetPassword = async (newPassword) => {
    await authApi.resetPassword({ email: otpEmail, resetToken, newPassword });
    toast.success("Password reset successfully. Please log in with your new password.");
    setPassword("");
    setResetToken("");
    setOtpEmail("");
    setForgotEmail("");
    setForgotError("");
    setIsLogin(true);
    setStep("auth");
  };

  const handleGoogleLogin = async (credential) => {
    setLoading(true);
    try {
      await authApi.googleCustomerLogin(credential);
      window.location.href = "/";
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Google login failed."));
      setLoading(false);
    }
  };

  const inputCls =
    "w-full h-12 rounded-xl bg-[var(--user-bg-input)] border pl-11 pr-4 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none transition";

  const getInputCls = (field) => {
    const hasError = errors[field];
    return `${inputCls} ${
      hasError
        ? "border-[var(--user-danger)] focus:border-[var(--user-danger)] focus:ring-2 focus:ring-[var(--user-danger)]/15"
        : "border-[var(--user-border)] focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15"
    }`;
  };

  const renderFieldError = (field) => {
    if (!errors[field]) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1.5 px-1">
        <AlertCircle size={12} className="text-[var(--user-danger)] shrink-0" />
        <p className="text-[0.6875rem] font-semibold text-[var(--user-danger)]">{errors[field]}</p>
      </div>
    );
  };

  return (
    <main className="user-theme h-screen flex bg-[var(--user-bg)] overflow-y-auto lg:overflow-hidden">
      {/* ═══════════ LEFT — BRANDING (Desktop) ═══════════ */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 xl:p-14 bg-[var(--user-bg-elevated)] relative overflow-hidden border-r border-[var(--user-border)] shrink-0">
        {/* Glows */}
        <div className="absolute top-[-140px] left-[-140px] w-[26.25rem] h-[26.25rem] rounded-full bg-[var(--user-accent)]/6 blur-3xl" />
        <div className="absolute bottom-[-140px] right-[-140px] w-[26.25rem] h-[26.25rem] rounded-full bg-[var(--user-accent)]/6 blur-3xl" />

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
            <span className="text-[0.6875rem] font-bold uppercase tracking-widest text-[var(--user-accent)]">
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

            {/* ═══ STEP: EMAIL VERIFICATION OTP ═══ */}
            {step === "verify-email" && (
              <OtpVerifyCard
                email={otpEmail}
                icon={MailCheck}
                title="Verify your email"
                subtitle="Enter the 6-digit code we sent to"
                submitLabel="Verify & Continue"
                onVerify={handleVerifyEmailOtp}
                onResend={handleResendEmailOtp}
                onBack={() => setStep("auth")}
                backLabel="Use a different email"
                expiresInMinutes={5}
              />
            )}

            {/* ═══ STEP: FORGOT PASSWORD — EMAIL ═══ */}
            {step === "forgot" && (
              <div>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <KeyRound size={16} className="text-[var(--user-accent)]" />
                    <span className="text-[var(--user-accent)] text-[0.625rem] font-bold uppercase tracking-widest">
                      Forgot Password
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-[var(--user-text)] mb-1">Reset your password</h2>
                  <p className="text-[var(--user-text-muted)] text-sm">
                    Enter your registered email and we&apos;ll send you a 6-digit code.
                  </p>
                </div>

                <form onSubmit={handleForgotSubmit} className="space-y-3.5" noValidate>
                  <div className="relative">
                    <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        setForgotError("");
                      }}
                      placeholder="Email address"
                      className={inputCls}
                    />
                  </div>

                  {forgotError && (
                    <div className="px-4 py-3 rounded-xl bg-[var(--user-danger)]/10 border border-[var(--user-danger)]/30 flex items-start gap-2">
                      <AlertCircle size={16} className="text-[var(--user-danger)] shrink-0 mt-0.5" />
                      <p className="text-[var(--user-danger)] text-sm">{forgotError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full h-12 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {forgotLoading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
                    {forgotLoading ? "Sending code..." : "Send reset code"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("auth");
                      setForgotError("");
                    }}
                    className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition"
                  >
                    <ArrowLeft size={13} /> Back to login
                  </button>
                </form>
              </div>
            )}

            {/* ═══ STEP: FORGOT PASSWORD — OTP ═══ */}
            {step === "forgot-otp" && (
              <OtpVerifyCard
                email={otpEmail}
                icon={KeyRound}
                title="Enter reset code"
                subtitle="Enter the 6-digit code we sent to"
                submitLabel="Verify code"
                onVerify={handleVerifyResetOtp}
                onResend={handleResendResetOtp}
                onBack={() => setStep("forgot")}
                backLabel="Change email"
                expiresInMinutes={5}
              />
            )}

            {/* ═══ STEP: SET NEW PASSWORD ═══ */}
            {step === "reset" && (
              <ResetPasswordCard
                email={otpEmail}
                onSubmit={handleResetPassword}
                onBack={() => setStep("auth")}
              />
            )}

            {/* ═══ STEP: LOGIN / REGISTER (default) ═══ */}
            {step === "auth" && (
              <>
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={16} className="text-[var(--user-accent)]" />
                <span className="text-[var(--user-accent)] text-[0.625rem] font-bold uppercase tracking-widest">
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

            {/* Google */}
            {isLogin && (
              <>
                <div className="flex justify-center mb-6">
                  {googleClientId ? (
                    <LazyGoogleLogin
                      clientId={googleClientId}
                      onSuccess={(res) => handleGoogleLogin(res.credential)}
                      onError={() => toast.error("Google login failed. Try again.")}
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
                  <span className="text-[var(--user-text-subtle)] text-[0.625rem] uppercase tracking-widest font-semibold">or with email</span>
                  <div className="flex-1 h-px bg-[var(--user-border)]" />
                </div>
              </>
            )}

            {generalError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-[var(--user-danger)]/10 border border-[var(--user-danger)]/30 flex items-start gap-2">
                <AlertCircle size={16} className="text-[var(--user-danger)] shrink-0 mt-0.5" />
                <p className="text-[var(--user-danger)] text-sm">{generalError}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
              {!isLogin && (
                <>
                  <div>
                    <div className="relative">
                      <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                      <input type="text" required value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }} placeholder="Full name" className={getInputCls("name")} />
                    </div>
                    {renderFieldError("name")}
                  </div>
                  <div>
                    <div className="relative">
                      <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                      <input type="text" required value={username} onChange={(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: "" })); }} placeholder="Username" className={getInputCls("username")} />
                    </div>
                    {renderFieldError("username")}
                  </div>
                  <div>
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
                          setErrors((p) => ({ ...p, phone: "" }));
                        }}
                        maxLength={14}
                        placeholder="Phone number (03001234567)"
                        className={getInputCls("phone")}
                      />
                    </div>
                    {renderFieldError("phone")}
                  </div>
                </>
              )}

              <div>
                <div className="relative">
                  <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                  <input
                    type="email"
                    suppressHydrationWarning
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((p) => ({ ...p, email: "" }));
                    }}
                    placeholder="Email address"
                    className={getInputCls("email")}
                  />
                </div>
                {renderFieldError("email")}
              </div>

              <div>
                <div className="relative">
                  <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                  <input type="password" required value={password} onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }} placeholder="Password" minLength={6} className={getInputCls("password")} />
                </div>
                {renderFieldError("password")}
              </div>

              {/* ✅ FORGOT PASSWORD — OTP flow */}
              {isLogin && (
                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(true);
                      setForgotEmail(email);
                      setForgotError("");
                      setStep("forgot");
                    }}
                    className="text-[0.75rem] font-semibold text-[var(--user-accent)] hover:underline bg-transparent border-0 p-0 outline-none"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

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
                onClick={() => { setIsLogin(!isLogin); setErrors({}); setGeneralError(""); }}
                className="text-[var(--user-accent)] pt-2 hover:underline font-semibold bg-transparent border-0 p-0 outline-none"
              >
                {isLogin ? "Register" : "Login"}
              </button>
            </p>
              </>
            )}
          </div>

          <p className="text-center mt-4 text-[0.6875rem] text-[var(--user-text-subtle)]">
            By continuing, you agree to our Terms & Privacy Policy.
          </p>
        </div>
      </div>
    </main>
  );
}
