"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosInstance from "@/apis/axiosInstance";
import { addressApi } from "@/apis/user/addressApi";
import { useWishlist } from "@/components/user/WishlistContext";
import { Country, State, City } from "country-state-city";
import {
  LayoutDashboard, Package, MapPin, Settings, LogOut, User, Phone, Lock,
  Plus, Pencil, Trash2, Heart, ShoppingBag, Calendar, ArrowRight, Loader2,
  X, CheckCircle2, Clock, Truck, XCircle, Eye, EyeOff, ShieldCheck,
  Star, Save, ChevronDown, ChevronRight
} from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImgUrl = (img) => {
  const raw = typeof img === "string" ? img : img?.img_url;
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  return `${API_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
};
const fmt = (n) => `Rs. ${Math.round(n).toLocaleString()}`;

const STATUS_CONFIG = {
  pending:   { label: "Pending",   icon: Clock,        color: "text-amber-500",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, color: "text-blue-500",    bg: "bg-blue-500/10",    border: "border-blue-500/30" },
  processing:{ label: "Processing",icon: Package,      color: "text-cyan-500",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30" },
  shipped:   { label: "Shipped",   icon: Truck,        color: "text-indigo-500",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30" },
  delivered: { label: "Delivered", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  cancelled: { label: "Cancelled", icon: XCircle,      color: "text-red-500",     bg: "bg-red-500/10",     border: "border-red-500/30" },
};

/* ============ SIDEBAR NAV (AliExpress style) — DESKTOP ============ */
function SidebarNav({ user, avatarLetter, tab, orderFilter, wishlistCount, onNavigate, onExternal, onLogout }) {
  const [openGroups, setOpenGroups] = useState({ orders: true });

  const orderItems = [
    { filter: "all", label: "All Orders" },
    { filter: "pending", label: "Pending" },
    { filter: "processing", label: "To be Shipped" },
    { filter: "shipped", label: "Shipped" },
    { filter: "delivered", label: "Delivered" },
    { filter: "cancelled", label: "Cancelled" },
  ];

  const itemCls = (active) =>
    `w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold transition ${
      active ? "bg-[var(--user-accent)] text-[var(--user-accent-text)]" : "text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)]"
    }`;

  return (
    <div className="rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] overflow-hidden">
      <div className="p-4 border-b border-[var(--user-border)] flex items-center gap-3">
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full border-2 border-[var(--user-accent)] object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)] text-base font-black flex items-center justify-center">{avatarLetter}</div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-black text-[var(--user-text)] truncate capitalize">{user.name || user.username}</p>
          <p className="text-[10px] text-[var(--user-text-muted)] truncate">{user.email}</p>
        </div>
      </div>

      <nav className="p-2">
        <button onClick={() => onNavigate("overview")} className={itemCls(tab === "overview")}>
          <LayoutDashboard size={15} /> Overview
        </button>

        <button
          onClick={() => setOpenGroups(g => ({ ...g, orders: !g.orders }))}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)] transition"
        >
          <span className="flex items-center gap-2.5"><Package size={15} /> My Orders</span>
          <ChevronDown size={14} className={`transition-transform ${openGroups.orders ? "rotate-180" : ""}`} />
        </button>
        {openGroups.orders && (
          <div className="ml-4 pl-3 border-l border-[var(--user-border)] space-y-0.5 py-1">
            {orderItems.map(o => (
              <button
                key={o.filter}
                onClick={() => onNavigate("orders", o.filter)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-semibold transition ${
                  tab === "orders" && orderFilter === o.filter
                    ? "bg-[var(--user-accent)]/10 text-[var(--user-accent)]"
                    : "text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)]"
                }`}
              >
                {o.label}
                {tab === "orders" && orderFilter === o.filter && <ChevronRight size={12} />}
              </button>
            ))}
          </div>
        )}

        <button onClick={() => onExternal("/wishlist")} className={itemCls(false)}>
          <Heart size={15} /> Wish List
          {wishlistCount > 0 && (
            <span className="ml-auto text-[10px] bg-[var(--user-accent)] text-[var(--user-accent-text)] px-1.5 py-0.5 rounded-full">{wishlistCount}</span>
          )}
        </button>

        <button onClick={() => onNavigate("addresses")} className={itemCls(tab === "addresses")}>
          <MapPin size={15} /> Shipping Address
        </button>

        <button onClick={() => onNavigate("settings")} className={itemCls(tab === "settings")}>
          <Settings size={15} /> Settings
        </button>

        <div className="h-px bg-[var(--user-border)] my-2" />
        <button onClick={onLogout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold text-[var(--user-danger)] hover:bg-[var(--user-danger)]/10 transition">
          <LogOut size={15} /> Logout
        </button>
      </nav>
    </div>
  );
}

/* ============ ADDRESS FORM MODAL ============ */
const AddressFormModal = ({ address, onClose, onSaved }) => {
  const [form, setForm] = useState(address ? {
    full_name: address.full_name || "", phone: address.phone || "", country: address.country || "",
    state: address.state || "", city: address.city || "", street_address1: address.street_address1 || "",
    street_address2: address.street_address2 || "", zip_code: address.zip_code || "",
    delivery_instructions: address.delivery_instructions || "", is_default: !!address.is_default,
  } : {
    full_name: "", phone: "", country: "", state: "", city: "", street_address1: "",
    street_address2: "", zip_code: "", delivery_instructions: "", is_default: false,
  });
  const [saving, setSaving] = useState(false);

  const allCountries = Country.getAllCountries();
  const allStates = (() => { const c = allCountries.find(x => x.name === form.country); return c ? State.getStatesOfCountry(c.isoCode) : []; })();
  const allCities = (() => { const c = allCountries.find(x => x.name === form.country); const s = allStates.find(x => x.name === form.state); return c && s ? City.getCitiesOfState(c.isoCode, s.isoCode) : []; })();

  const inputCls = "w-full h-10 px-3 rounded-lg text-sm outline-none transition focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border border-[var(--user-border)] text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)]";
  const labelCls = "block text-[11px] font-bold text-[var(--user-text-secondary)] mb-1.5 uppercase tracking-wider";

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.phone.trim() || !form.country || !form.state || !form.city || !form.street_address1.trim()) {
      toast.error("Please fill all required fields"); return;
    }
    setSaving(true);
    try {
      if (address) await addressApi.update(address._id, form);
      else await addressApi.create(form);
      toast.success(address ? "Address updated!" : "Address added!");
      onSaved();
    } catch (e) { toast.error(e.response?.data?.message || "Failed to save address"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[var(--user-bg-card)] border-t-2 sm:border-2 border-[var(--user-border)] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-5 py-3.5 border-b-2 border-[var(--user-border)] bg-[var(--user-bg-card)]/95">
          <h2 className="text-sm font-black text-[var(--user-text)]">{address ? "Edit Address" : "Add New Address"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-[var(--user-border)] text-[var(--user-text-muted)] hover:text-[var(--user-text)] transition flex items-center justify-center"><X size={15} /></button>
        </div>
        <div className="p-4 sm:p-5 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Full Name *</label><input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Ahsan Khan" className={inputCls} /></div>
            <div><label className={labelCls}>Phone *</label><input type="tel" value={form.phone} maxLength={14} onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g,"").slice(0,14)})} placeholder="03001234567" className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Country *</label>
            <select value={form.country} onChange={e => setForm({...form, country: e.target.value, state:"", city:""})} className={inputCls+" appearance-none cursor-pointer"}>
              <option value="">Select country</option>
              {allCountries.map(c => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelCls}>State *</label><select value={form.state} onChange={e => setForm({...form, state: e.target.value, city:""})} disabled={!form.country} className={inputCls+" disabled:opacity-50"}><option value="">Select</option>{allStates.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select></div>
            <div><label className={labelCls}>City *</label><select value={form.city} onChange={e => setForm({...form, city: e.target.value})} disabled={!form.state} className={inputCls+" disabled:opacity-50"}><option value="">Select</option>{allCities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></div>
            <div><label className={labelCls}>ZIP</label><input value={form.zip_code} onChange={e => setForm({...form, zip_code: e.target.value})} placeholder="54000" className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Street Address *</label><textarea value={form.street_address1} onChange={e => setForm({...form, street_address1: e.target.value})} rows="2" placeholder="Street address" className={inputCls+" resize-none py-2.5"} /></div>
          <div><label className={labelCls}>Delivery Instructions</label><textarea value={form.delivery_instructions} onChange={e => setForm({...form, delivery_instructions: e.target.value})} rows="2" placeholder="Notes, access codes" className={inputCls+" resize-none py-2.5"} /></div>
          <label className="flex items-center gap-2 text-sm text-[var(--user-text)] cursor-pointer pt-1">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm({...form, is_default: e.target.checked})} className="w-4 h-4 rounded" style={{ accentColor: "var(--user-accent)" }} />
            Make this my default address
          </label>
        </div>
        <div className="sticky bottom-0 px-4 sm:px-5 py-3 border-t-2 border-[var(--user-border)] bg-[var(--user-bg-card)]/95 flex gap-2" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <button onClick={onClose} className="flex-1 h-10 sm:h-9 rounded-lg border border-[var(--user-border)] text-xs font-bold text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 h-10 sm:h-9 rounded-lg bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-black flex items-center justify-center gap-1.5 hover:opacity-90 transition disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Address
          </button>
        </div>
      </div>
    </div>
  );
};

export default function AccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { count: wishlistCount } = useWishlist();
  
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "overview";
    return new URLSearchParams(window.location.search).get("tab") || "overview";
  });

  // ✅ URL change + event dono suno — FIX APPLIED
  useEffect(() => {
    const checkUrlTab = () => {
      const urlTab = new URLSearchParams(window.location.search).get("tab");
      if (urlTab && urlTab !== tab) setTab(urlTab);
    };

    const onTab = (e) => { 
      if (e.detail && e.detail !== tab) {
        setTab(e.detail);
        // URL bhi update karo
        const url = new URL(window.location);
        url.searchParams.set("tab", e.detail);
        window.history.pushState({}, "", url);
      }
    };

    // Initial check
    checkUrlTab();

    // URL change hone pe check karo
    window.addEventListener("popstate", checkUrlTab);
    
    // Custom event suno
    window.addEventListener("account:tab", onTab);
    
    return () => {
      window.removeEventListener("popstate", checkUrlTab);
      window.removeEventListener("account:tab", onTab);
    };
  }, [tab]);

  const [orderFilter, setOrderFilter] = useState("all");
  const [openSection, setOpenSection] = useState(null);

  const [profileForm, setProfileForm] = useState(null);
  const [phoneForm, setPhoneForm] = useState("");
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editAddress, setEditAddress] = useState(null);
  const [deleteAddressId, setDeleteAddressId] = useState(null);

  const { data: user = null, isLoading: userLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => { const res = await axiosInstance.get("/users/profile"); return res.data?.user || res.data; },
    retry: false,
  });
  const { data: orders = [] } = useQuery({ queryKey: ["myOrders"], queryFn: async () => { const res = await axiosInstance.get("/orders/my"); return res.data?.data || []; }, enabled: !!user });
  const { data: addresses = [] } = useQuery({ queryKey: ["addresses"], queryFn: addressApi.getAll, enabled: !!user });

  if (userLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[var(--user-accent)]" size={28} /></div>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center mb-5"><User size={28} className="text-[var(--user-accent)] opacity-60" /></div>
        <h1 className="text-lg font-bold text-[var(--user-text)] mb-2">Login Required</h1>
        <p className="text-sm text-[var(--user-text-muted)] mb-6">Please login to view your account.</p>
        <Link href="/login?redirect=/account" className="inline-block bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 transition">Login to Your Account</Link>
      </div>
    );
  }

  const avatarLetter = (user.name || user.email || "U").charAt(0).toUpperCase();
  const memberSince = user.created_at ? new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "";
  const activeCount = orders.filter(o => !["delivered","cancelled"].includes(o.status)).length;

  const refreshUser = () => queryClient.invalidateQueries({ queryKey: ["userProfile"] });
  const refreshAddresses = () => queryClient.invalidateQueries({ queryKey: ["addresses"] });

  const navigate = (tabId, filter) => { 
    setTab(tabId); 
    if (filter) setOrderFilter(filter); 
    // URL update karo
    const url = new URL(window.location);
    url.searchParams.set("tab", tabId);
    if (filter) url.searchParams.set("filter", filter);
    window.history.pushState({}, "", url);
  };
  const external = (href) => router.push(href);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await axiosInstance.put("/users/profile", { name: profileForm.name, username: profileForm.username });
      refreshUser(); toast.success("Profile updated!"); setProfileForm(null); setOpenSection(null);
    } catch (e) { toast.error(e.response?.data?.message || "Failed to update profile"); }
    finally { setSavingProfile(false); }
  };

  const savePhone = async () => {
    if (!/^[0-9+\-\s]{7,20}$/.test(phoneForm)) { toast.error("Enter a valid phone number"); return; }
    setSavingPhone(true);
    try {
      await axiosInstance.put("/users/phone", { phone: phoneForm });
      refreshUser(); toast.success("Phone updated!"); setPhoneForm(""); setOpenSection(null);
    } catch (e) { toast.error(e.response?.data?.message || "Failed to update phone"); }
    finally { setSavingPhone(false); }
  };

  const savePassword = async () => {
    if (pwForm.next.length < 6) { toast.error("New password must be 6+ characters"); return; }
    if (pwForm.next !== pwForm.confirm) { toast.error("Passwords do not match"); return; }
    setSavingPw(true);
    try {
      await axiosInstance.post("/users/change-password", { currentPassword: pwForm.current, newPassword: pwForm.next });
      toast.success("Password changed!"); setPwForm({ current: "", next: "", confirm: "" }); setOpenSection(null);
    } catch (e) { toast.error(e.response?.data?.message || "Failed to change password"); }
    finally { setSavingPw(false); }
  };

  const handleLogout = async () => {
    try { await axiosInstance.post("/users/logout"); } catch {}
    queryClient.removeQueries({ queryKey: ["userProfile"] });
    router.push("/");
  };

  const setDefaultAddress = async (a) => {
    try { await addressApi.update(a._id, { ...a, is_default: true }); refreshAddresses(); toast.success("Default address set!"); }
    catch (e) { toast.error("Failed to set default"); }
  };
  const removeAddress = async () => {
    try { await addressApi.remove(deleteAddressId); refreshAddresses(); toast.success("Address deleted!"); setDeleteAddressId(null); }
    catch (e) { toast.error("Failed to delete address"); setDeleteAddressId(null); }
  };

  const filteredOrders = orderFilter === "all" ? orders : orders.filter(o => o.status === orderFilter);

  const inputCls = "w-full h-10 px-3 rounded-lg text-sm outline-none transition focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border border-[var(--user-border)] text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)]";
  const labelCls = "block text-[11px] font-bold text-[var(--user-text-secondary)] mb-1.5 uppercase tracking-wider";
  const cardCls = "rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-sm";
  const btnPrimary = "h-10 sm:h-9 px-3.5 rounded-lg bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition disabled:opacity-50";
  const btnSecondary = "h-10 sm:h-9 px-3.5 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)] text-xs font-bold text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] hover:border-[var(--user-accent)]/40 transition disabled:opacity-50 flex items-center justify-center gap-1.5";

  const toggleSection = (s) => setOpenSection(openSection === s ? null : s);

  const sidebarProps = { user, avatarLetter, tab, orderFilter, wishlistCount, onNavigate: navigate, onExternal: external, onLogout: handleLogout };

  return (
    <main className="max-w-[1200px] mx-auto px-4 lg:px-6 pt-3 sm:pt-6 lg:pt-10 pb-4 md:pb-4">
      <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Desktop sidebar (unchanged) */}
        <aside className="hidden lg:block sticky top-24">
          <SidebarNav {...sidebarProps} />
        </aside>

        {/* Content */}
        <div className="space-y-4 sm:space-y-5">
          {/* OVERVIEW */}
          {tab === "overview" && (
            <>
              <div className={`${cardCls} relative overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--user-accent)]/10 via-transparent to-transparent pointer-events-none" />
                <div className="absolute -right-8 -bottom-12 opacity-[0.05] pointer-events-none"><ShoppingBag size={180} className="text-[var(--user-accent)]" /></div>

                {/* ✅ MOBILE ONLY — Settings icon top-right */}
                <button
                  onClick={() => setTab("settings")}
                  aria-label="Settings"
                  className="lg:hidden absolute top-3 right-3 z-10 w-9 h-9 rounded-lg bg-[var(--user-bg-hover)] border border-[var(--user-border)] text-[var(--user-text-muted)] flex items-center justify-center active:scale-95 transition"
                >
                  <Settings size={16} />
                </button>

                <div className="relative p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-[var(--user-accent)] object-cover shadow-lg" />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xl sm:text-2xl font-black flex items-center justify-center shadow-lg">{avatarLetter}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base sm:text-xl font-black text-[var(--user-text)] capitalize truncate">{user.name || user.username}</h1>
                    <p className="text-[11px] sm:text-xs text-[var(--user-text-muted)] mt-0.5 truncate">{user.email}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Member</span>
                      {memberSince && <span className="text-[10px] text-[var(--user-text-subtle)]">Since {memberSince}</span>}
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-2 shrink-0">
                    <div className="flex-1 sm:flex-none rounded-lg bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-4 py-2 text-center">
                      <p className="text-lg font-black text-[var(--user-accent)]">{orders.length}</p>
                      <p className="text-[9px] text-[var(--user-text-subtle)] uppercase tracking-wider">Orders</p>
                    </div>
                    <div className="flex-1 sm:flex-none rounded-lg bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-4 py-2 text-center">
                      <p className="text-lg font-black text-[var(--user-accent)]">{activeCount}</p>
                      <p className="text-[9px] text-[var(--user-text-subtle)] uppercase tracking-wider">Active</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {[
                  { label: "Total Orders", value: orders.length, icon: Package, to: "/orders" },
                  { label: "Active", value: activeCount, icon: Truck, to: "/orders" },
                  { label: "Wishlist", value: wishlistCount, icon: Heart, to: "/wishlist" },
                  { label: "Addresses", value: addresses.length, icon: MapPin, to: null, onClick: () => setTab("addresses") },
                ].map((s, i) => (
                  <button key={i} onClick={() => s.to ? router.push(s.to) : s.onClick()} className={`${cardCls} p-3.5 sm:p-4 text-left hover:border-[var(--user-accent)]/50 hover:-translate-y-0.5 hover:shadow-lg transition-all active:scale-[0.98]`}>
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[var(--user-accent)]/10 text-[var(--user-accent)] flex items-center justify-center mb-2"><s.icon size={16} /></div>
                    <p className="text-base sm:text-lg font-black text-[var(--user-text)]">{s.value}</p>
                    <p className="text-[9px] sm:text-[10px] text-[var(--user-text-muted)] uppercase tracking-wider">{s.label}</p>
                  </button>
                ))}
              </div>

              <div className={cardCls}>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[var(--user-border)]">
                  <h2 className="text-sm font-black text-[var(--user-text)]">Recent Orders</h2>
                  <button onClick={() => navigate("orders","all")} className="text-[11px] sm:text-xs font-bold text-[var(--user-accent)] hover:underline flex items-center gap-1">View All <ArrowRight size={12} /></button>
                </div>
                <div className="p-3 sm:p-4">
                  {orders.length === 0 ? (
                    <p className="text-sm text-[var(--user-text-muted)] py-6 text-center">No orders yet. <Link href="/" className="text-[var(--user-accent)] font-bold hover:underline">Start shopping</Link></p>
                  ) : (
                    <div className="space-y-2">
                      {orders.slice(0, 3).map(o => {
                        const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
                        return (
                          <Link key={o._id} href={`/orders/${o._id}`} className="flex items-center gap-3 p-2.5 sm:p-3 rounded-lg border border-[var(--user-border)] hover:border-[var(--user-accent)]/50 hover:bg-[var(--user-bg-hover)]/40 transition active:scale-[0.99]">
                            {getImgUrl(o.items?.[0]?.image) ? (
                              <img src={getImgUrl(o.items[0].image)} alt="" className="w-10 h-10 rounded-lg object-cover border border-[var(--user-border)]" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-[var(--user-bg-hover)] border border-[var(--user-border)] flex items-center justify-center"><Package size={15} className="text-[var(--user-text-subtle)]" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] sm:text-xs font-black text-[var(--user-accent)] font-mono">{o.order_number}</p>
                              <p className="text-[10px] text-[var(--user-text-muted)]">{o.items.length} items · {fmt(o.total)}</p>
                            </div>
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${cfg.bg} ${cfg.border} ${cfg.color}`}>{cfg.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ORDERS */}
          {tab === "orders" && (
            <div className={cardCls}>
              <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[var(--user-border)] flex-wrap gap-2">
                <h2 className="text-sm font-black text-[var(--user-text)]">My Orders ({orders.length})</h2>
                <Link href="/orders" className="text-[11px] sm:text-xs font-bold text-[var(--user-accent)] hover:underline flex items-center gap-1">Full Page <ArrowRight size={12} /></Link>
              </div>
              <div className="p-3 sm:p-4">
                <div className="flex gap-2 overflow-x-auto pb-3 mb-3 sm:mb-4 -mx-3 sm:-mx-4 px-3 sm:px-4" style={{ scrollbarWidth: "none" }}>
                  {["all", ...Object.keys(STATUS_CONFIG)].map(f => (
                    <button key={f} onClick={() => setOrderFilter(f)} className={`shrink-0 px-3 py-2 sm:py-1.5 rounded-lg text-[11px] font-bold border capitalize transition active:scale-95 ${orderFilter === f ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border-[var(--user-accent)]" : "bg-[var(--user-bg-card)] text-[var(--user-text-secondary)] border-[var(--user-border)]"}`}>
                      {f}
                    </button>
                  ))}
                </div>
                {filteredOrders.length === 0 ? (
                  <p className="text-sm text-[var(--user-text-muted)] py-8 text-center">No orders found.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredOrders.map(o => {
                      const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
                      const date = new Date(o.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
                      return (
                        <Link key={o._id} href={`/orders/${o._id}`} className="block p-3 sm:p-3.5 rounded-lg border border-[var(--user-border)] hover:border-[var(--user-accent)]/50 hover:bg-[var(--user-bg-hover)]/40 transition active:scale-[0.99]">
                          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                            <p className="text-[11px] sm:text-xs font-black text-[var(--user-accent)] font-mono">{o.order_number}</p>
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${cfg.bg} ${cfg.border} ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            {o.items.slice(0,4).map((it, i) => getImgUrl(it.image) ? (
                              <img key={i} src={getImgUrl(it.image)} alt="" className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border border-[var(--user-border)]" />
                            ) : (
                              <div key={i} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[var(--user-bg-hover)] border border-[var(--user-border)] flex items-center justify-center"><Package size={12} className="text-[var(--user-text-subtle)]" /></div>
                            ))}
                            {o.items.length > 4 && <span className="text-[10px] font-bold text-[var(--user-text-muted)]">+{o.items.length-4}</span>}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[var(--user-text-muted)]">
                            <span className="flex items-center gap-1"><Calendar size={11} /> {date}</span>
                            <span className="font-black text-[var(--user-text)]">{fmt(o.total)}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ADDRESSES */}
          {tab === "addresses" && (
            <div className={cardCls}>
              <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[var(--user-border)] gap-2">
                <h2 className="text-sm font-black text-[var(--user-text)]">Shipping Addresses ({addresses.length})</h2>
                <button onClick={() => { setEditAddress(null); setShowAddressModal(true); }} className={btnPrimary}><Plus size={14} /> <span className="hidden sm:inline">Add New</span><span className="sm:hidden">Add</span></button>
              </div>
              <div className="p-3 sm:p-4">
                {addresses.length === 0 ? (
                  <div className="text-center py-10 sm:py-12">
                    <div className="w-14 h-14 mx-auto rounded-xl bg-[var(--user-bg-hover)] flex items-center justify-center mb-3"><MapPin size={24} className="text-[var(--user-text-subtle)]" /></div>
                    <p className="text-sm text-[var(--user-text-muted)]">No saved addresses yet.</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2.5 sm:gap-3">
                    {addresses.map(a => (
                      <div key={a._id} className={`flex flex-col p-4 sm:p-5 rounded-xl border-2 min-h-[150px] sm:min-h-[170px] hover:-translate-y-0.5 hover:shadow-lg transition-all active:scale-[0.99] ${a.is_default ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5" : "border-[var(--user-border)]"}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-bold text-[var(--user-text)] capitalize">{a.full_name}</p>
                          {a.is_default && <span className="text-[8px] font-black text-[var(--user-accent)] bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/30 px-1.5 py-0.5 rounded shrink-0">DEFAULT</span>}
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <p className="text-xs text-[var(--user-text)] leading-relaxed">{a.street_address1}{a.street_address2 && <>, {a.street_address2}</>}</p>
                          <p className="text-xs text-[var(--user-text-muted)] leading-relaxed">{a.city}, {a.state} {a.zip_code && `(${a.zip_code})`}</p>
                          <p className="text-xs text-[var(--user-text-muted)]">{a.country}</p>
                        </div>
                        <div className="flex items-center gap-1.5 pt-3 mt-3 border-t border-[var(--user-border)]">
                          <span className="text-[11px] text-[var(--user-text-secondary)] flex items-center gap-1 flex-1"><Phone size={11} className="text-[var(--user-accent)]" /> {a.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-3">
                          {!a.is_default && (
                            <button onClick={() => setDefaultAddress(a)} className="flex-1 h-8 rounded-md text-[10px] font-bold text-[var(--user-accent)] hover:bg-[var(--user-accent)]/10 transition flex items-center justify-center gap-1 active:scale-95"><Star size={11} /> Default</button>
                          )}
                          <button onClick={() => { setEditAddress(a); setShowAddressModal(true); }} className="flex-1 h-8 rounded-md text-[10px] font-bold text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)] transition flex items-center justify-center gap-1 active:scale-95"><Pencil size={11} /> Edit</button>
                          <button onClick={() => setDeleteAddressId(a._id)} className="flex-1 h-8 rounded-md text-[10px] font-bold text-[var(--user-danger)] hover:bg-[var(--user-danger)]/10 transition flex items-center justify-center gap-1 active:scale-95"><Trash2 size={11} /> Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {tab === "settings" && (
            <div className={`${cardCls} overflow-hidden`}>
              <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[var(--user-border)]">
                <h2 className="text-sm font-black text-[var(--user-text)] flex items-center gap-2"><Settings size={15} className="text-[var(--user-accent)]" /> Settings</h2>
                <p className="text-xs text-[var(--user-text-muted)] mt-0.5">Manage your account preferences</p>
              </div>

              <div className="border-b border-[var(--user-border)]">
                <button onClick={() => toggleSection("profile")} className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 hover:bg-[var(--user-bg-hover)]/40 active:bg-[var(--user-bg-hover)] transition text-left">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[var(--user-accent)]/10 text-[var(--user-accent)] flex items-center justify-center shrink-0"><User size={17} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] sm:text-sm font-bold text-[var(--user-text)]">Personal Information</p>
                    <p className="text-[11px] sm:text-xs text-[var(--user-text-muted)] truncate capitalize">{user.name || "—"} · {user.email}</p>
                  </div>
                  <ChevronDown size={15} className={`text-[var(--user-text-muted)] transition-transform shrink-0 ${openSection === "profile" ? "rotate-180" : ""}`} />
                </button>
                {openSection === "profile" && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 bg-[var(--user-bg-hover)]/20 space-y-3">
                    <div><label className={labelCls}>Name</label><input value={profileForm?.name ?? user.name ?? ""} onChange={e => setProfileForm({...profileForm, name: e.target.value, username: profileForm?.username ?? user.username ?? ""})} className={inputCls} /></div>
                    <div><label className={labelCls}>Username</label><input value={profileForm?.username ?? user.username ?? ""} onChange={e => setProfileForm({...profileForm, username: e.target.value, name: profileForm?.name ?? user.name ?? ""})} className={inputCls} /></div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button onClick={() => { setProfileForm(null); setOpenSection(null); }} className={btnSecondary}>Cancel</button>
                      <button onClick={saveProfile} disabled={savingProfile} className={btnPrimary}>{savingProfile ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-b border-[var(--user-border)]">
                <button onClick={() => toggleSection("phone")} className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 hover:bg-[var(--user-bg-hover)]/40 active:bg-[var(--user-bg-hover)] transition text-left">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[var(--user-accent)]/10 text-[var(--user-accent)] flex items-center justify-center shrink-0"><Phone size={17} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] sm:text-sm font-bold text-[var(--user-text)]">Phone Number</p>
                    <p className="text-[11px] sm:text-xs text-[var(--user-text-muted)]">{user.phone || "Not set"}</p>
                  </div>
                  <ChevronDown size={15} className={`text-[var(--user-text-muted)] transition-transform shrink-0 ${openSection === "phone" ? "rotate-180" : ""}`} />
                </button>
                {openSection === "phone" && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 bg-[var(--user-bg-hover)]/20">
                    <div className="flex gap-2">
                      <input value={phoneForm} onChange={e => setPhoneForm(e.target.value)} placeholder="03001234567" className={inputCls + " flex-1 min-w-0"} />
                      <button onClick={savePhone} disabled={savingPhone || !phoneForm} className={btnPrimary + " shrink-0"}>{savingPhone ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Update</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-b border-[var(--user-border)]">
                <button onClick={() => toggleSection("password")} className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4 hover:bg-[var(--user-bg-hover)]/40 active:bg-[var(--user-bg-hover)] transition text-left">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[var(--user-accent)]/10 text-[var(--user-accent)] flex items-center justify-center shrink-0"><Lock size={17} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] sm:text-sm font-bold text-[var(--user-text)]">Password</p>
                    <p className="text-[11px] sm:text-xs text-[var(--user-text-muted)]">••••••••••</p>
                  </div>
                  <ChevronDown size={15} className={`text-[var(--user-text-muted)] transition-transform shrink-0 ${openSection === "password" ? "rotate-180" : ""}`} />
                </button>
                {openSection === "password" && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 bg-[var(--user-bg-hover)]/20 space-y-3">
                    <div className="relative">
                      <input type={showPw ? "text" : "password"} value={pwForm.current} onChange={e => setPwForm({...pwForm, current: e.target.value})} placeholder="Current password" className={inputCls + " pr-10"} />
                      <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--user-text-subtle)] hover:text-[var(--user-text)] transition">{showPw ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                    </div>
                    <input type={showPw ? "text" : "password"} value={pwForm.next} onChange={e => setPwForm({...pwForm, next: e.target.value})} placeholder="New password" className={inputCls} />
                    <input type={showPw ? "text" : "password"} value={pwForm.confirm} onChange={e => setPwForm({...pwForm, confirm: e.target.value})} placeholder="Confirm new password" className={inputCls} />
                    <div className="flex justify-end pt-1">
                      <button onClick={savePassword} disabled={savingPw} className={btnPrimary}>{savingPw ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Change Password</button>
                    </div>
                  </div>
                )}
              </div>

              {/* ✅ MOBILE ONLY — Shipping Address row (below Password) */}
              <div className="lg:hidden">
                <button onClick={() => setTab("addresses")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--user-bg-hover)]/40 active:bg-[var(--user-bg-hover)] transition text-left">
                  <div className="w-9 h-9 rounded-lg bg-[var(--user-accent)]/10 text-[var(--user-accent)] flex items-center justify-center shrink-0"><MapPin size={17} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[var(--user-text)]">Shipping Address</p>
                    <p className="text-[11px] text-[var(--user-text-muted)]">{addresses.length} saved</p>
                  </div>
                  <ChevronRight size={15} className="text-[var(--user-text-muted)] shrink-0" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddressModal && (
        <AddressFormModal address={editAddress} onClose={() => setShowAddressModal(false)} onSaved={() => { setShowAddressModal(false); refreshAddresses(); }} />
      )}
      {deleteAddressId && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteAddressId(null)}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border-t-2 sm:border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-black text-[var(--user-text)] mb-2">Delete this address?</h3>
            <p className="text-xs text-[var(--user-text-muted)] mb-5">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteAddressId(null)} className="flex-1 h-10 sm:h-9 rounded-lg border border-[var(--user-border)] text-xs font-bold text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition">Cancel</button>
              <button onClick={removeAddress} className="flex-1 h-10 sm:h-9 rounded-lg bg-[var(--user-danger)] text-white text-xs font-bold hover:opacity-90 transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}