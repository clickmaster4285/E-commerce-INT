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
} from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════
   REUSABLE COMPONENTS
═══════════════════════════════════════════════ */

const InfoRow = ({ icon: Icon, label, value, isLink = false, accent = false }) => {
  const displayValue = value || "—";
  return (
    <div
      className="flex items-start gap-3 py-2.5"
      style={{ borderBottom: "1px solid var(--border-color)" }}
    >
      <Icon
        size={15}
        className="mt-0.5 shrink-0"
        style={{ color: accent ? "var(--accent)" : "var(--text-muted)" }}
      />
      <span
        className="text-[12px] w-28 shrink-0 leading-snug"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span
        className={`text-[13px] font-medium break-all leading-snug ${isLink ? "hover:underline cursor-pointer" : ""}`}
        style={{ color: isLink || accent ? "var(--accent)" : "var(--text-primary)" }}
      >
        {displayValue}
      </span>
    </div>
  );
};

const InputField = ({ label, value, onChange, type = "text", icon: Icon, disabled }) => (
  <div className="space-y-1.5">
    <label
      className="block text-[12px] font-medium"
      style={{ color: "var(--text-secondary)" }}
    >
      {label}
    </label>
    <div className="relative">
      {Icon && (
        <Icon
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        />
      )}
      <input
        type={type}
        value={value || ""}
        onChange={onChange}
        disabled={disabled}
        className={`w-full h-10 md:h-9 rounded-md text-[16px] md:text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed ${Icon ? "pl-9 pr-3" : "px-3"}`}
        style={{
          backgroundColor: "var(--bg-tertiary)",
          border: "1px solid var(--border-color)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  </div>
);

const PasswordField = ({ label, value, onChange, show, toggle, disabled }) => (
  <div className="space-y-1.5">
    <label
      className="block text-[12px] font-medium"
      style={{ color: "var(--text-secondary)" }}
    >
      {label}
    </label>
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        placeholder="••••••••"
        value={value || ""}
        onChange={onChange}
        disabled={disabled}
        className="w-full h-10 md:h-9 rounded-md px-3 pr-9 text-[16px] md:text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed"
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
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);

  // ✅ CHANGE 1: Track permissions from server
  const [hasProfilePermission, setHasProfilePermission] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  /* ── build data from any user object ── */
  const buildData = useCallback((user) => {
    if (!user) return null;
    const store = user.store || user.storeId || {};
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
      storeName: store.store_name || user.store_name || "My Store",
      address: user.address || store.address || "",
      storeStatus: store.store_status || "Active",
      primaryColor: store.primary_color || "var(--accent)",
      // ✅ CHANGE 1 continued: Extract permissions
      permissions: user.permissions || {},
    };
  }, []);

  /* ── fetch profile via socket ── */
  const fetchProfile = useCallback(() => {
    if (!socket || !isConnected) return;
    socket.emit("getProfile");
  }, [socket, isConnected]);

  /* ── socket listeners ── */
  useEffect(() => {
    if (!socket || !isConnected) {
      setLoading(false);
      return;
    }

    fetchProfile();

    const handleProfileData = (res) => {
      if (!res) {
        setLoading(false);
        return;
      }
      if (res.success === false) {
        setError(res.message || "Failed to load profile.");
        setLoading(false);
        return;
      }
      const userData = res.data || res.user || res;
      if (userData && (userData.name || userData._id || userData.email)) {
        const data = buildData(userData);
        if (data) {
          setProfile(data);
          setEditForm(data);
          // ✅ CHANGE 1 continued: Set permission state
          const perms = userData.permissions || data.permissions || {};
          const role = userData.role || data.role || "";
          // Admin always has permission, staff needs permissions.profile
          if (role === "admin") {
            setHasProfilePermission(true);
          } else {
            setHasProfilePermission(perms.profile !== false);
          }
          setLoading(false);
          setError("");
          return;
        }
      }
      setLoading(false);
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
      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          storeName: storeData.store_name || prev.storeName,
          address: storeData.address || prev.address,
          email: storeData.email || prev.email,
          phone: storeData.phone || prev.phone,
          storeStatus: storeData.store_status || prev.storeStatus,
          primaryColor: storeData.primary_color || prev.primaryColor,
        };
      });
      setEditForm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          storeName: storeData.store_name || prev.storeName,
          address: storeData.address || prev.address,
          email: storeData.email || prev.email,
          phone: storeData.phone || prev.phone,
        };
      });
      toast.info("Store info synced from Store page!");
    };

    const handleProfileError = (err) => {
      setLoading(false);
    };

    socket.on("profileData", handleProfileData);
    socket.on("profileUpdated", handleProfileUpdated);
    socket.on("storeInfoChangedForProfile", handleStoreInfoChanged);
    socket.on("profileError", handleProfileError);

    return () => {
      socket.off("profileData", handleProfileData);
      socket.off("profileUpdated", handleProfileUpdated);
      socket.off("storeInfoChangedForProfile", handleStoreInfoChanged);
      socket.off("profileError", handleProfileError);
    };
  }, [socket, isConnected, buildData, fetchProfile]);

  /* ── SAVE PROFILE ── */
  const handleSaveProfile = () => {
    if (!socket || !isConnected) {
      return;
    }

    // ✅ CHANGE 2: Permission check before save
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
      address: editForm.address || "",
      store_name: editForm.storeName || "",
    };
    socket.emit("updateProfile", payload, (res) => {
      if (res?.success) {
        toast.success("Profile updated successfully!");
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
        // ✅ Permission error from server
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

    // ✅ CHANGE 3: Permission check before password change
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
          <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: "#ef4444" }} />
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
      <div className="w-full space-y-5">

        {/* ══ HEADER — Avatar + Name + Role + Store Badge ══ */}
        <div className="rounded-lg overflow-hidden" style={cardStyle}>
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
              <p
                className="text-[13px] font-semibold mb-2.5"
                style={{ color: "var(--accent)" }}
              >
                {profile.role}
              </p>
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

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-4 space-y-4">

            {/* Account Info Card */}
            <div className="rounded-lg p-5" style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <Info size={15} style={{ color: "var(--text-muted)" }} />
                <h3
                  className="text-[12px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Account Info
                </h3>
              </div>
              <InfoRow icon={Calendar} label="Joined:" value={profile.joinDate} />
              <InfoRow icon={Clock} label="Last Login:" value={profile.lastLogin} />
              <InfoRow icon={Award} label="Role:" value={profile.role} accent />
              <InfoRow icon={ShieldCheck} label="Status:" value="Active & Verified" accent />
            </div>

            {/* Security Card */}
            <div className="rounded-lg p-5" style={cardStyle}>
              <div className="flex items-center gap-2 mb-4">
                <Lock size={15} style={{ color: "var(--accent)" }} />
                <h3
                  className="text-[12px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Security
                </h3>
              </div>

              {/* ✅ CHANGE 3: Show permission warning if no access */}
              {!hasProfilePermission && (
                <div className="mb-3 flex items-center gap-2 rounded-md px-3 py-2" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertCircle size={14} style={{ color: "#f87171" }} />
                  <p className="text-[11px]" style={{ color: "#f87171" }}>You don't have permission to change password</p>
                </div>
              )}

              <div className="space-y-3">
                <PasswordField
                  label="Current Password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  show={showPwd.current}
                  toggle={() => setShowPwd({ ...showPwd, current: !showPwd.current })}
                  disabled={!hasProfilePermission}
                />
                <PasswordField
                  label="New Password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  show={showPwd.new}
                  toggle={() => setShowPwd({ ...showPwd, new: !showPwd.new })}
                  disabled={!hasProfilePermission}
                />
                <PasswordField
                  label="Confirm Password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  show={showPwd.confirm}
                  toggle={() => setShowPwd({ ...showPwd, confirm: !showPwd.confirm })}
                  disabled={!hasProfilePermission}
                />
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !isConnected || !hasProfilePermission}
                    className="flex items-center gap-2 h-9 px-4 rounded-md text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    {isChangingPassword ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Lock size={14} />
                    )}
                    {isChangingPassword ? "Updating…" : "Update Password"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN — About Profile ── */}
          <div className="lg:col-span-8">
            <div className="rounded-lg overflow-hidden h-full" style={cardStyle}>

              {/* Card Header with Edit / Save */}
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid var(--border-color)" }}
              >
                <div className="flex items-center gap-2.5">
                  <User size={16} style={{ color: "var(--accent)" }} />
                  <h3
                    className="text-[14px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    About Profile
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    // ✅ CHANGE 2: Disable Edit button if no permission
                    hasProfilePermission ? (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 h-9 px-3.5 rounded-md text-[13px] font-medium transition hover:opacity-80"
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
                        className="flex items-center gap-1.5 h-9 px-3.5 rounded-md text-[13px] font-medium opacity-40 cursor-not-allowed"
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
                        className="h-9 w-9 rounded-md flex items-center justify-center transition hover:opacity-70"
                        style={{
                          backgroundColor: "var(--bg-tertiary)",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-muted)",
                        }}
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSaving || !isConnected || !hasProfilePermission}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-md text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                        style={{ backgroundColor: "var(--accent)" }}
                      >
                        {isSaving ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Save size={14} />
                        )}
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5">
                <div className="space-y-5">

                  {/* Contact Information */}
                  <div>
                    <h4
                      className="text-[12px] font-semibold uppercase tracking-wider mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Contact Information
                    </h4>
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <InputField
                          label="Full Name"
                          value={editForm.name || ""}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          icon={User}
                        />
                        <InputField
                          label="Store Name"
                          value={editForm.storeName || ""}
                          onChange={(e) => setEditForm({ ...editForm, storeName: e.target.value })}
                          icon={Store}
                        />
                        <InputField
                          label="Email"
                          value={editForm.email || ""}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          icon={Mail}
                        />
                        <InputField
                          label="Phone"
                          value={editForm.phone || ""}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          icon={Phone}
                        />
                        <InputField
                          label="Store Address"
                          value={editForm.address || ""}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          icon={MapPin}
                        />
                      </div>
                    ) : (
                      <div className="mt-1">
                        <InfoRow icon={Phone} label="Phone:" value={profile.phone} accent />
                        <InfoRow icon={MapPin} label="Address:" value={profile.address} />
                        <InfoRow icon={Mail} label="E-mail:" value={profile.email} isLink accent />
                        <InfoRow icon={Store} label="Store:" value={profile.storeName} accent />
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-px" style={{ backgroundColor: "var(--border-color)" }} />

                  {/* Basic Information */}
                  <div>
                    <h4
                      className="text-[12px] font-semibold uppercase tracking-wider mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Basic Information
                    </h4>
                    <div className="mt-1">
                      <InfoRow icon={User} label="Username:" value={profile.username} />
                      <InfoRow icon={Award} label="Role:" value={profile.role} accent />
                      <InfoRow icon={Calendar} label="Member Since:" value={profile.memberSince} />
                      <InfoRow icon={ShieldCheck} label="Account:" value="Active & Verified" accent />
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}