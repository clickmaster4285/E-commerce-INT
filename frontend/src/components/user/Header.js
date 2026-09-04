"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCart } from "./CartContext";
import { useWishlist } from "./WishlistContext";
import axiosInstance from "@/apis/axiosInstance";
import { categoryApi } from "@/apis/user/categoryApi";
import { brandApi } from "@/apis/user/brandApi";
import { productApi } from "@/apis/user/productApi";
import { storeApi } from "@/apis/user/storeApi";
import Cookies from "js-cookie";
import LoginModal from "./LoginModal";

import {
  Menu,
  Search,
  User,
  ShoppingCart,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
  Smartphone,
  Laptop,
  Watch,
  Headphones,
  Camera,
  Percent,
  FolderOpen,
  Tv,
  Gamepad2,
  ShoppingBag,
  Shirt,
  Store,
  Sun,
  Moon,
  Heart,
  Package,
    Settings,

} from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const getIcon = (name) => {
  if (!name) return <FolderOpen size={17} />;
  const n = name.toLowerCase();
  if (n.includes("mobile") || n.includes("phone")) return <Smartphone size={17} />;
  if (n.includes("laptop") || n.includes("computer")) return <Laptop size={17} />;
  if (n.includes("watch")) return <Watch size={17} />;
  if (n.includes("headphone") || n.includes("earbud") || n.includes("audio")) return <Headphones size={17} />;
  if (n.includes("camera") || n.includes("photo")) return <Camera size={17} />;
  if (n.includes("deal") || n.includes("discount") || n.includes("offer")) return <Percent size={17} />;
  if (n.includes("tv") || n.includes("monitor")) return <Tv size={17} />;
  if (n.includes("game")) return <Gamepad2 size={17} />;
  if (n.includes("cloth") || n.includes("fashion")) return <Shirt size={17} />;
  if (n.includes("accessor")) return <ShoppingBag size={17} />;
  return <FolderOpen size={17} />;
};

function SearchBox({ value, onChange, onSubmit }) {
  return (
    <div className="relative flex w-full items-center">
      <Search size={16} className="absolute left-4 text-[var(--user-text-subtle)] pointer-events-none" />
      <input
        value={value}
        onChange={onChange}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="Search products..."
        className="w-full h-10 lg:h-11 rounded-full bg-[var(--user-bg-input)] border border-[var(--user-border)] pl-11 pr-14 lg:pr-24 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15 transition"
      />
      <button
        onClick={onSubmit}
        aria-label="Search"
        className="absolute right-1 h-8 lg:h-9 px-3 lg:px-4 rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-bold hover:opacity-90 active:scale-95 transition flex items-center gap-1.5"
      >
        <Search size={14} />
        <span className="hidden lg:inline">Search</span>
      </button>
    </div>
  );
}

function Avatar({ user, sizeClass = "w-9 h-9", textClass = "text-sm" }) {
  const [failed, setFailed] = useState(false);
  const url = user?.avatar || user?.picture || null;
  const letter = (user?.name || user?.email || "U").charAt(0).toUpperCase();

  if (!url || failed) {
    return (
      <div className={`${sizeClass} rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)] font-black ${textClass} flex items-center justify-center shrink-0`}>
        {letter}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={user?.name || "User"}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full border-2 border-[var(--user-accent)] object-cover shrink-0`}
    />
  );
}

function StoreLogo({ store, sizeClass = "w-8 h-8 lg:w-9 lg:h-9" }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = store?.logo?.img_url
    ? store.logo.img_url.startsWith("http")
      ? store.logo.img_url
      : `${API_ORIGIN}/${store.logo.img_url}`
    : null;
  const letter = (store?.store_name || "C").charAt(0).toUpperCase();

  if (!logoUrl || failed) {
    return (
      <span className={`${sizeClass} rounded-lg bg-[var(--user-accent)] text-[var(--user-accent-text)] font-black text-base lg:text-lg flex items-center justify-center`}>
        {letter}
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={store?.store_name || "Store"}
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-lg object-cover`}
    />
  );
}

export default function Header() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [isMobile, setIsMobile] = useState(false);
  const { count, setIsCartOpen } = useCart();
  const { count: wishlistCount } = useWishlist();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open || profileOpen || loginOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, profileOpen, loginOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const saved = Cookies.get("user-theme") || "dark";
    setTheme(saved);
    const el = document.getElementById("user-theme");
    if (el) el.classList.toggle("light", saved === "light");
  }, []);
// ✅ Mobile detect — cart ko page vs drawer decide karne ke liye
useEffect(() => {
  const mq = window.matchMedia("(max-width: 767px)");
  setIsMobile(mq.matches);
  const onChange = (e) => setIsMobile(e.matches);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    Cookies.set("user-theme", next, {
      expires: 365,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    const el = document.getElementById("user-theme");
    if (el) el.classList.toggle("light", next === "light");
  };

  const { data: user = null } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

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

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: brandApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const topCategories = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      const id = typeof p.category_id === "object" ? p.category_id?._id : p.category_id;
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return categories
      .map((c) => ({ ...c, count: counts[c._id] || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [categories, products]);

    // ✅ Brand products count — products list se calculate
  const brandCounts = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      const id = typeof p.brand_id === "object" ? p.brand_id?._id : p.brand_id;
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }, [products]);

  const topBrands = useMemo(() => {
    return [...brands]
      .sort((a, b) => (brandCounts[b._id] || 0) - (brandCounts[a._id] || 0))
      .slice(0, 5);
  }, [brands, brandCounts]);

  const handleLogout = async () => {
    try {
      await axiosInstance.post("/users/logout");
    } catch {}
    queryClient.removeQueries({ queryKey: ["userProfile"] });
    setProfileOpen(false);
    setOpen(false);
    window.location.href = "/";
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      router.push(`/products?q=${encodeURIComponent(searchTerm.trim())}`);
      setSearchTerm("");
      setMobileSearchOpen(false);
    }
  };

  const getLogoUrl = (logo) => {
    const raw = typeof logo === "string" ? logo : logo?.img_url;
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${API_ORIGIN}${path}`;
  };

  const storeName = store?.store_name || "";

  // ✅ TIGHTER DESKTOP SPACING — smaller buttons + less gap
  const iconBtn =
    "relative w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition";

  return (
    <>
      <style>{`@keyframes badgePop { 0% { transform: scale(0.4); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }`}</style>

      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" />
      )}

      <header
        className={`sticky top-0 z-50 border-b border-[var(--user-border)] transition-shadow duration-300 ${
          scrolled ? "shadow-[var(--user-shadow-md)]" : ""
        }`}
      >
        <div className="absolute inset-0 bg-[var(--user-bg-elevated)]/95 backdrop-blur-md pointer-events-none" />

        <div className="relative max-w-[1400px] mx-auto px-4 lg:px-6">
          {/* ✅ TIGHTER: lg:gap-3 (was lg:gap-4) */}
          <div className="h-14 lg:h-16 flex items-center gap-1.5 lg:gap-3">
            {/* LEFT — Menu + Logo — ✅ TIGHTER: lg:gap-1.5 */}
            <div className="flex items-center gap-0.5 lg:gap-1.5 shrink-0">
              <button
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] active:scale-95 transition"
              >
                <Menu size={19} />
              </button>

              <Link href="/" className="flex items-center gap-1.5">
                <StoreLogo store={store} />
                <span className="font-black text-sm lg:text-lg tracking-wide text-[var(--user-text)] hidden sm:block">
                  {storeName}
                </span>
              </Link>
            </div>

            {/* CENTER — Search (desktop only, unchanged) */}
            <div className="hidden md:block flex-1 max-w-2xl mx-auto">
              <SearchBox
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onSubmit={handleSearch}
              />
            </div>

            {/* ✅ RIGHT — TIGHTER GAP: lg:gap-0.5 (was lg:gap-1.5) */}
            <div className="flex items-center gap-0 lg:gap-0.5 ml-auto shrink-0">
              {/* MOBILE SEARCH TOGGLE */}
              <button
                onClick={() => setMobileSearchOpen((v) => !v)}
                aria-label={mobileSearchOpen ? "Close search" : "Open search"}
                className={`${iconBtn} md:hidden`}
              >
                {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
              </button>

              {/* THEME — desktop only */}
              <button
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                aria-label="Toggle theme"
                className={`${iconBtn} hidden md:flex`}
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </button>

              {/* WISHLIST */}
              <Link href="/wishlist" title="My Wishlist" aria-label="My Wishlist" className={iconBtn}>
                <Heart size={18} />
                {wishlistCount > 0 && (
                  <span
                    key={wishlistCount}
                    className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--user-danger)] text-white text-[9px] font-bold flex items-center justify-center border-2 border-[var(--user-bg-elevated)]"
                    style={{ animation: "badgePop .25s ease-out" }}
                  >
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* CART */}
             <button
  onClick={() => (isMobile ? router.push("/cart") : setIsCartOpen(true))}
  title="Cart"
  aria-label={`Open cart, ${count} items`}
  className={iconBtn}
>
                <ShoppingCart size={18} />
                {count > 0 && (
                  <span
                    key={count}
                    className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[9px] font-bold flex items-center justify-center border-2 border-[var(--user-bg-elevated)]"
                    style={{ animation: "badgePop .25s ease-out" }}
                  >
                    {count}
                  </span>
                )}
              </button>

              {/* ACCOUNT / LOGIN */}
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    aria-label="Account menu"
                    className="flex items-center gap-1 pl-0.5 pr-0.5 lg:pr-1.5 py-0.5 rounded-lg hover:bg-[var(--user-bg-hover)] active:scale-95 transition"
                  >
                    <Avatar user={user} sizeClass="w-8 h-8 lg:w-9 lg:h-9" textClass="text-xs lg:text-sm" />
                    <ChevronDown
                      size={12}
                      className={`hidden lg:block text-[var(--user-text-muted)] transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 top-11 w-60 bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-2xl shadow-[var(--user-shadow-lg)] z-50 p-2">
                        <div className="px-3 py-2.5 border-b border-[var(--user-border)] mb-1">
                          <p className="text-[var(--user-text)] text-sm font-semibold truncate">
                            {user.name || user.username}
                          </p>
                          <p className="text-[var(--user-text-muted)] text-xs truncate">{user.email}</p>
                        </div>
                        <Link
                          href="/account"
                          onClick={() => setProfileOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] text-sm transition"
                        >
                          <User size={16} className="text-[var(--user-accent)]" />
                          My Account
                        </Link>
                        <Link
                          href="/orders"
                          onClick={() => setProfileOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] text-sm transition"
                        >
                          <Package size={16} className="text-[var(--user-accent)]" />
                          My Orders
                        </Link>
                        <div className="h-px bg-[var(--user-border)] my-1" />
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[var(--user-danger)] hover:bg-red-500/10 text-sm transition"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setLoginOpen(true)}
                  className="flex items-center gap-1 h-8 px-2.5 lg:px-3 ml-1 rounded-lg bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-bold hover:opacity-90 active:scale-95 transition"
                >
                  <User size={13} />
                  Login
                </button>
              )}
            </div>
          </div>

          {/* MOBILE SEARCH — expandable */}
          {mobileSearchOpen && (
            <div className="md:hidden pb-3">
              <SearchBox
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onSubmit={handleSearch}
              />
            </div>
          )}
        </div>
      </header>

         {/* ✅ PREMIUM SIDEBAR — 10x Improved + All Fixes Applied */}
      <div
        className={`fixed top-0 left-0 h-full w-[85%] max-w-[340px] bg-[var(--user-bg-elevated)] z-50 shadow-2xl transition-transform duration-500 ease-out flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ transformOrigin: "left center" }}
      >
        <style>{`
          @keyframes sidebarSlideIn {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .sidebar-item {
            animation: sidebarSlideIn 0.4s ease-out backwards;
          }
          .sidebar-item:nth-child(1) { animation-delay: 0.05s; }
          .sidebar-item:nth-child(2) { animation-delay: 0.1s; }
          .sidebar-item:nth-child(3) { animation-delay: 0.15s; }
          .sidebar-item:nth-child(4) { animation-delay: 0.2s; }
          .sidebar-item:nth-child(5) { animation-delay: 0.25s; }
        `}</style>

        {/* HEADER — Logo + Close */}
        <div className="p-5 border-b border-[var(--user-border)] shrink-0 bg-gradient-to-br from-[var(--user-bg-card)] to-[var(--user-bg-hover)]">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5 group">
              <div className="relative">
                <StoreLogo store={store} sizeClass="w-10 h-10" />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[var(--user-success)] rounded-full border-2 border-[var(--user-bg-elevated)]" />
              </div>
              <div>
                <span className="font-black text-base tracking-wide text-[var(--user-text)] block leading-tight">
                  {storeName}
                </span>
                <span className="text-[10px] font-semibold text-[var(--user-text-muted)] uppercase tracking-wider">
                  Shop Premium
                </span>
              </div>
            </Link>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="w-9 h-9 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center hover:bg-[var(--user-danger)] hover:border-[var(--user-danger)] hover:text-white transition-all duration-300 hover:rotate-90 active:scale-90"
            >
              <X size={16} className="text-[var(--user-text)] hover:text-white" />
            </button>
          </div>

          {/* USER GREETING */}
          {user ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/20">
              <Avatar user={user} sizeClass="w-11 h-11" textClass="text-base" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--user-text-muted)] mb-0.5">Welcome back,</p>
                <p className="text-sm font-bold text-[var(--user-text)] truncate">
                  {user.name || user.username}
                </p>
              </div>
              <div className="shrink-0">
                <div className="w-2 h-2 rounded-full bg-[var(--user-success)] animate-pulse" />
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setOpen(false); setLoginOpen(true); }}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-bold hover:opacity-90 transition active:scale-95"
            >
              <User size={16} />
              Login / Sign Up
            </button>
          )}
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* QUICK ACTIONS GRID */}
          {user && (
            <div className="p-5 border-b border-[var(--user-border)]">
              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="sidebar-item flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:border-[var(--user-accent)] hover:shadow-lg hover:shadow-[var(--user-accent)]/10 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--user-accent)]/10 flex items-center justify-center">
                    <User size={18} className="text-[var(--user-accent)]" />
                  </div>
                  <span className="text-xs font-bold text-[var(--user-text)]">Account</span>
                </Link>

                <Link
                  href="/orders"
                  onClick={() => setOpen(false)}
                  className="sidebar-item flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:border-[var(--user-accent)] hover:shadow-lg hover:shadow-[var(--user-accent)]/10 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--user-accent)]/10 flex items-center justify-center">
                    <Package size={18} className="text-[var(--user-accent)]" />
                  </div>
                  <span className="text-xs font-bold text-[var(--user-text)]">Orders</span>
                </Link>

                <Link
                  href="/wishlist"
                  onClick={() => setOpen(false)}
                  className="sidebar-item flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:border-[var(--user-accent)] hover:shadow-lg hover:shadow-[var(--user-accent)]/10 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--user-accent)]/10 flex items-center justify-center relative">
                    <Heart size={18} className="text-[var(--user-accent)]" />
                    {wishlistCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--user-danger)] text-white text-[9px] font-bold flex items-center justify-center">
                        {wishlistCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-[var(--user-text)]">Wishlist</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="sidebar-item flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:border-[var(--user-danger)] hover:bg-[var(--user-danger)]/10 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--user-danger)]/10 flex items-center justify-center">
                    <LogOut size={18} className="text-[var(--user-danger)]" />
                  </div>
                  <span className="text-xs font-bold text-[var(--user-danger)]">Logout</span>
                </button>
              </div>
            </div>
          )}

          {/* CATEGORIES */}
          <div className="p-5 border-b border-[var(--user-border)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--user-text)]">
                Top Categories
              </h3>
             
            </div>
            <div className="space-y-1">
              {topCategories.map((category, idx) => (
                <Link
                  key={category._id}
                  href={`/category/${category._id}`}
                  onClick={() => setOpen(false)}
                  className="sidebar-item flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gradient-to-r hover:from-[var(--user-accent)]/10 hover:to-[var(--user-accent)]/5 transition-all duration-300 group active:scale-[0.98]"
                  style={{ animationDelay: `${0.05 * (idx + 1)}s` }}
                >
                  <span className="w-10 h-10 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-accent)] group-hover:bg-[var(--user-accent)] group-hover:text-[var(--user-accent-text)] group-hover:shadow-md transition-all duration-300 shrink-0">
                    {getIcon(category.name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-[var(--user-text)] group-hover:text-[var(--user-accent)] transition-colors capitalize block truncate">
                      {category.name}
                    </span>
                    <span className="text-[10px] text-[var(--user-text-muted)]">
                      {category.count} products
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-[var(--user-text-subtle)] group-hover:text-[var(--user-accent)] group-hover:translate-x-1 transition-all shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* BRANDS — ✅ FIXED: Products count from brandCounts */}
          <div className="p-5 border-b border-[var(--user-border)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--user-text)]">
                Top Brands
              </h3>
            
            </div>
            <div className="space-y-1">
              {topBrands.map((brand, idx) => {
                const logoUrl = getLogoUrl(brand.logo);
                const productCount = brandCounts?.[brand._id] || brand.products?.length || 0;
                return (
                  <Link
                    key={brand._id}
                    href={`/brand/${brand._id}`}
                    onClick={() => setOpen(false)}
                    className="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-[var(--user-accent)]/10 hover:to-[var(--user-accent)]/5 transition-all duration-300 group active:scale-[0.98]"
                    style={{ animationDelay: `${0.05 * (idx + 1)}s` }}
                  >
                    {logoUrl ? (
                      <span className="w-10 h-10 rounded-full bg-white p-2 shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                        <img src={logoUrl} alt={brand.name} className="w-full h-full object-contain" />
                      </span>
                    ) : (
                      <span className="w-10 h-10 rounded-full bg-[var(--user-accent)] flex items-center justify-center text-[var(--user-accent-text)] text-sm font-black shrink-0 group-hover:shadow-md transition-shadow">
                        {brand.name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-[var(--user-text)] group-hover:text-[var(--user-accent)] transition-colors capitalize block truncate">
                        {brand.name}
                      </span>
                      <span className="text-[10px] text-[var(--user-text-muted)]">
                        {productCount} products
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-[var(--user-text-subtle)] group-hover:text-[var(--user-accent)] group-hover:translate-x-1 transition-all shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* THEME TOGGLE — ✅ FIXED: Better visibility in dark mode */}
          <div className="p-5 border-b border-[var(--user-border)]">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:border-[var(--user-accent)] transition-all duration-300 group active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--user-accent)]/10 flex items-center justify-center">
                  {theme === "dark" ? (
                    <Sun size={18} className="text-[var(--user-accent)]" />
                  ) : (
                    <Moon size={18} className="text-[var(--user-accent)]" />
                  )}
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold text-[var(--user-text)] block">
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </span>
                  <span className="text-[10px] text-[var(--user-text-muted)]">
                    Switch theme appearance
                  </span>
                </div>
              </div>
              <div className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${theme === "dark" ? "bg-emerald-500" : "bg-slate-300"}`}>
                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 flex items-center justify-center ${theme === "dark" ? "left-6" : "left-1"}`}>
                  {theme === "dark" ? <Moon size={11} className="text-emerald-500" /> : <Sun size={11} className="text-amber-500" />}
                </div>
              </div>
            </button>
          </div>

          {/* ✅ SETTINGS ONLY — Removed Help/About */}
          <div className="p-5">
            <Link
              href="/account?tab=settings"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new CustomEvent("account:tab", { detail: "settings" }));
              }}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:border-[var(--user-accent)] hover:shadow-lg transition-all duration-300 group active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--user-accent)]/10 flex items-center justify-center">
                <Settings size={18} className="text-[var(--user-accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-[var(--user-text)] block">Settings</span>
                <span className="text-[10px] text-[var(--user-text-muted)]">Manage your account preferences</span>
              </div>
              <ChevronRight size={14} className="text-[var(--user-text-subtle)] group-hover:text-[var(--user-accent)] group-hover:translate-x-1 transition-all shrink-0" />
            </Link>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-[var(--user-border)] shrink-0 bg-[var(--user-bg-card)]">
          <p className="text-[10px] text-[var(--user-text-subtle)] text-center">
            © 2026 {storeName}. All rights reserved.
          </p>
        </div>
      </div>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}