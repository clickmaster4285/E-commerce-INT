"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
   REUSABLE PIECES  (Brand-page design language)
═══════════════════════════════════════════════ */

const InfoRow = ({ icon: Icon, label, value, isLink = false, accent = false }) => (
  <div
    className="flex items-start gap-3 py-2.5"
    style={{ borderBottom: "1px solid var(--border-color)" }}
  >
    <Icon
      size={15}
      className="mt-0.5 shrink-0"
      style={{ color: accent ? "#34d399" : "var(--text-muted)" }}
    />
    <span
      className="text-[12px] w-28 shrink-0 leading-snug"
      style={{ color: "var(--text-muted)" }}
    >
      {label}
    </span>
    <span
      className={`text-[13px] font-medium break-all leading-snug ${isLink ? "hover:underline cursor-pointer" : ""}`}
      style={{ color: isLink || accent ? "#34d399" : "var(--text-primary)" }}
    >
      {value || "—"}
    </span>
  </div>
);

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
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full h-9 rounded-md text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed ${Icon ? "pl-9 pr-3" : "px-3"}`}
        style={{
          backgroundColor: "var(--bg-tertiary)",
          border: "1px solid var(--border-color)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  </div>
);

const PasswordField = ({ label, value, onChange, show, toggle }) => (
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
        value={value}
        onChange={onChange}
        className="w-full h-9 rounded-md px-3 pr-9 text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          border: "1px solid var(--border-color)",
          color: "var(--text-primary)",
        }}
      />
      <button
        type="button"
        onClick={toggle}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 transition hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  </div>
);

/* Shared card style — identical to Brand page */
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

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const isSelfUpdating = useRef(false);

  /* ── build data from any user object format ── */
  const buildData = useCallback((u) => {
    if (!u) return null;
    const store = u.store || u.storeId || {};
    return {
      name: u.name || "Admin User",
      username: u.username || "admin",
      email: u.email || store.email || "",
      phone: u.phone || store.phone || "",
      role: u.role || "admin",
      avatar: u.avatar || null,
      memberSince:
        u.createdAt || u.created_at
          ? new Date(u.createdAt || u.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "N/A",
      joinDate:
        u.createdAt || u.created_at
          ? new Date(u.createdAt || u.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "N/A",
      lastLogin: u.last_login || u.lastLogin || "Today",
      storeName: store.store_name || u.store_name || "My Store",
      website: u.website || store.website || "",
      address: u.address || store.address || "",
      storeStatus: store.store_status || "Active",
      primaryColor: store.primary_color || "#10b981",
    };
  }, []);

  /* ── fetch profile via socket ── */
  const fetchProfile = useCallback(() => {
    if (!socket || !isConnected) return;
    console.log("🔄 Emitting getProfile...");
    socket.emit("getProfile");
  }, [socket, isConnected]);

  /* ── socket listeners ── */
  useEffect(() => {
    if (!socket || !isConnected) {
      if (!isConnected) {
        setLoading(false);
        setError("Socket not connected. Please refresh the page.");
      }
      return;
    }

    fetchProfile();

    const handleProfileData = (res) => {
      console.log("📥 profileData RAW:", JSON.stringify(res));
      if (!res) {
        setError("Empty response from server.");
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
        const d = buildData(userData);
        if (d) {
          setProfile(d);
          setEditForm(d);
          setLoading(false);
          setError("");
          console.log("✅ Profile loaded:", d.name, "| Store:", d.storeName);
        } else {
          setError("Failed to parse profile data.");
          setLoading(false);
        }
      } else {
        console.warn("⚠️ Unexpected profile data format:", res);
        setError("Unexpected data format. Check console for details.");
        setLoading(false);
      }
    };

    const handleProfileUpdated = (res) => {
      console.log("📥 profileUpdated RAW:", JSON.stringify(res));
      const userData = res?.data || res?.user || res;
      if (userData && (userData.name || userData._id)) {
        const d = buildData(userData);
        if (d) {
          setProfile(d);
          setEditForm(d);
          toast.success("Profile synced!");
        }
      }
      if (res?.store) {
        window.dispatchEvent(new CustomEvent("storeUpdated", { detail: res.store }));
      }
    };

    const handleStoreInfoChanged = (storeData) => {
      console.log("📥 storeInfoChangedForProfile:", storeData);
      if (!storeData) return;
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              storeName: storeData.store_name || prev.storeName,
              address: storeData.address || prev.address,
              email: storeData.email || prev.email,
              phone: storeData.phone || prev.phone,
              website: storeData.website || prev.website,
              storeStatus: storeData.store_status || prev.storeStatus,
              primaryColor: storeData.primary_color || prev.primaryColor,
            }
          : prev
      );
      setEditForm((prev) =>
        prev
          ? {
              ...prev,
              storeName: storeData.store_name || prev.storeName,
              address: storeData.address || prev.address,
              email: storeData.email || prev.email,
              phone: storeData.phone || prev.phone,
              website: storeData.website || prev.website,
            }
          : prev
      );
      toast.info("Store info synced from Store page!");
    };

    const handleStoreUpdated = (storeData) => {
      if (storeData) {
        window.dispatchEvent(new CustomEvent("storeUpdated", { detail: storeData }));
      }
    };

    const handleProfileError = (err) => {
      console.error("❌ profileError:", err);
      setError(err?.message || "Something went wrong.");
      setLoading(false);
    };

    socket.on("profileData", handleProfileData);
    socket.on("profileUpdated", handleProfileUpdated);
    socket.on("storeInfoChangedForProfile", handleStoreInfoChanged);
    socket.on("storeUpdated", handleStoreUpdated);
    socket.on("profileError", handleProfileError);

    return () => {
      socket.off("profileData", handleProfileData);
      socket.off("profileUpdated", handleProfileUpdated);
      socket.off("storeInfoChangedForProfile", handleStoreInfoChanged);
      socket.off("storeUpdated", handleStoreUpdated);
      socket.off("profileError", handleProfileError);
    };
  }, [socket, isConnected, buildData, fetchProfile]);

  /* ── SAVE PROFILE ── */
  const handleSaveProfile = () => {
    if (!socket || !isConnected) return toast.error("Server connection lost.");
    setIsSaving(true);
    const payload = {
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone,
      address: editForm.address,
      website: editForm.website,
      store_name: editForm.storeName,
    };
    console.log("📤 Saving profile + store:", payload);
    socket.emit("updateProfile", payload, (res) => {
      console.log("📥 Save callback RAW:", JSON.stringify(res));
      if (res?.success) {
        toast.success("Profile updated successfully!");
        setIsEditing(false);
        const userData = res.data || res.user || res;
        if (userData && (userData.name || userData._id)) {
          const d = buildData(userData);
          if (d) {
            setProfile(d);
            setEditForm(d);
          }
        }
        if (res.store) {
          window.dispatchEvent(new CustomEvent("storeUpdated", { detail: res.store }));
        }
      } else {
        toast.error(res?.message || "Failed to update profile");
      }
      setIsSaving(false);
    });
    setTimeout(() => {
      if (socket?.connected) socket.emit("getProfile");
    }, 2000);
  };

  /* ── CHANGE PASSWORD ── */
  const handleChangePassword = () => {
    if (!socket || !isConnected) return toast.error("Server connection lost.");
    if (!passwords.current || !passwords.new || !passwords.confirm)
      return toast.error("Please fill all password fields");
    if (passwords.new !== passwords.confirm)
      return toast.error("New passwords do not match");
    if (passwords.current === passwords.new)
      return toast.error("New password must differ from current");
    setIsChangingPassword(true);
    socket.emit(
      "changePassword",
      { currentPassword: passwords.current, newPassword: passwords.new },
      (res) => {
        if (res?.success) {
          toast.success("Password changed successfully!");
          setPasswords({ current: "", new: "", confirm: "" });
        } else {
          toast.error(res?.message || "Failed to change password");
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

  /* ── LOADING STATE ── */
  if (loading)
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-main)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#34d399" }} />
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Loading profile...
          </p>
        </div>
      </div>
    );

  /* ── ERROR STATE ── */
  if (error || !profile)
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: "var(--bg-main)" }}
      >
        <AlertCircle className="h-10 w-10" style={{ color: "rgba(239,68,68,0.7)" }} />
        <p
          className="text-[13px] font-medium text-center px-4"
          style={{ color: "var(--text-primary)" }}
        >
          {error || "Error Loading Profile"}
        </p>
        <button
          onClick={handleRetry}
          disabled={!isConnected}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-medium transition hover:opacity-80 disabled:opacity-40"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          <RefreshCw size={14} /> Retry
        </button>
        {!isConnected && (
          <p className="text-[12px]" style={{ color: "#f87171" }}>
            Socket disconnected — refresh the page
          </p>
        )}
      </div>
    );

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
                  background: "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(20,184,166,0.15))",
                }}
              >
                {profile.avatar ? (
                  <img src={profile.avatar} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <span
                    className="text-3xl sm:text-4xl font-bold select-none"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div
                className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: "#10b981",
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
                style={{ color: "#34d399" }}
              >
                {profile.role}
              </p>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1"
                style={{
                  backgroundColor: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                <Store size={12} style={{ color: "#34d399" }} />
                <span className="text-[12px] font-bold" style={{ color: "#34d399" }}>
                  {profile.storeName}
                </span>
                <span
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: "#34d399" }}
                />
                <span className="text-[12px] font-semibold" style={{ color: "#34d399" }}>
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
                <Lock size={15} style={{ color: "#34d399" }} />
                <h3
                  className="text-[12px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Security
                </h3>
              </div>
              <div className="space-y-3">
                <PasswordField
                  label="Current Password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  show={showPwd.current}
                  toggle={() => setShowPwd({ ...showPwd, current: !showPwd.current })}
                />
                <PasswordField
                  label="New Password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  show={showPwd.new}
                  toggle={() => setShowPwd({ ...showPwd, new: !showPwd.new })}
                />
                <PasswordField
                  label="Confirm Password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  show={showPwd.confirm}
                  toggle={() => setShowPwd({ ...showPwd, confirm: !showPwd.confirm })}
                />
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !isConnected}
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
                  <User size={16} style={{ color: "#34d399" }} />
                  <h3
                    className="text-[14px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    About Profile
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {!isEditing ? (
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
                        disabled={isSaving || !isConnected}
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
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          icon={User}
                        />
                        <InputField
                          label="Store Name"
                          value={editForm.storeName}
                          onChange={(e) => setEditForm({ ...editForm, storeName: e.target.value })}
                          icon={Store}
                        />
                        <InputField
                          label="Email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          icon={Mail}
                        />
                        <InputField
                          label="Phone"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          icon={Phone}
                        />
                        <InputField
                          label="Website"
                          value={editForm.website}
                          onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                          icon={Globe}
                        />
                        <InputField
                          label="Store Address"
                          value={editForm.address}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          icon={MapPin}
                        />
                      </div>
                    ) : (
                      <div className="mt-1">
                        <InfoRow icon={Phone} label="Phone:" value={profile.phone} accent />
                        <InfoRow icon={MapPin} label="Address:" value={profile.address} />
                        <InfoRow icon={Mail} label="E-mail:" value={profile.email} isLink accent />
                        <InfoRow icon={Globe} label="Website:" value={profile.website} isLink accent />
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