"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosInstance from "@/apis/axiosInstance";
import { addressApi } from "@/apis/user/addressApi";
import { useWishlist } from "@/components/user/WishlistContext";
import AddressForm from "@/components/user/AddressForm";
import {
  LayoutDashboard, Package, MapPin, Settings, LogOut, User, Phone, Lock,
  Plus, Pencil, Trash2, Heart, ShoppingBag, Calendar, ArrowRight, ArrowLeft, Loader2,
  X, CheckCircle2, Clock, Truck, XCircle, Eye, EyeOff, ShieldCheck,
  Star, Save, ChevronDown, ChevronRight, SlidersHorizontal,
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

const FILTER_OPTIONS = [
  { value: "all", label: "All Orders" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

/* ============ SIDEBAR NAV (DESKTOP ONLY) ============ */
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

               <button onClick={() => onExternal("/orders")} className={itemCls(false)}>
          <Package size={15} /> My Orders
        </button>

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

/* ============ ✅ MOBILE TOP BAR WITH BACK ARROW ============ */
function MobileTopBar({ tab, onBack }) {
  // Overview pe back nahi chahiye (home hai)
  if (tab === "overview") return null;

  const titles = {
    orders: "My Orders",
    addresses: "Addresses",
    settings: "Settings",
  };

  return (
    <div className="lg:hidden sticky top-[57px] z-30 bg-[var(--user-bg-elevated)]/95 backdrop-blur-md border-b border-[var(--user-border)] mb-4">
      <div className="flex items-center gap-3 h-12 px-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] active:scale-95 transition"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-black text-[var(--user-text)] flex-1">{titles[tab] || "Account"}</h1>
      </div>
    </div>
  );
}

/* ============ ✅ MOBILE FILTER BOTTOM SHEET ============ */
function FilterSheet({ open, current, onClose, onSelect }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] lg:hidden">
      <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="absolute bottom-0 inset-x-0 bg-[var(--user-bg-card)] border-t border-[var(--user-border)] rounded-t-2xl max-h-[70vh] overflow-hidden flex flex-col" style={{ animation: "slideUp .25s ease" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--user-border)] shrink-0">
          <h3 className="text-sm font-black text-[var(--user-text)]">Filter Orders</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[var(--user-bg-hover)] flex items-center justify-center transition">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-2">
          {FILTER_OPTIONS.map((opt) => {
            const active = current === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { onSelect(opt.value); onClose(); }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition mb-0.5 ${
                  active ? "bg-[var(--user-accent)]/10 text-[var(--user-accent)]" : "text-[var(--user-text)] hover:bg-[var(--user-bg-hover)]"
                }`}
              >
                <span>{opt.label}</span>
                {active && <CheckCircle2 size={16} />}
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t border-[var(--user-border)] shrink-0" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <button onClick={onClose} className="w-full h-11 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-black uppercase tracking-wider hover:opacity-90 transition active:scale-[0.98]">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { count: wishlistCount } = useWishlist();

  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "overview";
    return new URLSearchParams(window.location.search).get("tab") || "overview";
  });

  useEffect(() => {
    const checkUrlTab = () => {
      const urlTab = new URLSearchParams(window.location.search).get("tab");
      if (urlTab && urlTab !== tab) setTab(urlTab);
    };
    const onTab = (e) => {
      if (e.detail && e.detail !== tab) {
        setTab(e.detail);
        const url = new URL(window.location);
        url.searchParams.set("tab", e.detail);
        window.history.pushState({}, "", url);
      }
    };
    checkUrlTab();
    window.addEventListener("popstate", checkUrlTab);
    window.addEventListener("account:tab", onTab);
    return () => {
      window.removeEventListener("popstate", checkUrlTab);
      window.removeEventListener("account:tab", onTab);
    };
  }, [tab]);

  const [orderFilter, setOrderFilter] = useState("all");
  const [openSection, setOpenSection] = useState(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

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
    const url = new URL(window.location);
    url.searchParams.set("tab", tabId);
    if (filter) url.searchParams.set("filter", filter);
    window.history.pushState({}, "", url);
  };
  const external = (href) => router.push(href);

  // ✅ MOBILE BACK → overview pe wapas
  const handleBack = () => navigate("overview");

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
  const currentFilterLabel = FILTER_OPTIONS.find(f => f.value === orderFilter)?.label || "All";

  const inputCls = "w-full h-11 lg:h-10 px-3 rounded-lg text-sm outline-none transition focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border border-[var(--user-border)] text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)]";
  const labelCls = "block text-[11px] font-bold text-[var(--user-text-secondary)] mb-1.5 uppercase tracking-wider";
  const cardCls = "rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-sm";
  const btnPrimary = "h-11 lg:h-9 px-3.5 rounded-lg bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition disabled:opacity-50";
  const btnSecondary = "h-11 lg:h-9 px-3.5 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)] text-xs font-bold text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] hover:border-[var(--user-accent)]/40 transition disabled:opacity-50 flex items-center justify-center gap-1.5";

  const toggleSection = (s) => setOpenSection(openSection === s ? null : s);

  const sidebarProps = { user, avatarLetter, tab, orderFilter, wishlistCount, onNavigate: navigate, onExternal: external, onLogout: handleLogout };

  return (
    <main className="max-w-[1200px] mx-auto px-3 lg:px-6 pt-3 lg:pt-10 pb-4 md:pb-4">
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      {/* ✅ MOBILE TOP BAR — Back arrow on non-overview tabs */}
      <MobileTopBar tab={tab} onBack={handleBack} />

      <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
        <aside className="hidden lg:block sticky top-24">
          <SidebarNav {...sidebarProps} />
        </aside>

        <div className="space-y-4 sm:space-y-5">
          {/* OVERVIEW */}
          {tab === "overview" && (
            <>
              <div className={`${cardCls} relative overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--user-accent)]/10 via-transparent to-transparent pointer-events-none" />
                <div className="absolute -right-8 -bottom-12 opacity-[0.05] pointer-events-none"><ShoppingBag size={180} className="text-[var(--user-accent)]" /></div>

             <button
  onClick={() => navigate("settings")}
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

              {/* ✅ RECENT ORDERS — Better mobile design */}
              <div className={cardCls}>
                <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[var(--user-border)]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--user-accent)]/10 flex items-center justify-center lg:hidden">
                      <Package size={15} className="text-[var(--user-accent)]" />
                    </div>
                    <h2 className="text-sm font-black text-[var(--user-text)]">Recent Orders</h2>
                  </div>
                  <button onClick={() => router.push("/orders")} className="hidden lg:flex text-[11px] sm:text-xs font-bold text-[var(--user-accent)] hover:underline items-center gap-1">View All <ArrowRight size={12} /></button>
                                  </div>
                <div className="p-3 sm:p-4">
                  {orders.length === 0 ? (
                    <div className="text-center py-8 sm:py-6">
                      <div className="w-14 h-14 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-3">
                        <Package size={24} className="text-[var(--user-text-subtle)]" />
                      </div>
                      <p className="text-sm text-[var(--user-text-muted)] mb-1">No orders yet</p>
                      <Link href="/" className="text-[12px] text-[var(--user-accent)] font-bold hover:underline">Start shopping →</Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orders.slice(0, 3).map(o => {
                        const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
                        const StatusIcon = cfg.icon;
                        const date = new Date(o.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short" });
                        return (
                          <Link key={o._id} href={`/orders/${o._id}`} className="block p-3 rounded-xl border border-[var(--user-border)] hover:border-[var(--user-accent)]/50 hover:shadow-md transition-all active:scale-[0.99]">
                            {/* Top: Status badge (mobile-prominent) */}
                            <div className="flex items-center justify-between mb-2.5">
                              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border flex items-center gap-1 ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                                <StatusIcon size={10} /> {cfg.label}
                              </span>
                              <span className="text-[10px] text-[var(--user-text-muted)] flex items-center gap-1">
                                <Calendar size={10} /> {date}
                              </span>
                            </div>

                            {/* Middle: Image + Info */}
                            <div className="flex items-center gap-3">
                              {getImgUrl(o.items?.[0]?.image) ? (
                                <img src={getImgUrl(o.items[0].image)} alt="" className="w-14 h-14 rounded-lg object-cover border border-[var(--user-border)] shrink-0" />
                              ) : (
                                <div className="w-14 h-14 rounded-lg bg-[var(--user-bg-hover)] border border-[var(--user-border)] flex items-center justify-center shrink-0"><Package size={20} className="text-[var(--user-text-subtle)]" /></div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black text-[var(--user-accent)] font-mono mb-0.5">#{o.order_number}</p>
                                <p className="text-[12px] font-semibold text-[var(--user-text)] truncate">{o.items?.[0]?.name || "Order"}</p>
                                <p className="text-[10px] text-[var(--user-text-muted)] mt-0.5">
                                  {o.items.length} {o.items.length === 1 ? "item" : "items"}
                                  {o.items.length > 1 && <span className="ml-1">+{o.items.length - 1} more</span>}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[14px] font-black text-[var(--user-text)]">{fmt(o.total)}</p>
                                <ChevronRight size={14} className="text-[var(--user-text-muted)] ml-auto mt-0.5" />
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ✅ MOBILE: Full width "View All" button */}
                {orders.length > 0 && (
                               <div className="lg:hidden px-3 pb-3">
                    <button
                      onClick={() => router.push("/orders")}
                      className="w-full h-11 rounded-xl border-2 border-[var(--user-accent)] text-[var(--user-accent)] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] active:scale-[0.98] transition"
                    >
                      View All Orders <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

        

          {/* ADDRESSES — unchanged */}
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

          {/* SETTINGS — unchanged */}
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
                      <input value={phoneForm} onChange={e => setPhoneForm(e.target.value)} placeholder="xxxxxx" className={inputCls + " flex-1 min-w-0"} />
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

      {/* Modals — unchanged */}
      {showAddressModal && (
        <AddressForm
          initialAddress={editAddress}
          onSuccess={() => { setShowAddressModal(false); refreshAddresses(); }}
          onCancel={() => setShowAddressModal(false)}
        />
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

      {/* ✅ Filter Bottom Sheet */}
      <FilterSheet
        open={showFilterSheet}
        current={orderFilter}
        onClose={() => setShowFilterSheet(false)}
        onSelect={setOrderFilter}
      />
    </main>
  );
}