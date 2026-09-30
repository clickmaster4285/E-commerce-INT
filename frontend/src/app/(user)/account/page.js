"use client";

/* ==========================================================
   ACCOUNT PAGE — "profile workspace" layout
   ----------------------------------------------------------
   Design inspiration: dark SaaS account screen (identity card +
   profile info grid + preference toggles + right rail for
   security & quick stats).

   ⚠️ user.css ko chhua nahi gaya — saara styling maujooda theme
   variables (--user-accent, --user-bg-card, ...) aur Tailwind
   arbitrary values se hui hai.

   ⚠️ Koi hardcoded data nahi — har value API se aati hai:
        GET /users/profile   → name, username, email, phone, dob,
                               avatar, provider, twoFactorEnabled,
                               preferences, created_at / updated_at
        GET /orders/my       → orders + status counts
        GET /addresses       → saved addresses
        GET /users/wishlist  → wishlist (WishlistContext ke through)
   ========================================================== */

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosInstance from "@/apis/axiosInstance";
import { addressApi } from "@/apis/user/addressApi";
import { useWishlist } from "@/components/user/WishlistContext";
import AddressForm from "@/components/user/AddressForm";
import OrdersView from "../orders/page";
import WishlistView from "../wishlist/page";
import {
  User, Package, Heart, MapPin, Settings, LogOut, Phone, Mail, Calendar,
  Plus, Pencil, Trash2, ShoppingBag, ArrowRight, ArrowLeft, Loader2, X,
  CheckCircle2, Clock, Truck, XCircle, Eye, EyeOff, ShieldCheck, Star, Save,
  ChevronRight, SlidersHorizontal, KeyRound, Globe,
} from "lucide-react";

/* ============ HELPERS ============ */
/* ✅ Mobile breakpoint — hydration-safe (server par false, phir subscribe) */
const MOBILE_QUERY = "(max-width: 1023px)";
const subscribeMobile = (cb) => {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getMobileSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;
const getMobileServerSnapshot = () => false;
function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot);
}
const fmtDate = (d, opts) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString(
    "en-GB",
    opts || { day: "numeric", month: "short", year: "numeric" },
  );
};

/* ✅ Sidebar — sirf ye 5 tabs + Logout (aur kuch nahi) */
const NAV_ITEMS = [
  { id: "profile", label: "My Profile", icon: User },
  { id: "orders", label: "My Orders", icon: Package },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "address", label: "Address", icon: MapPin },
  { id: "settings", label: "Setting", icon: Settings },
];

const TAB_TITLES = {
  profile: "My Profile",
  orders: "My Orders",
  wishlist: "Wishlist",
  address: "Address",
  settings: "Setting",
};

/* purane URL tabs (overview / addresses) bhi kaam karte rahen */
const TAB_ALIASES = { overview: "profile", addresses: "address" };
const normalizeTab = (t) =>
  !t ? "profile" : TAB_ALIASES[t] || (TAB_TITLES[t] ? t : "profile");

/* ============ SMALL BUILDING BLOCKS ============ */
function Card({ className = "", children }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title, subtitle, action, tone = "accent" }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 border-b border-[var(--user-border)]">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              tone === "success"
                ? "bg-[var(--user-success)]/10 text-[var(--user-success)]"
                : tone === "danger"
                  ? "bg-[var(--user-danger)]/10 text-[var(--user-danger)]"
                  : "bg-[var(--user-accent)]/10 text-[var(--user-accent)]"
            }`}
          >
            <Icon size={16} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-black text-[var(--user-text)] truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[0.6875rem] text-[var(--user-text-muted)] mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function MetaRow({ icon: Icon, children }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0 text-[0.75rem] text-[var(--user-text-muted)]">
      {Icon && <Icon size={13} className="text-[var(--user-accent)] shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

function StatusPill({ status, size = "md" }) {
  const active = status === "Active";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold border ${
        size === "sm" ? "text-[0.5625rem] px-1.5 py-0.5" : "text-[0.625rem] px-2 py-0.5"
      } ${
        active
          ? "text-[var(--user-success)] bg-[var(--user-success)]/10 border-[var(--user-success)]/30"
          : "text-[var(--user-danger)] bg-[var(--user-danger)]/10 border-[var(--user-danger)]/30"
      }`}
    >
      <CheckCircle2 size={size === "sm" ? 9 : 11} /> {status}
    </span>
  );
}

function EmptyBlock({ icon: Icon, title, text, action }) {
  return (
    <div className="text-center py-10 sm:py-12 px-4">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--user-bg-hover)] flex items-center justify-center mb-3">
        <Icon size={24} className="text-[var(--user-text-subtle)]" />
      </div>
      <p className="text-sm font-bold text-[var(--user-text)] mb-1">{title}</p>
      {text && <p className="text-xs text-[var(--user-text-muted)] mb-4">{text}</p>}
      {action}
    </div>
  );
}


/* ============ SIDEBAR (DESKTOP) ============ */
function navItemCls(active) {
  return `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.8125rem] font-bold transition-all duration-200 ${
    active
      ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] shadow-md"
      : "text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)]"
  }`;
}

function navBadgeCls(active) {
  return `ml-auto text-[0.625rem] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
    active
      ? "bg-[var(--user-accent-text)]/15 text-[var(--user-accent-text)]"
      : "bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]"
  }`;
}

function SidebarNav({ user, avatarLetter, status, tab, counts, onNavigate, onLogout }) {
  return (
    <Card className="overflow-hidden">
      {/* identity block */}
      <div className="relative p-4 border-b border-[var(--user-border)] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--user-accent)]/12 via-transparent to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="relative shrink-0">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || user.username}
                className="w-11 h-11 rounded-full object-cover border border-[var(--user-border)]"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)] text-base font-black flex items-center justify-center">
                {avatarLetter}
              </div>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--user-bg-card)] ${
                status === "Active" ? "bg-[var(--user-success)]" : "bg-[var(--user-danger)]"
              }`}
            />
          </div>
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-black text-[var(--user-text)] truncate capitalize">
              {user.name || user.username}
            </p>
            <p className="text-[0.625rem] text-[var(--user-text-muted)] truncate">{user.email}</p>
          </div>
        </div>

        <div className="relative mt-3">
          <StatusPill status={status} />
        </div>
      </div>

      {/* nav — sirf 5 tabs + logout */}
      <nav className="p-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          const count = counts?.[item.id] || 0;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={navItemCls(active)}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate">{item.label}</span>
              {count > 0 && <span className={navBadgeCls(active)}>{count}</span>}
            </button>
          );
        })}

        <div className="h-px bg-[var(--user-border)] my-2" />

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[0.8125rem] font-bold text-[var(--user-danger)] hover:bg-[var(--user-danger)]/10 transition-colors duration-200"
        >
          <LogOut size={16} className="shrink-0" /> Logout
        </button>
      </nav>
    </Card>
  );
}


/* ============ MOBILE MENU ============ */
function MobileMenu({
  user,
  avatarLetter,
  status,
  memberSince,
  stats,
  counts,
  onNavigate,
  onLogout,
}) {
  return (
    <div className="lg:hidden space-y-3">
      {/* identity */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--user-accent)]/12 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -right-6 -bottom-10 opacity-[0.05] pointer-events-none">
          <ShoppingBag size={150} className="text-[var(--user-accent)]" />
        </div>
        <div className="relative p-4 sm:p-5">
          <div className="flex items-center gap-4">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || user.username}
                className="w-16 h-16 rounded-2xl object-cover border border-[var(--user-border)] shadow-lg shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-2xl font-black flex items-center justify-center shadow-lg shrink-0">
                {avatarLetter}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-black text-[var(--user-text)] capitalize truncate">
                {user.name || user.username}
              </h1>
              <p className="text-[0.6875rem] text-[var(--user-text-muted)] truncate mt-0.5">
                {user.email}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <StatusPill status={status} />
                {memberSince && (
                  <span className="text-[0.625rem] text-[var(--user-text-subtle)]">
                    Since {memberSince}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {stats.map((s) => (
              <button
                key={s.label}
                onClick={s.onClick}
                className="rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)]/60 px-3 py-2.5 text-left active:scale-[0.98] transition"
              >
                <s.icon size={14} className="text-[var(--user-accent)]" />
                <p className="text-base font-black text-[var(--user-text)] mt-1.5">{s.value}</p>
                <p className="text-[0.5625rem] text-[var(--user-text-muted)] uppercase tracking-wider">
                  {s.label}
                </p>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* nav list */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--user-border)]">
          <p className="text-[0.625rem] font-black text-[var(--user-text-muted)] uppercase tracking-widest">
            Account Menu
          </p>
        </div>
        <nav className="p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const count = counts?.[item.id] || 0;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[0.8125rem] font-bold text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] active:bg-[var(--user-bg-hover)] transition-colors duration-200"
              >
                <span className="w-9 h-9 rounded-lg bg-[var(--user-accent)]/10 text-[var(--user-accent)] flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </span>
                <span className="truncate">{item.label}</span>
                {count > 0 && (
                  <span className="ml-auto text-[0.625rem] font-black px-1.5 py-0.5 rounded-full bg-[var(--user-bg-hover)] text-[var(--user-text-muted)] shrink-0">
                    {count}
                  </span>
                )}
                <ChevronRight size={15} className="text-[var(--user-text-subtle)] shrink-0" />
              </button>
            );
          })}

          <div className="h-px bg-[var(--user-border)] my-2" />

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[0.8125rem] font-bold text-[var(--user-danger)] hover:bg-[var(--user-danger)]/10 transition-colors duration-200"
          >
            <span className="w-9 h-9 rounded-lg bg-[var(--user-danger)]/10 flex items-center justify-center shrink-0">
              <LogOut size={16} />
            </span>
            Logout
          </button>
        </nav>
      </Card>
    </div>
  );
}


/* ============ MOBILE TOP BAR (back to menu) ============ */
function MobileTopBar({ title, onBack }) {
  return (
    <div className="lg:hidden sticky top-[3.5625rem] z-30 -mx-3 px-3 bg-[var(--user-bg-elevated)]/95 backdrop-blur-md border-b border-[var(--user-border)] mb-4">
      <div className="flex items-center gap-3 h-12">
        <button
          onClick={onBack}
          aria-label="Back to account menu"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] active:scale-95 transition"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-black text-[var(--user-text)] flex-1 truncate">{title}</h1>
      </div>
    </div>
  );
}

/* ==========================================================
   ACCOUNT PAGE
   ========================================================== */
export default function AccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { count: wishlistCount } = useWishlist();

  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "profile";
    return normalizeTab(new URLSearchParams(window.location.search).get("tab"));
  });
  const isMobile = useIsMobile();
  const [hadTabInUrl] = useState(
    () =>
      typeof window !== "undefined" &&
      !!new URLSearchParams(window.location.search).get("tab"),
  );
  /* null = auto: mobile par menu, agar URL me tab na bheja gaya ho */
  const [mobileMenu, setMobileMenu] = useState(null);
  const showMobileMenu = mobileMenu === null ? isMobile && !hadTabInUrl : mobileMenu;

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  /* New password strength (0-4): length + case mix + digit + symbol */
  const pwStrength = useMemo(() => {
    const value = pwForm.next || "";
    if (!value) return 0;
    let score = 0;
    if (value.length >= 6) score += 1;
    if (value.length >= 10) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
    return Math.min(score, 4);
  }, [pwForm.next]);
  const pwStrengthMeta = [
    { label: "", bar: "bg-[var(--user-border)]" },
    { label: "Weak", bar: "bg-red-500" },
    { label: "Fair", bar: "bg-orange-500" },
    { label: "Good", bar: "bg-amber-400" },
    { label: "Strong", bar: "bg-emerald-500" },
  ][pwStrength];

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editAddress, setEditAddress] = useState(null);
  const [deleteAddressId, setDeleteAddressId] = useState(null);

  /* ---------- URL ↔ tab sync (Header.js ke "account:tab" event ke sath) ---------- */
  useEffect(() => {
    const applyTab = (next) => {
      setTab(normalizeTab(next));
      setEditingProfile(false);
      setProfileForm(null);
    };
    const fromUrl = () => {
      const urlTab = new URLSearchParams(window.location.search).get("tab");
      if (urlTab) applyTab(urlTab);
    };
    const onTab = (e) => {
      if (!e.detail) return;
      applyTab(e.detail);
      setMobileMenu(false);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", normalizeTab(e.detail));
      window.history.pushState({}, "", url);
    };
    fromUrl();
    window.addEventListener("popstate", fromUrl);
    window.addEventListener("account:tab", onTab);
    return () => {
      window.removeEventListener("popstate", fromUrl);
      window.removeEventListener("account:tab", onTab);
    };
  }, []);

  /* ---------- data ---------- */
  const { data: user = null, isLoading: userLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["myOrders"],
    queryFn: async () => {
      const res = await axiosInstance.get("/orders/my");
      return res.data?.data || [];
    },
    enabled: !!user,
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses"],
    queryFn: addressApi.getAll,
    enabled: !!user,
  });

  if (userLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--user-accent)]" size={28} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center mb-5">
          <User size={28} className="text-[var(--user-accent)] opacity-60" />
        </div>
        <h1 className="text-lg font-bold text-[var(--user-text)] mb-2">Login Required</h1>
        <p className="text-sm text-[var(--user-text-muted)] mb-6">
          Please login to view your account.
        </p>
        <Link
          href="/login?redirect=/account"
          className="inline-block bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition"
        >
          Login to Your Account
        </Link>
      </div>
    );
  }


  /* ---------- derived ---------- */
  const avatarLetter = (user.name || user.email || "U").charAt(0).toUpperCase();
  const memberSince = fmtDate(user.created_at);
  const accountStatus =
    user.is_deleted || String(user.status || "").toLowerCase() === "inactive"
      ? "Inactive"
      : "Active";
  const activeCount = orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;
  const counts = {
    orders: orders.length,
    wishlist: wishlistCount,
    address: addresses.length,
  };

  const navigate = (nextTab) => {
    const id = normalizeTab(nextTab);
    setTab(id);
    setMobileMenu(false);
    setEditingProfile(false);
    setProfileForm(null);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.pushState({}, "", url);
  };

  const stats = [
    { label: "Total Orders", value: orders.length, icon: Package, onClick: () => navigate("orders") },
    { label: "Active Orders", value: activeCount, icon: Truck, onClick: () => navigate("orders") },
    { label: "Wishlist", value: wishlistCount, icon: Heart, onClick: () => navigate("wishlist") },
    { label: "Addresses", value: addresses.length, icon: MapPin, onClick: () => navigate("address") },
  ];

  const refreshUser = () => queryClient.invalidateQueries({ queryKey: ["userProfile"] });
  const refreshAddresses = () => queryClient.invalidateQueries({ queryKey: ["addresses"] });

  /* ---------- profile edit ---------- */
  const startEditProfile = () => {
    setProfileForm({
      name: user.name || "",
      username: user.username || "",
      phone: user.phone || "",
      dob: user.dob ? String(user.dob).slice(0, 10) : "",
    });
    setEditingProfile(true);
  };
  const cancelEditProfile = () => {
    setEditingProfile(false);
    setProfileForm(null);
  };
  const setField = (key, value) => setProfileForm((f) => ({ ...(f || {}), [key]: value }));

  const saveDetails = async () => {
    const form = profileForm || {};
    if (!String(form.name || "").trim()) return toast.error("Name is required");
    if (!String(form.username || "").trim()) return toast.error("Username is required");
    if (form.phone && !/^[0-9+\-\s]{7,20}$/.test(String(form.phone)))
      return toast.error("Enter a valid phone number");
    setSavingProfile(true);
    try {
      await axiosInstance.put("/users/profile", {
        name: String(form.name).trim(),
        username: String(form.username).trim(),
        phone: String(form.phone || "").trim(),
        dob: form.dob || "",
      });
      await refreshUser();
      toast.success("Profile updated!");
      setEditingProfile(false);
      setProfileForm(null);
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };


  /* ---------- password ---------- */
  const savePassword = async () => {
    if (!pwForm.current) return toast.error("Enter your current password");
    if (pwForm.next.length < 6) return toast.error("New password must be 6+ characters");
    if (pwForm.next !== pwForm.confirm) return toast.error("Passwords do not match");
    setSavingPw(true);
    try {
      await axiosInstance.post("/users/change-password", {
        currentPassword: pwForm.current,
        newPassword: pwForm.next,
      });
      toast.success("Password changed!");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to change password");
    } finally {
      setSavingPw(false);
    }
  };

  /* ---------- logout ---------- */
  const handleLogout = async () => {
    try {
      await axiosInstance.post("/users/logout");
    } catch {}
    queryClient.removeQueries({ queryKey: ["userProfile"] });
    queryClient.removeQueries({ queryKey: ["myOrders"] });
    queryClient.removeQueries({ queryKey: ["addresses"] });
    queryClient.removeQueries({ queryKey: ["wishlist"] });
    router.push("/");
  };

  /* ---------- addresses ---------- */
  const setDefaultAddress = async (a) => {
    try {
      await addressApi.update(a._id, { ...a, is_default: true });
      refreshAddresses();
      toast.success("Default address set!");
    } catch {
      toast.error("Failed to set default");
    }
  };
  const removeAddress = async () => {
    try {
      await addressApi.remove(deleteAddressId);
      refreshAddresses();
      toast.success("Address deleted!");
      setDeleteAddressId(null);
    } catch {
      toast.error("Failed to delete address");
      setDeleteAddressId(null);
    }
  };

  /* ---------- shared class strings ---------- */
  const inputCls =
    "w-full h-11 px-3 rounded-xl text-sm outline-none transition bg-[var(--user-bg-input)] border border-[var(--user-border)] text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)]";
  const fieldCls = (editable) =>
    `${inputCls} ${
      editable ? "" : "cursor-default opacity-80 focus:ring-0 focus:border-[var(--user-border)]"
    }`;
  const labelCls =
    "block text-[0.6875rem] font-bold text-[var(--user-text-muted)] mb-1.5 uppercase tracking-wider";
  const btnPrimary =
    "h-10 px-3.5 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition disabled:opacity-50 active:scale-[0.98]";
  const btnSecondary =
    "h-10 px-3.5 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-xs font-bold text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] hover:border-[var(--user-accent)]/40 transition disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-[0.98]";


  /* ---------- shared sidebar props ---------- */
  const sidebarProps = {
    user,
    avatarLetter,
    status: accountStatus,
    tab,
    counts,
    onNavigate: navigate,
    onLogout: handleLogout,
  };

  return (
    <main className="max-w-[75rem] mx-auto px-3 lg:px-6 pt-3 lg:pt-10 pb-24 md:pb-10">
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <div className="grid lg:grid-cols-[16.5rem_minmax(0,1fr)] gap-5 lg:gap-6 items-start">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:block lg:sticky lg:top-24">
          <SidebarNav {...sidebarProps} />
        </aside>

        {/* CONTENT */}
        <div className="min-w-0">
          {showMobileMenu ? (
            <MobileMenu
              {...sidebarProps}
              memberSince={memberSince}
              stats={stats}
              onNavigate={navigate}
            />
          ) : (
            <div style={{ animation: "fadeUp .25s ease" }}>
              <MobileTopBar title={TAB_TITLES[tab]} onBack={() => setMobileMenu(true)} />

              {/* ============ MY PROFILE ============ */}
              {tab === "profile" && (
                <div className="grid xl:grid-cols-[minmax(0,1fr)_19rem] gap-4 items-start">
                  <div className="space-y-4 min-w-0">
                    {/* identity */}
                    <Card className="relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-[var(--user-accent)]/10 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute -right-6 -bottom-10 opacity-[0.05] pointer-events-none">
                        <ShoppingBag size={160} className="text-[var(--user-accent)]" />
                      </div>
                      <div className="relative p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name || user.username}
                            className="w-16 h-16 rounded-2xl object-cover border border-[var(--user-border)] shadow-lg shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-2xl font-black flex items-center justify-center shadow-lg shrink-0">
                            {avatarLetter}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg font-black text-[var(--user-text)] capitalize truncate">
                              {user.name || user.username}
                            </h1>
                            <StatusPill status={accountStatus} />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                            <MetaRow icon={Mail}>{user.email}</MetaRow>
                            <MetaRow icon={Phone}>{user.phone || "Phone not added"}</MetaRow>
                            {memberSince && (
                              <MetaRow icon={Calendar}>Member since {memberSince}</MetaRow>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>


                    {/* profile information */}
                    <Card>
                      <CardHeader
                        icon={User}
                        title="Profile Information"
                        subtitle="Manage your account details"
                        action={
                          editingProfile ? (
                            <div className="flex items-center gap-2">
                              <button onClick={cancelEditProfile} className={btnSecondary}>
                                Cancel
                              </button>
                              <button
                                onClick={saveDetails}
                                disabled={savingProfile}
                                className={btnPrimary}
                              >
                                {savingProfile ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Save size={13} />
                                )}
                                Save
                              </button>
                            </div>
                          ) : (
                            <button onClick={startEditProfile} className={btnSecondary}>
                              <Pencil size={13} /> Edit Profile
                            </button>
                          )
                        }
                      />

                      <div className="p-4 sm:p-5 grid sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className={labelCls}>Full Name</label>
                          <input
                            value={editingProfile ? profileForm?.name ?? "" : user.name || ""}
                            onChange={(e) => setField("name", e.target.value)}
                            readOnly={!editingProfile}
                            placeholder="Your full name"
                            className={fieldCls(editingProfile)}
                          />
                        </div>

                        <div>
                          <label className={labelCls}>Username</label>
                          <input
                            value={
                              editingProfile ? profileForm?.username ?? "" : user.username || ""
                            }
                            onChange={(e) => setField("username", e.target.value)}
                            readOnly={!editingProfile}
                            placeholder="Username"
                            className={fieldCls(editingProfile)}
                          />
                        </div>

                        <div>
                          <label className={labelCls}>Email Address</label>
                          <input value={user.email || ""} readOnly className={fieldCls(false)} />
                        </div>

                        <div>
                          <label className={labelCls}>Phone Number</label>
                          <input
                            value={editingProfile ? profileForm?.phone ?? "" : user.phone || ""}
                            onChange={(e) => setField("phone", e.target.value)}
                            readOnly={!editingProfile}
                            placeholder="Not added"
                            className={fieldCls(editingProfile)}
                          />
                        </div>

                        <div>
                          <label className={labelCls}>Date of Birth</label>
                          <input
                            type="date"
                            value={editingProfile ? profileForm?.dob ?? "" : user.dob || ""}
                            onChange={(e) => setField("dob", e.target.value)}
                            readOnly={!editingProfile}
                            className={fieldCls(editingProfile)}
                          />
                        </div>

                        <div>
                          <label className={labelCls}>Member Since</label>
                          <input value={memberSince || ""} readOnly className={fieldCls(false)} />
                        </div>
                      </div>
                    </Card>

                  </div>

                  {/* right rail */}
                  <div className="space-y-4 min-w-0">
                    {/* account security */}
                    <Card>
                      <CardHeader
                        icon={ShieldCheck}
                        title="Account Security"
                        subtitle="Keep your account safe"
                      />
                      <div className="p-2 space-y-0.5">
                        <button
                          onClick={() => navigate("settings")}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--user-bg-hover)] transition text-left"
                        >
                          <span className="w-9 h-9 rounded-xl bg-[var(--user-bg-hover)] text-[var(--user-accent)] flex items-center justify-center shrink-0">
                            <KeyRound size={16} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[0.8125rem] font-bold text-[var(--user-text)]">
                              Change Password
                            </span>
                            <span className="block text-[0.6875rem] text-[var(--user-text-muted)] truncate">
                              {user.provider === "google"
                                ? "Signed up with Google"
                                : "Keep your account safe"}
                            </span>
                          </span>
                          <ChevronRight size={15} className="text-[var(--user-text-muted)] shrink-0" />
                        </button>
                      </div>
                    </Card>


                    {/* quick stats */}
                    <Card>
                      <CardHeader icon={Package} title="Quick Stats" />
                      <div className="p-3 grid grid-cols-2 gap-2.5">
                        {stats.map((s) => {
                          const Icon = s.icon;
                          return (
                            <button
                              key={s.label}
                              onClick={s.onClick}
                              className="rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)]/50 p-3 text-left hover:border-[var(--user-accent)]/50 hover:-translate-y-0.5 transition-all active:scale-[0.98]"
                            >
                              <span className="w-8 h-8 rounded-lg bg-[var(--user-accent)]/10 text-[var(--user-accent)] flex items-center justify-center mb-2">
                                <Icon size={15} />
                              </span>
                              <p className="text-base font-black text-[var(--user-text)]">
                                {s.value}
                              </p>
                              <p className="text-[0.5625rem] text-[var(--user-text-muted)] uppercase tracking-wider">
                                {s.label}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* ============ MY ORDERS — orders page wala hi design (reuse) ============ */}
              {tab === "orders" && <OrdersView compact />}

              {/* ============ WISHLIST — wishlist page wala hi design (reuse) ============ */}
              {tab === "wishlist" && <WishlistView compact />}

              {/* ============ ADDRESS ============ */}
              {tab === "address" && (
                <Card className="overflow-hidden">
                  <CardHeader
                    icon={MapPin}
                    title={`Addresses (${addresses.length})`}
                    subtitle="Shipping addresses saved on your account"
                    action={
                      <button
                        onClick={() => {
                          setEditAddress(null);
                          setShowAddressModal(true);
                        }}
                        className={btnPrimary}
                      >
                        <Plus size={14} /> Add New
                      </button>
                    }
                  />
                  <div className="p-3 sm:p-4">
                    {addresses.length === 0 ? (
                      <EmptyBlock
                        icon={MapPin}
                        title="No saved addresses yet"
                        text="Add an address to make checkout faster."
                        action={
                          <button
                            onClick={() => {
                              setEditAddress(null);
                              setShowAddressModal(true);
                            }}
                            className={btnPrimary + " inline-flex"}
                          >
                            <Plus size={13} /> Add Address
                          </button>
                        }
                      />
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2.5 sm:gap-3">
                        {addresses.map((a) => (
                          <div
                            key={a._id}
                            className={`flex flex-col p-4 sm:p-5 rounded-xl border-2 hover:-translate-y-0.5 hover:shadow-lg transition-all active:scale-[0.99] ${
                              a.is_default
                                ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5"
                                : "border-[var(--user-border)]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-bold text-[var(--user-text)] capitalize">
                                {a.full_name}
                              </p>
                              {a.is_default && (
                                <span className="text-[0.5rem] font-black text-[var(--user-accent)] bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/30 px-1.5 py-0.5 rounded shrink-0">
                                  DEFAULT
                                </span>
                              )}
                            </div>

                            <div className="flex-1 space-y-1.5">
                              <p className="text-xs text-[var(--user-text)] leading-relaxed">
                                {a.street_address1}
                                {a.street_address2 && <>, {a.street_address2}</>}
                              </p>
                              <p className="text-xs text-[var(--user-text-muted)] leading-relaxed">
                                {a.city}, {a.state} {a.zip_code && `(${a.zip_code})`}
                              </p>
                              <p className="text-xs text-[var(--user-text-muted)]">{a.country}</p>
                            </div>

                            <div className="flex items-center gap-1.5 pt-3 mt-3 border-t border-[var(--user-border)]">
                              <span className="text-[0.6875rem] text-[var(--user-text-secondary)] flex items-center gap-1 flex-1">
                                <Phone size={11} className="text-[var(--user-accent)]" /> {a.phone}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 pt-3">
                              {!a.is_default && (
                                <button
                                  onClick={() => setDefaultAddress(a)}
                                  className="flex-1 h-8 rounded-md text-[0.625rem] font-bold text-[var(--user-accent)] hover:bg-[var(--user-accent)]/10 transition flex items-center justify-center gap-1 active:scale-95"
                                >
                                  <Star size={11} /> Default
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditAddress(a);
                                  setShowAddressModal(true);
                                }}
                                className="flex-1 h-8 rounded-md text-[0.625rem] font-bold text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)] transition flex items-center justify-center gap-1 active:scale-95"
                              >
                                <Pencil size={11} /> Edit
                              </button>
                              <button
                                onClick={() => setDeleteAddressId(a._id)}
                                className="flex-1 h-8 rounded-md text-[0.625rem] font-bold text-[var(--user-danger)] hover:bg-[var(--user-danger)]/10 transition flex items-center justify-center gap-1 active:scale-95"
                              >
                                <Trash2 size={11} /> Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              )}


              {/* ============ SETTING ============ */}
              {tab === "settings" && (
                <div className="grid xl:grid-cols-[minmax(0,1fr)_19rem] gap-4 items-start">
                  <div className="space-y-4 min-w-0">
                    {/* change password */}
                    <Card className="overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-[var(--user-accent)] via-[var(--user-accent-hover)] to-transparent" />
                      <CardHeader
                        icon={KeyRound}
                        title="Change Password"
                        subtitle="Use a strong password you don't use anywhere else"
                      />
                      <div className="p-4 sm:p-5 space-y-3">
                        <div>
                          <label className={labelCls}>Current Password</label>
                          <div className="relative">
                            <input
                              type={showPw ? "text" : "password"}
                              value={pwForm.current}
                              onChange={(e) =>
                                setPwForm({ ...pwForm, current: e.target.value })
                              }
                              placeholder="Current password"
                              className={inputCls + " pr-10"}
                            />
                            <button
                              onClick={() => setShowPw(!showPw)}
                              aria-label={showPw ? "Hide password" : "Show password"}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--user-text-subtle)] hover:text-[var(--user-text)] transition"
                            >
                              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className={labelCls}>New Password</label>
                            <input
                              type={showPw ? "text" : "password"}
                              value={pwForm.next}
                              onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                              placeholder="New password"
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Confirm New Password</label>
                            <input
                              type={showPw ? "text" : "password"}
                              value={pwForm.confirm}
                              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                              placeholder="Confirm new password"
                              className={inputCls}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            onClick={savePassword}
                            disabled={savingPw}
                            className={btnPrimary}
                          >
                            {savingPw ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <ShieldCheck size={13} />
                            )}
                            Update Password
                          </button>
                        </div>

                        {/* password strength */}
                        {pwForm.next ? (
                          <div>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-[0.625rem] font-bold uppercase tracking-wider text-[var(--user-text-subtle)]">
                                Password strength
                              </span>
                              <span
                                className={`text-[0.625rem] font-black uppercase tracking-wider ${
                                  pwStrength >= 3
                                    ? "text-emerald-500"
                                    : pwStrength === 2
                                      ? "text-orange-500"
                                      : "text-red-500"
                                }`}
                              >
                                {pwStrengthMeta.label}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map((segment) => (
                                <span
                                  key={segment}
                                  className={`h-1.5 flex-1 rounded-full ${
                                    segment <= pwStrength
                                      ? pwStrengthMeta.bar
                                      : "bg-[var(--user-bg-hover)]"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* security tip */}
                        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--user-accent)]/25 bg-[var(--user-accent-soft)] px-3.5 py-3">
                          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--user-accent)]" />
                          <p className="text-[0.6875rem] leading-relaxed text-[var(--user-text-muted)]">
                            Use 10+ characters with uppercase, numbers and symbols — and never
                            reuse a password from another site.
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>


                  {/* right rail — account details */}
                  <div className="space-y-4 min-w-0">
                    <Card className="overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-[var(--user-accent)] via-[var(--user-accent-hover)] to-transparent" />
                      <CardHeader
                        icon={Globe}
                        title="Account Details"
                        subtitle="Read-only information from your account"
                      />
                      <div className="divide-y divide-[var(--user-border)]">
                        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                          <span className="w-8 h-8 rounded-lg bg-[var(--user-bg-hover)] text-[var(--user-accent)] flex items-center justify-center shrink-0">
                            <Mail size={14} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[0.625rem] text-[var(--user-text-muted)] uppercase tracking-wider">
                              Email
                            </p>
                            <p className="text-[0.8125rem] font-semibold text-[var(--user-text)] truncate">
                              {user.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                          <span className="w-8 h-8 rounded-lg bg-[var(--user-bg-hover)] text-[var(--user-accent)] flex items-center justify-center shrink-0">
                            <Globe size={14} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[0.625rem] text-[var(--user-text-muted)] uppercase tracking-wider">
                              Sign-in Method
                            </p>
                            <p className="text-[0.8125rem] font-semibold text-[var(--user-text)] truncate">
                              {user.provider === "google" ? "Google" : "Email & Password"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                          <span className="w-8 h-8 rounded-lg bg-[var(--user-bg-hover)] text-[var(--user-accent)] flex items-center justify-center shrink-0">
                            <ShieldCheck size={14} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[0.625rem] text-[var(--user-text-muted)] uppercase tracking-wider">
                              Account Status
                            </p>
                            <div className="mt-1">
                              <StatusPill status={accountStatus} size="sm" />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                          <span className="w-8 h-8 rounded-lg bg-[var(--user-bg-hover)] text-[var(--user-accent)] flex items-center justify-center shrink-0">
                            <Calendar size={14} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[0.625rem] text-[var(--user-text-muted)] uppercase tracking-wider">
                              Member Since
                            </p>
                            <p className="text-[0.8125rem] font-semibold text-[var(--user-text)] truncate">
                              {memberSince || "—"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                          <span className="w-8 h-8 rounded-lg bg-[var(--user-bg-hover)] text-[var(--user-accent)] flex items-center justify-center shrink-0">
                            <Clock size={14} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[0.625rem] text-[var(--user-text-muted)] uppercase tracking-wider">
                              Last Updated
                            </p>
                            <p className="text-[0.8125rem] font-semibold text-[var(--user-text)] truncate">
                              {fmtDate(user.updated_at) || "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-[var(--user-accent)] via-[var(--user-accent-hover)] to-transparent" />
                      <CardHeader
                        icon={MapPin}
                        title="Default Address"
                        subtitle="Used automatically at checkout"
                        action={
                          <button
                            onClick={() => navigate("address")}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--user-border)] px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-text-muted)] transition-colors hover:border-[var(--user-accent)] hover:text-[var(--user-accent)]"
                          >
                            Manage
                            <ChevronRight size={12} />
                          </button>
                        }
                      />
                      {(() => {
                        const defaultAddress = addresses.find((a) => a.is_default);
                        if (!defaultAddress) {
                          return (
                            <div className="px-4 sm:px-5 py-5 text-center">
                              <span className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--user-bg-hover)] text-[var(--user-text-subtle)]">
                                <MapPin size={18} />
                              </span>
                              <p className="text-[0.8125rem] font-bold text-[var(--user-text)]">
                                {addresses.length ? "No default address set" : "No saved addresses"}
                              </p>
                              <p className="mt-1 text-[0.6875rem] text-[var(--user-text-muted)]">
                                {addresses.length
                                  ? "Pick one as default from your addresses."
                                  : "Add an address to make checkout faster."}
                              </p>
                              <button
                                onClick={() => navigate("address")}
                                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--user-accent)] px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-accent-text)] transition-opacity hover:opacity-90"
                              >
                                {addresses.length ? "Choose Default" : "Add Address"}
                              </button>
                            </div>
                          );
                        }
                        return (
                          <div className="px-4 sm:px-5 py-4">
                            <div className="rounded-xl border-2 border-[var(--user-accent)] bg-[var(--user-accent)]/5 p-3.5">
                              <div className="mb-1.5 flex items-start justify-between gap-2">
                                <p className="text-[0.8125rem] font-bold capitalize text-[var(--user-text)]">
                                  {defaultAddress.full_name}
                                </p>
                                <span className="shrink-0 rounded border border-[var(--user-accent)]/30 bg-[var(--user-accent)]/10 px-1.5 py-0.5 text-[0.5rem] font-black text-[var(--user-accent)]">
                                  DEFAULT
                                </span>
                              </div>
                              <p className="text-[0.6875rem] leading-relaxed text-[var(--user-text)]">
                                {defaultAddress.street_address1}
                                {defaultAddress.street_address2 && <>, {defaultAddress.street_address2}</>}
                              </p>
                              <p className="text-[0.6875rem] leading-relaxed text-[var(--user-text-muted)]">
                                {defaultAddress.city}, {defaultAddress.state}
                                {defaultAddress.zip_code && ` (${defaultAddress.zip_code})`} · {defaultAddress.country}
                              </p>
                              <p className="mt-1.5 flex items-center gap-1 text-[0.6875rem] font-semibold text-[var(--user-text-secondary)]">
                                <Phone size={11} className="text-[var(--user-accent)]" />
                                {defaultAddress.phone}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </Card>

                    <Card className="overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-[var(--user-accent)] via-[var(--user-accent-hover)] to-transparent" />
                      <CardHeader icon={Star} title="Quick Actions" subtitle="Jump to your stuff" />
                      <div className="space-y-0.5 p-2">
                        {[
                          { id: "orders", label: "My Orders", icon: Package, count: counts.orders },
                          { id: "wishlist", label: "Wishlist", icon: Heart, count: counts.wishlist },
                          { id: "address", label: "Addresses", icon: MapPin, count: counts.address },
                        ].map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => navigate(item.id)}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--user-bg-hover)]"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--user-bg-hover)] text-[var(--user-accent)]">
                                <Icon size={14} />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-bold text-[var(--user-text)]">
                                {item.label}
                              </span>
                              {item.count > 0 ? (
                                <span className="shrink-0 rounded-full bg-[var(--user-bg-hover)] px-1.5 py-0.5 text-[0.625rem] font-bold text-[var(--user-text-subtle)]">
                                  {item.count}
                                </span>
                              ) : null}
                              <ChevronRight size={14} className="shrink-0 text-[var(--user-text-subtle)]" />
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* ---------- modals (address form / delete confirm / mobile filter) ---------- */}
      {showAddressModal && (
        <AddressForm
          initialAddress={editAddress}
          onSuccess={() => {
            setShowAddressModal(false);
            refreshAddresses();
          }}
          onCancel={() => setShowAddressModal(false)}
        />
      )}

      {deleteAddressId && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setDeleteAddressId(null)}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border-t-2 sm:border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-black text-[var(--user-text)] mb-2">
              Delete this address?
            </h3>
            <p className="text-xs text-[var(--user-text-muted)] mb-5">
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteAddressId(null)}
                className="flex-1 h-10 sm:h-9 rounded-xl border border-[var(--user-border)] text-xs font-bold text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition"
              >
                Cancel
              </button>
              <button
                onClick={removeAddress}
                className="flex-1 h-10 sm:h-9 rounded-xl bg-[var(--user-danger)] text-white text-xs font-bold hover:opacity-90 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

