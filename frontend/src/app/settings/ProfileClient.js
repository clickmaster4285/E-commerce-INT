// src/app/settings/ProfileClient.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Lock, Store, ShieldCheck, Activity, Settings, 
  Camera, Save, CheckCircle2, AlertCircle, Smartphone,
  Mail, Phone, Globe, MapPin, Eye, EyeOff, Bell, Upload
} from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ProfileClient({ initialData }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabFromUrl = searchParams.get("tab") || "general";

  const generalRef = useRef(null);
  const securityRef = useRef(null);
  const storeRef = useRef(null);
  const permissionsRef = useRef(null);
  const activityRef = useRef(null);
  const preferencesRef = useRef(null);
  const fileInputRef = useRef(null);

  const [activeSection, setActiveSection] = useState(tabFromUrl);
  const [profile, setProfile] = useState(initialData);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const refs = { general: generalRef, security: securityRef, store: storeRef, permissions: permissionsRef, activity: activityRef, preferences: preferencesRef };
    const targetRef = refs[tabFromUrl];
    if (targetRef?.current) {
      setTimeout(() => {
        targetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveSection(tabFromUrl);
      }, 100);
    }
  }, [tabFromUrl]);

  // ✅ Generic field updater - ek hi function sab fields ke liye
  const updateField = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const updateStoreField = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setProfile(prev => ({ ...prev, avatar: URL.createObjectURL(file) }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setIsSaving(true);
    try {
      const payload = {
        name: profile.name, email: profile.email, phone: profile.phone,
        store: { name: profile.storeName, email: profile.storeEmail, phone: profile.storePhone, website: profile.website, address: profile.address },
        permissions: profile.permissions,
        preferences: { darkMode: profile.darkMode, notifications: profile.notifications },
      };
      const res = await apiFetch("/users/profile", { method: "PUT", body: JSON.stringify(payload) });
      setSuccess(res.message || "✅ Saved to MongoDB!");
    } catch (err) { setError("❌ " + err.message); }
    finally { setIsSaving(false); setTimeout(() => setSuccess(""), 4000); }
  };

  const handleChangePassword = async () => {
    setError(""); setSuccess("");
    if (!passwords.current || !passwords.new || !passwords.confirm) return setError("Fill all fields");
    if (passwords.new !== passwords.confirm) return setError("Passwords don't match");
    if (passwords.new.length < 6) return setError("Min 6 characters");
    setIsSaving(true);
    try {
      const res = await apiFetch("/users/password", { method: "PUT", body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new }) });
      setSuccess(res.message || "✅ Password changed!");
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (err) { setError("❌ " + err.message); }
    finally { setIsSaving(false); setTimeout(() => setSuccess(""), 3000); }
  };

  const handle2FAToggle = async () => {
    const newValue = !profile.twoFactor;
    setProfile(p => ({ ...p, twoFactor: newValue }));
    try {
      await apiFetch("/users/2fa", { method: "PUT", body: JSON.stringify({ enabled: newValue }) });
      setSuccess("✅ 2FA updated!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setProfile(p => ({ ...p, twoFactor: !newValue })); setError("❌ " + err.message); }
  };

  // ✅ Reusable input CLASS string (component nahi, sirf class)
  const inputClass = "w-full rounded-md border border-[var(--border-sidebar)] bg-[var(--bg-main)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-emerald-500";
  const inputClassWithIcon = "w-full rounded-md border border-[var(--border-sidebar)] bg-[var(--bg-main)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-emerald-500";
  const labelClass = "block text-xs font-medium text-[var(--text-secondary)] mb-1";

  const TABS = [
    { id: 'general', label: 'General' }, { id: 'security', label: 'Security' },
    { id: 'store', label: 'Store' }, { id: 'permissions', label: 'Permissions' },
    { id: 'activity', label: 'Activity' }, { id: 'preferences', label: 'Preferences' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-20 md:pb-10">
      <div className="border-b border-[var(--border-sidebar)] px-6 py-4 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Account Settings</h1>
          <p className="text-xs text-[var(--text-muted)]">All changes save to MongoDB via secure HttpOnly cookies.</p>
        </div>
      </div>

      <div className="md:hidden sticky top-0 z-40 bg-[var(--bg-main)]/95 backdrop-blur-sm border-b border-[var(--border-sidebar)] overflow-x-auto no-scrollbar">
        <div className="flex px-4 gap-2 py-2.5 min-w-max">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => router.push(`?tab=${tab.id}`, { scroll: false })}
              className={`text-xs font-medium whitespace-nowrap px-3.5 py-1.5 rounded-full transition-all ${
                activeSection === tab.id ? 'bg-emerald-500 text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--bg-sidebar-hover)]'
              }`}>{tab.label}</button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className="mx-auto max-w-6xl space-y-6 px-4 py-4 sm:px-6 md:px-8">
        {(error || success) && (
          <div className={`flex items-center gap-2 rounded-md p-3 text-xs font-medium ${
            error ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
          }`}>
            {error ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />} {error || success}
          </div>
        )}

        {/* ========== GENERAL ========== */}
        <section ref={generalRef} id="general" className="space-y-3 scroll-mt-20 md:scroll-mt-16">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Profile Information</h2>
          <div className="rounded-lg border border-[var(--border-sidebar)] bg-[var(--bg-main)] p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              
              {/* ✅ DIRECT INPUT - No component wrapper */}
              <div>
                <label className={labelClass}>Full Name</label>
                <input type="text" value={profile.name || ""} onChange={(e) => updateField('name', e.target.value)} className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Username</label>
                <input type="text" value={profile.username || ""} disabled className={`${inputClass} opacity-60 cursor-not-allowed`} />
              </div>

              <div>
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                  <input type="email" value={profile.email || ""} onChange={(e) => updateField('email', e.target.value)} className={inputClassWithIcon} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Phone Number</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                  <input type="tel" value={profile.phone || ""} onChange={(e) => updateField('phone', e.target.value)} className={inputClassWithIcon} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Role</label>
                <div className="flex items-center justify-between rounded-md border border-[var(--border-sidebar)] bg-[var(--bg-sidebar-hover)] px-3 py-2 text-sm text-[var(--text-muted)]">
                  {profile.role} <ShieldCheck size={14} className="text-emerald-500" />
                </div>
              </div>

              <div>
                <label className={labelClass}>Status</label>
                <div className="flex items-center gap-2 rounded-md border border-[var(--border-sidebar)] bg-[var(--bg-sidebar-hover)] px-3 py-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  <span className="text-emerald-500">{profile.status}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border-sidebar)] bg-[var(--bg-main)] p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><Camera size={16} className="text-emerald-500" /><h2 className="text-sm font-semibold text-[var(--text-primary)]">Profile Photo</h2></div>
            <div className="flex items-center gap-4">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {profile.avatar ? <img src={profile.avatar} alt="" className="h-16 w-16 rounded-xl object-cover border-2 border-[var(--border-sidebar)]" /> :
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl font-bold text-white">{profile.name?.charAt(0)}</div>}
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"><Upload size={16} className="text-white" /></div>
              </div>
              <div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600">Upload New</button>
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">JPG, PNG or GIF. Max 2MB.</p>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>
            </div>
          </div>
        </section>

        {/* ========== SECURITY ========== */}
        <section ref={securityRef} id="security" className="space-y-3 scroll-mt-20 md:scroll-mt-16">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Security</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[var(--border-sidebar)] bg-[var(--bg-main)] p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2"><Lock size={16} className="text-emerald-500" /><h2 className="text-sm font-semibold text-[var(--text-primary)]">Change Password</h2></div>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Current Password</label>
                  <div className="relative">
                    <input type={showPassword.current ? "text" : "password"} value={passwords.current} onChange={(e) => setPasswords({...passwords, current: e.target.value})} className={`${inputClass} pr-9`} />
                    <button type="button" onClick={() => setShowPassword({...showPassword, current: !showPassword.current})} className="absolute right-3 top-2.5 text-[var(--text-muted)]">{showPassword.current ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>New Password</label>
                    <div className="relative">
                      <input type={showPassword.new ? "text" : "password"} value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})} className={`${inputClass} pr-9`} />
                      <button type="button" onClick={() => setShowPassword({...showPassword, new: !showPassword.new})} className="absolute right-3 top-2.5 text-[var(--text-muted)]">{showPassword.new ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Confirm Password</label>
                    <div className="relative">
                      <input type={showPassword.confirm ? "text" : "password"} value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm: e.target.value})} className={`${inputClass} pr-9`} />
                      <button type="button" onClick={() => setShowPassword({...showPassword, confirm: !showPassword.confirm})} className="absolute right-3 top-2.5 text-[var(--text-muted)]">{showPassword.confirm ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={handleChangePassword} disabled={isSaving || !passwords.new}
                  className="w-full rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-50">
                  {isSaving ? "Changing..." : "Update Password"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-[var(--border-sidebar)] bg-[var(--bg-main)] p-5 shadow-sm">
                <div><h3 className="text-sm font-medium text-[var(--text-primary)]">Two-Factor Auth</h3><p className="text-xs text-[var(--text-muted)]">Saved to DB on toggle</p></div>
                <button type="button" onClick={handle2FAToggle} className={`relative h-5 w-9 rounded-full transition-colors ${profile.twoFactor ? "bg-emerald-500" : "bg-[var(--border-sidebar)]"}`}>
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${profile.twoFactor ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div className="rounded-lg border border-[var(--border-sidebar)] bg-[var(--bg-main)] p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2"><Activity size={16} className="text-emerald-500" /><h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Session</h3></div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-[var(--bg-sidebar)] p-2"><Smartphone size={14} className="text-[var(--text-secondary)]" /></div>
                    <div><p className="text-xs font-medium text-[var(--text-primary)]">Chrome on Windows</p><p className="text-[10px] text-[var(--text-muted)]">Active now</p></div>
                  </div>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== STORE ========== */}
        <section ref={storeRef} id="store" className="space-y-3 scroll-mt-20 md:scroll-mt-16">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Store Information</h2>
          <div className="rounded-lg border border-[var(--border-sidebar)] bg-[var(--bg-main)] p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Store Name</label>
                <div className="relative">
                  <Store size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                  <input type="text" value={profile.storeName || ""} onChange={(e) => updateStoreField('storeName', e.target.value)} className={inputClassWithIcon} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Store Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                  <input type="email" value={profile.storeEmail || ""} onChange={(e) => updateStoreField('storeEmail', e.target.value)} className={inputClassWithIcon} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Store Phone</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                  <input type="tel" value={profile.storePhone || ""} onChange={(e) => updateStoreField('storePhone', e.target.value)} className={inputClassWithIcon} />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Website URL</label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                  <input type="url" value={profile.website || ""} onChange={(e) => updateStoreField('website', e.target.value)} className={inputClassWithIcon} />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Address</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                  <textarea rows={2} value={profile.address || ""} onChange={(e) => updateStoreField('address', e.target.value)} className="w-full rounded-md border border-[var(--border-sidebar)] bg-[var(--bg-main)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-emerald-500 resize-none" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== PERMISSIONS ========== */}
        <section ref={permissionsRef} id="permissions" className="space-y-3 scroll-mt-20 md:scroll-mt-16">
          <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold text-[var(--text-primary)]">Permissions</h2><span className="text-[10px] text-[var(--text-muted)]">Role: {profile.role}</span></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Object.entries(profile.permissions || {}).map(([key, value]) => (
              <label key={key} className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-[var(--border-sidebar)] bg-[var(--bg-main)] p-4 shadow-sm transition-all hover:border-emerald-500/50 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/5">
                <input type="checkbox" checked={value} onChange={(e) => setProfile({...profile, permissions: {...profile.permissions, [key]: e.target.checked}})} className="h-3.5 w-3.5 rounded text-emerald-500" />
                <span className="text-[10px] font-medium capitalize text-[var(--text-secondary)]">{key}</span>
              </label>
            ))}
          </div>
        </section>

        {/* ========== ACTIVITY ========== */}
        <section ref={activityRef} id="activity" className="space-y-3 scroll-mt-20 md:scroll-mt-16">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Recent Activity</h2>
          <div className="rounded-lg border border-[var(--border-sidebar)] bg-[var(--bg-main)] p-3 shadow-sm">
            {(profile.activityLog?.length ? profile.activityLog.slice(-5).reverse() : [{action:"No activity yet", item:"", timestamp: new Date()}]).map((log, i) => (
              <div key={i} className="flex items-center justify-between border-b border-[var(--border-sidebar)] px-2 py-2.5 last:border-0">
                <div className="flex items-center gap-2"><div className="h-1 w-1 rounded-full bg-emerald-500"></div>
                  <span className="text-xs text-[var(--text-primary)]"><span className="font-medium">{log.action}</span> {log.item && <span className="text-[var(--text-muted)]">— {log.item}</span>}</span></div>
                <span className="text-[10px] text-[var(--text-muted)]">{new Date(log.timestamp).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ========== PREFERENCES ========== */}
        <section ref={preferencesRef} id="preferences" className="space-y-3 scroll-mt-20 md:scroll-mt-16">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Preferences</h2>
          <div className="rounded-lg border border-[var(--border-sidebar)] bg-[var(--bg-main)] p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><Settings size={16} className="text-emerald-500" /><h2 className="text-sm font-semibold text-[var(--text-primary)]">Appearance</h2></div>
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-medium text-[var(--text-primary)]">Dark Mode</p><p className="text-[10px] text-[var(--text-muted)]">Saved to MongoDB</p></div>
              <button type="button" onClick={() => setProfile({...profile, darkMode: !profile.darkMode})} className={`relative h-5 w-9 rounded-full transition-colors ${profile.darkMode ? "bg-emerald-500" : "bg-[var(--border-sidebar)]"}`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${profile.darkMode ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border-sidebar)] bg-[var(--bg-main)] p-5 shadow-sm mt-4">
            <div className="mb-3 flex items-center gap-2"><Bell size={16} className="text-emerald-500" /><h2 className="text-sm font-semibold text-[var(--text-primary)]">Notifications</h2></div>
            <div className="space-y-2.5">
              {[{ key: 'email', label: 'Email Notifications' }, { key: 'push', label: 'Push Notifications' }, { key: 'weekly', label: 'Weekly Reports' }].map((pref) => (
                <div key={pref.key} className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">{pref.label}</span>
                  <input type="checkbox" checked={profile.notifications?.[pref.key]} onChange={(e) => setProfile({ ...profile, notifications: { ...profile.notifications, [pref.key]: e.target.checked } })} className="h-3.5 w-3.5 rounded text-emerald-500" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border-sidebar)] sticky bottom-0 bg-[var(--bg-main)]/95 backdrop-blur-sm py-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:static">
          <button type="button" onClick={() => router.back()} className="rounded-md px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-sidebar-hover)]">Cancel</button>
          <button type="submit" disabled={isSaving} className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50 shadow-lg shadow-emerald-500/20">
            <Save size={12} /> {isSaving ? "Saving to DB..." : "Save All Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}