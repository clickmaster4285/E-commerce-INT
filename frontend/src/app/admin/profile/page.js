"use client";

import { useEffect, useState, useCallback } from "react";
import {
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  Loader2,
  RefreshCw,
  AlertCircle,
  Edit3,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Store,
  Calendar,
  Clock,
  Award,
  Info,
  KeyRound,
  UserCheck,
  Building2,
  PhoneCall,
  MailCheck,
  MapPinCheck,
} from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { toast } from "sonner";

/* ══════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════ */

const InfoField = ({ icon: Icon, label, value, isLink = false, accent = false }) => {
  const displayValue = value || "—";
  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: accent ? "var(--accent-soft)" : "var(--bg-tertiary)",
          color: accent ? "var(--accent)" : "var(--text-muted)",
        }}
      >
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <p
          className={`mt-0.5 text-[12px] font-medium break-all leading-snug ${isLink ? "hover:underline cursor-pointer" : ""}`}
          style={{ color: isLink || accent ? "var(--accent)" : "var(--text-primary)" }}
        >
          {displayValue}
        </p>
      </div>
    </div>
  );
};

const InputField = ({ label, value, onChange, type = "text", icon: Icon, disabled, placeholder }) => (
  <div className="space-y-1">
    <label className="block text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
      {label}
    </label>
    <div className="relative">
      {Icon && (
        <Icon
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        />
      )}
      <input
        type={type}
        value={value || ""}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full h-9 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-[var(--accent)]/40 disabled:opacity-40 disabled:cursor-not-allowed ${Icon ? "pl-9 pr-3" : "px-3"}`}
        style={{
          backgroundColor: "var(--bg-tertiary)",
          border: "1px solid var(--border-color)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  </div>
);

const PasswordField = ({ label, value, onChange, show, toggle, disabled, placeholder }) => (
  <div className="space-y-1">
    <label className="block text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
      {label}
    </label>
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder || "••••••••"}
        value={value || ""}
        onChange={onChange}
        disabled={disabled}
        className="w-full h-9 rounded-lg px-3 pr-9 text-[13px] outline-none transition focus:ring-1 focus:ring-[var(--accent)]/40 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          border: "1px solid var(--border-color)",
          color: "var(--text-primary)",
        }}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 transition hover:opacity-70 disabled:opacity-40"
        style={{ color: "var(--text-muted)" }}
      >
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  </div>
);

const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-color)",
};

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */

export default function ProfilePage() {
  const { socket, isConnected } = useSocket();

  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [hasProfilePermission, setHasProfilePermission] = useState(true);
  const [hasStorePermission, setHasStorePermission] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const loading = !profileLoaded && (socket?.connected && isConnected);

  /* ── build data from any user object ── */
  const buildData = useCallback((user) => {
    if (!user) return null;
    const hasStoreData = (s) =>
      s && typeof s === "object" && (s.store_name || s.address || s.email || s._id);
    const store =
      (hasStoreData(user.store) && user.store) ||
      (hasStoreData(user.storeId) && user.storeId) ||
      {};
    return {
      name: user.name || "Admin User",
      username: user.username || "admin",
      email: user.email || store.email || "",
      phone: user.phone || store.phone || "",
      role: user.role || "admin",
      avatar: user.avatar || null,
      memberSince:
        user.createdAt || user.created_at
          ? new Date(user.createdAt || user.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "N/A",
      joinDate:
        user.createdAt || user.created_at
          ? new Date(user.createdAt || user.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "N/A",
      lastLogin: user.last_login || user.lastLogin || "Today",
      storeName:
        store.store_name || user.store_name || user.storeName || "My Store",
      address: user.address || store.address || "",
      storeStatus: store.store_status || "Active",
      permissions: user.permissions || {},
    };
  }, []);

  /* ── fetch profile via socket ── */
  const fetchProfile = useCallback(() => {
    if (!socket || !isConnected) return;
    socket.emit("getProfile");
    socket.emit("getStoreInfo");
  }, [socket, isConnected]);

  /* ── socket listeners ── */
  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    fetchProfile();

    const handleProfileData = (res) => {
      if (!res) {
        setProfileLoaded(true);
        return;
      }
      if (res.success === false) {
        setError(res.message || "Failed to load profile.");
        setProfileLoaded(true);
        return;
      }
      const userData = res.data || res.user || res;
      if (userData && (userData.name || userData._id || userData.email)) {
        const data = buildData(userData);
        if (data) {
          setProfile(data);
          setEditForm(data);
          const perms = userData.permissions || data.permissions || {};
          const role = userData.role || data.role || "";
          if (role === "admin") {
            setHasProfilePermission(true);
            setHasStorePermission(true);
          } else {
            setHasProfilePermission(perms.profile !== false);
            setHasStorePermission(!!perms.store);
          }
          setProfileLoaded(true);
          setError("");
          return;
        }
      }
      setProfileLoaded(true);
    };

    const handleProfileUpdated = (res) => {
      const userData = res?.data || res?.user || res;
      if (userData && (userData.name || userData._id)) {
        const data = buildData(userData);
        if (data) {
          setProfile(data);
          setEditForm(data);
          toast.success("Profile synced!");
        }
      }
      if (res?.store) {
        window.dispatchEvent(new CustomEvent("storeUpdated", { detail: res.store }));
      }
    };

    const handleStoreInfoChanged = (storeData) => {
      if (!storeData) return;
      const incoming = storeData.data || storeData;
      if (!incoming || typeof incoming !== "object") return;
      if (!incoming.store_name && !incoming.address && !incoming.email && !incoming.phone) return;
      const mergeStore = (prev) => {
        if (!prev) return prev;
        const isGenericStore =
          !prev.storeName || prev.storeName === "My Store";
        return {
          ...prev,
          storeName:
            incoming.store_name ||
            (!isGenericStore ? prev.storeName : "My Store"),
          address: prev.address || incoming.address || prev.address,
          email: prev.email || incoming.email || prev.email,
          phone: prev.phone || incoming.phone || prev.phone,
          storeStatus: incoming.store_status || prev.storeStatus,
        };
      };
      setProfile((prev) => mergeStore(prev));
      setEditForm((prev) => mergeStore(prev));
    };

    const handleStoreInfoFallback = (res) => {
      const incoming = res?.data || res;
      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return;
      if (!incoming.store_name && !incoming.address) return;
      handleStoreInfoChanged(incoming);
    };

    const handleProfileError = (err) => {
      setProfileLoaded(true);
    };

    socket.on("profileData", handleProfileData);
    socket.on("profileUpdated", handleProfileUpdated);
    socket.on("storeInfoChangedForProfile", (d) => {
      handleStoreInfoChanged(d);
      toast.info("Store info synced from Store page!");
    });
    socket.on("storeInfo", handleStoreInfoFallback);
    socket.on("profileError", handleProfileError);

    return () => {
      socket.off("profileData", handleProfileData);
      socket.off("profileUpdated", handleProfileUpdated);
      socket.off("storeInfoChangedForProfile");
      socket.off("storeInfo", handleStoreInfoFallback);
      socket.off("profileError", handleProfileError);
    };
  }, [socket, isConnected, buildData, fetchProfile]);

  /* Handle loading state when socket disconnects */
  useEffect(() => {
    if (!socket || !isConnected) {
      setTimeout(() => setProfileLoaded(true), 0);
    }
  }, [socket, isConnected]);

  /* ── SAVE PROFILE ── */
  const handleSaveProfile = () => {
    if (!socket || !isConnected) {
      return;
    }

    if (!hasProfilePermission) {
      toast.error("You don't have permission to edit profile.", {
        duration: 6000,
        description: "Contact an administrator to grant you profile access.",
      });
      return;
    }

    setIsSaving(true);
    const payload = {
      name: editForm.name || "",
      email: editForm.email || "",
      phone: editForm.phone || "",
    };
    if (hasStorePermission) {
      payload.address = editForm.address || "";
      payload.store_name = editForm.storeName || "";
    }
    socket.emit("updateProfile", payload, (res) => {
      if (res?.success) {
        toast.success(res.storeSkipped ? res.message : "Profile updated successfully!");
        setIsEditing(false);
        const userData = res.data || res.user || res;
        if (userData && (userData.name || userData._id)) {
          const data = buildData(userData);
          if (data) {
            setProfile(data);
            setEditForm(data);
          }
        }
        if (res.store) {
          window.dispatchEvent(new CustomEvent("storeUpdated", { detail: res.store }));
        }
      } else {
        const msg = res?.message || "Failed to update profile";
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("access denied")) {
          toast.error(msg, {
            duration: 6000,
            description: "Contact an administrator to grant you profile access.",
          });
        } else {
          toast.error(msg);
        }
      }
      setIsSaving(false);
    });
    setTimeout(() => {
      if (socket?.connected) socket.emit("getProfile");
    }, 2000);
  };

  /* ── CHANGE PASSWORD ── */
  const handleChangePassword = () => {
    if (!socket || !isConnected) {
      toast.error("Server connection lost.");
      return;
    }

    if (!hasProfilePermission) {
      toast.error("You don't have permission to change password.", {
        duration: 6000,
        description: "Contact an administrator to grant you profile access.",
      });
      return;
    }

    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error("Please fill all password fields");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwords.current === passwords.new) {
      toast.error("New password must differ from current");
      return;
    }
    setIsChangingPassword(true);
    socket.emit(
      "changePassword",
      { currentPassword: passwords.current, newPassword: passwords.new },
      (res) => {
        if (res?.success) {
          toast.success("Password changed successfully!");
          setPasswords({ current: "", new: "", confirm: "" });
        } else {
          const msg = res?.message || "Failed to change password";
          if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("access denied")) {
            toast.error(msg, {
              duration: 6000,
              description: "Contact an administrator to grant you profile access.",
            });
          } else {
            toast.error(msg);
          }
        }
        setIsChangingPassword(false);
      }
    );
  };

  /* ── RETRY ── */
  const handleRetry = () => {
    if (socket && isConnected) {
      setProfileLoaded(false);
      setLoading(true);
      setError("");
      socket.emit("getProfile");
    } else {
      setError("Socket not connected. Please refresh the page.");
    }
  };

  /* ═══════════════════════════════════════════════
     RENDER — LOADING
     ═══════════════════════════════════════════════ */
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-main)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     RENDER — ERROR
     ═══════════════════════════════════════════════ */
  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-main)" }}
      >
        <div
          className="max-w-md w-full rounded-lg p-6 text-center"
          style={cardStyle}
        >
          <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: "var(--danger)" }} />
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {error}
          </p>
          <button
            onClick={handleRetry}
            className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-semibold transition hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     RENDER — NO PROFILE DATA (fallback)
     ═══════════════════════════════════════════════ */
  if (!profile) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-main)" }}
      >
        <div></div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     RENDER — FULL PROFILE PAGE
     ═══════════════════════════════════════════════ */
  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-4">

        {/* ══ HEADER — Avatar + Name + Store Badge ═ */}
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-5 p-5">
            {/* Avatar */}
            <div className="shrink-0 relative">
              <div
                className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl overflow-hidden flex items-center justify-center"
                style={{
                  border: "2px solid var(--border-color)",
                  background: "linear-gradient(135deg, var(--accent-soft), rgba(59,130,246,0.06))",
                }}
              >
                {profile.avatar ? (
                  <img src={profile.avatar} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <span
                    className="text-3xl sm:text-4xl font-bold select-none"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    {profile.name?.charAt(0).toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <div
                className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: "var(--success)",
                  border: "2px solid var(--bg-card)",
                }}
              >
                <ShieldCheck size={11} className="text-white" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1
                className="text-[20px] sm:text-[22px] font-bold leading-tight truncate mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                {profile.name}
              </h1>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1"
                style={{
                  backgroundColor: "var(--accent-soft)",
                  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                }}
              >
                <Store size={12} style={{ color: "var(--accent)" }} />
                <span className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>
                  {profile.storeName}
                </span>
                <span
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
                />
                <span className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                  {profile.storeStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ TWO COLUMN BODY ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* ── LEFT COLUMN — Account & Security ── */}
          <div className="lg:col-span-4 space-y-4">

            {/* Account Info Card */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <UserCheck size={14} />
                </div>
                <h3
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Account Info
                </h3>
              </div>
              <InfoField icon={Calendar} label="Member Since" value={profile.joinDate} />
              <InfoField icon={Clock} label="Last Login" value={profile.lastLogin} />
              <InfoField icon={ShieldCheck} label="Status" value="Active & Verified" accent />
            </div>

            {/* Security Card */}
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <KeyRound size={14} />
                </div>
                <h3
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Security
                </h3>
              </div>

              {!hasProfilePermission && (
                <div className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)" }}>
                  <AlertCircle size={13} style={{ color: "var(--danger-text)" }} />
                  <p className="text-[11px]" style={{ color: "var(--danger-text)" }}>You don&apos;t have permission to change password</p>
                </div>
              )}

              <div className="space-y-2.5">
                <PasswordField
                  label="Current Password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  show={showPwd.current}
                  toggle={() => setShowPwd({ ...showPwd, current: !showPwd.current })}
                  disabled={!hasProfilePermission}
                  placeholder="Enter current password"
                />
                <PasswordField
                  label="New Password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  show={showPwd.new}
                  toggle={() => setShowPwd({ ...showPwd, new: !showPwd.new })}
                  disabled={!hasProfilePermission}
                  placeholder="Enter new password"
                />
                <PasswordField
                  label="Confirm Password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  show={showPwd.confirm}
                  toggle={() => setShowPwd({ ...showPwd, confirm: !showPwd.confirm })}
                  disabled={!hasProfilePermission}
                  placeholder="Confirm new password"
                />
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !isConnected || !hasProfilePermission}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg text-[12px] font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    {isChangingPassword ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Lock size={13} />
                    )}
                    {isChangingPassword ? "Updating…" : "Update Password"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN — Profile Details ── */}
          <div className="lg:col-span-8">
            <div className="rounded-xl overflow-hidden h-full" style={cardStyle}>

              {/* Card Header with Edit / Save */}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid var(--border-color)" }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    <User size={14} />
                  </div>
                  <h3
                    className="text-[13px] font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Profile Details
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    hasProfilePermission ? (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold transition hover:opacity-80"
                        style={{
                          backgroundColor: "var(--bg-tertiary)",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                    ) : (
                      <button
                        disabled
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold opacity-40 cursor-not-allowed"
                        style={{
                          backgroundColor: "var(--bg-tertiary)",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-muted)",
                        }}
                        title="You don't have permission to edit profile"
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                    )
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditForm(profile);
                        }}
                        className="h-8 w-8 rounded-lg flex items-center justify-center transition hover:opacity-70"
                        style={{
                          backgroundColor: "var(--bg-tertiary)",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-muted)",
                        }}
                        title="Cancel"
                      >
                        <X size={13} />
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSaving || !isConnected || !hasProfilePermission}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                        style={{ backgroundColor: "var(--accent)" }}
                      >
                        {isSaving ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Save size={13} />
                        )}
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4">
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField
                      label="Full Name"
                      value={editForm.name || ""}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      icon={User}
                      placeholder="Enter your name"
                    />
                    <InputField
                      label="Username"
                      value={editForm.username || ""}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      icon={User}
                      disabled
                      placeholder="Username"
                    />
                    <InputField
                      label="Email"
                      value={editForm.email || ""}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      icon={MailCheck}
                      placeholder="Enter email"
                    />
                    <InputField
                      label="Phone"
                      value={editForm.phone || ""}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      icon={PhoneCall}
                      placeholder="Enter phone"
                    />
                    <InputField
                      label="Store Name"
                      value={editForm.storeName || ""}
                      onChange={(e) => setEditForm({ ...editForm, storeName: e.target.value })}
                      icon={Building2}
                      disabled={!hasStorePermission}
                      placeholder="Store name"
                    />
                    <InputField
                      label="Store Address"
                      value={editForm.address || ""}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      icon={MapPinCheck}
                      disabled={!hasStorePermission}
                      placeholder="Store address"
                    />
                    {!hasStorePermission && (
                      <p className="text-[11px] sm:col-span-2" style={{ color: "var(--text-muted)" }}>
                        Store name / address change karne ke liye permission chahiye — admin ya kisi authorized staff member se rabta karein.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="mb-4">
                      <h4
                        className="text-[11px] font-bold uppercase tracking-wider mb-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Contact Information
                      </h4>
                      <InfoField icon={PhoneCall} label="Phone" value={profile.phone} />
                      <InfoField icon={MailCheck} label="Email" value={profile.email} isLink />
                      <InfoField icon={Building2} label="Store" value={profile.storeName} accent />
                      <InfoField icon={MapPinCheck} label="Address" value={profile.address} />
                    </div>

                    <div className="h-px mb-4" style={{ backgroundColor: "var(--border-color)" }} />

                    <div>
                      <h4
                        className="text-[11px] font-bold uppercase tracking-wider mb-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Basic Information
                      </h4>
                      <InfoField icon={User} label="Username" value={profile.username} />
                      <InfoField icon={Calendar} label="Member Since" value={profile.memberSince} />
                      <InfoField icon={ShieldCheck} label="Account" value="Active & Verified" accent />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
