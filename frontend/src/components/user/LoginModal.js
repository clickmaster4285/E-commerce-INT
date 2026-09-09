"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GoogleLogin } from "@react-oauth/google";
import {
  Mail, Lock, LogIn, Loader2, User, Phone, ShieldCheck, X, AlertCircle,
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
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!isLogin) {
      if (!name.trim()) newErrors.name = "Name is required";
      else if (name.trim().length < 2) newErrors.name = "Name must be at least 2 characters";

      if (!username.trim()) newErrors.username = "Username is required";
      else if (username.trim().length < 3) newErrors.username = "Username must be at least 3 characters";
      else if (!/^[a-zA-Z0-9_]+$/.test(username)) newErrors.username = "Username can only contain letters, numbers, and underscores";

      if (!phone.trim()) newErrors.phone = "Phone number is required";
      else if (phone.replace(/\D/g, "").length < 4) newErrors.phone = "Phone number must be at least 4 digits";
    }

    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Please enter a valid email address";

    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6) newErrors.password = "Password must be at least 6 characters";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ IMPROVED: Parse backend errors with multiple fallback strategies
  const parseBackendError = (err) => {
    const newErrors = {};
    const responseData = err.response?.data;
    
    // Try multiple possible error message locations
    const message = 
      responseData?.message || 
      responseData?.error || 
      responseData?.msg || 
      responseData?.detail ||
      err.message || 
      "";
    
    // Try multiple possible field error locations
    const fieldErrors = 
      responseData?.errors || 
      responseData?.fieldErrors || 
      responseData?.details ||
      {};

    // Strategy 1: If backend sent field-specific errors object
    if (typeof fieldErrors === "object" && fieldErrors !== null && Object.keys(fieldErrors).length > 0) {
      Object.entries(fieldErrors).forEach(([field, msg]) => {
        const errorMsg = Array.isArray(msg) ? msg[0] : msg;
        // Map common backend field names to our form fields
        const fieldMap = {
          userName: "username",
          user_name: "username",
          userName: "username",
          phoneNumber: "phone",
          phone_number: "phone",
          emailAddress: "email",
          email_address: "email",
        };
        const mappedField = fieldMap[field] || field;
        newErrors[mappedField] = errorMsg;
      });
      setErrors(newErrors);
      return "";
    }

    // Strategy 2: Parse common error message patterns
    const lowerMsg = message.toLowerCase();
    
    // Check for duplicate errors
    if (lowerMsg.includes("email") && (lowerMsg.includes("exist") || lowerMsg.includes("already") || lowerMsg.includes("taken"))) {
      newErrors.email = message;
    } 
    else if (lowerMsg.includes("username") && (lowerMsg.includes("exist") || lowerMsg.includes("already") || lowerMsg.includes("taken"))) {
      newErrors.username = message;
    } 
    else if (lowerMsg.includes("phone") && (lowerMsg.includes("exist") || lowerMsg.includes("already") || lowerMsg.includes("taken"))) {
      newErrors.phone = message;
    }
    // Check for validation errors
    else if (lowerMsg.includes("invalid") && lowerMsg.includes("email")) {
      newErrors.email = "Email not found or invalid";
    } 
    else if (lowerMsg.includes("invalid") && lowerMsg.includes("password")) {
      newErrors.password = "Incorrect password";
    }
    else if (lowerMsg.includes("invalid") && lowerMsg.includes("credentials")) {
      setGeneralError("Invalid email or password");
      return "";
    }
    // Check for network/server errors
    else if (err.code === "ECONNABORTED" || err.code === "ERR_NETWORK") {
      setGeneralError("Network error. Please check your connection and try again.");
      return "";
    }
    else if (err.response?.status === 500) {
      setGeneralError("Server error. Please try again later.");
      return "";
    }
    else if (err.response?.status === 404) {
      setGeneralError("Service unavailable. Please try again.");
      return "";
    }
    else {
      // If we have a message but couldn't parse it, show as general error
      if (message) {
        setGeneralError(message);
        return "";
      }
      // Fallback generic error
      setGeneralError(`${isLogin ? "Login" : "Registration"} failed. Please try again.`);
      return "";
    }

    setErrors(newErrors);
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setGeneralError("");

    if (!validateForm()) return;

    setLoading(true);
    try {
      const endpoint = isLogin ? "/users/login" : "/users/register";
      const payload = isLogin ? { email, password } : { name, username, phone, email, password };
      await axiosInstance.post(endpoint, payload);

      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      resetForm();
      onClose();
    } catch (err) {
      parseBackendError(err);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (credential) => {
    setErrors({});
    setGeneralError("");
    setLoading(true);
    try {
      await axiosInstance.post("/users/google-login", { credential });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      resetForm();
      onClose();
    } catch (err) {
      setGeneralError(err.response?.data?.message || "Google login failed.");
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName(""); setUsername(""); setPhone(""); setEmail(""); setPassword("");
    setErrors({}); setGeneralError(""); setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
    setGeneralError("");
  };

  const inputCls =
    "w-full h-11 rounded-xl bg-[var(--user-bg-input)] border pl-11 pr-4 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none transition";

  const getInputCls = (field) => {
    const hasError = errors[field];
    return `${inputCls} ${
      hasError
        ? "border-[var(--user-danger)] focus:border-[var(--user-danger)] focus:ring-2 focus:ring-[var(--user-danger)]/15"
        : "border-[var(--user-border)] focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15"
    }`;
  };

  const FieldError = ({ field }) => {
    if (!errors[field]) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1.5 px-1">
        <AlertCircle size={12} className="text-[var(--user-danger)] shrink-0" />
        <p className="text-[11px] font-semibold text-[var(--user-danger)]">{errors[field]}</p>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div onClick={handleClose} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]" />

      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-2xl shadow-[var(--user-shadow-lg)] w-full max-w-md max-h-[90vh] overflow-y-auto relative">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center hover:bg-[var(--user-danger)]/10 transition z-10"
          >
            <X size={16} className="text-[var(--user-text)]" />
          </button>

          <div className="p-6 sm:p-8">
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

            {generalError && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-[var(--user-danger)]/10 border border-[var(--user-danger)]/30 flex items-start gap-2">
                <AlertCircle size={16} className="text-[var(--user-danger)] shrink-0 mt-0.5" />
                <p className="text-[var(--user-danger)] text-sm">{generalError}</p>
              </div>
            )}

            {isLogin && (
              <>
                <div className="flex justify-center mb-6">
                  {googleClientId ? (
                    <GoogleLogin
                      onSuccess={(res) => handleGoogleLogin(res.credential)}
                      onError={() => setGeneralError("Google login failed.")}
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

            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              {!isLogin && (
                <>
                  <div>
                    <div className="relative">
                      <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: "" })); }}
                        placeholder="Full name"
                        className={getInputCls("name")}
                      />
                    </div>
                    <FieldError field="name" />
                  </div>

                  <div>
                    <div className="relative">
                      <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); setErrors((prev) => ({ ...prev, username: "" })); }}
                        placeholder="Username"
                        className={getInputCls("username")}
                      />
                    </div>
                    <FieldError field="username" />
                  </div>

                  <div>
                    <div className="relative">
                      <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 15)); setErrors((prev) => ({ ...prev, phone: "" })); }}
                        maxLength={15}
                        placeholder="Phone number"
                        className={getInputCls("phone")}
                      />
                    </div>
                    <FieldError field="phone" />
                  </div>
                </>
              )}

              <div>
                <div className="relative">
                  <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: "" })); }}
                    placeholder="Email address"
                    className={getInputCls("email")}
                  />
                </div>
                <FieldError field="email" />
              </div>

              <div>
                <div className="relative">
                  <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: "" })); }}
                    placeholder="Password"
                    className={getInputCls("password")}
                  />
                </div>
                <FieldError field="password" />
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
              <button onClick={switchMode} className="text-[var(--user-accent)] hover:underline font-semibold">
                {isLogin ? "Register" : "Login"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}