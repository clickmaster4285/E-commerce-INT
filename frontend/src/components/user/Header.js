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

  const topBrands = useMemo(() => {
    return [...brands]
      .sort((a, b) => (b.products?.length || 0) - (a.products?.length || 0))
      .slice(0, 5);
  }, [brands]);

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
                onClick={() => setIsCartOpen(true)}
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

      {/* SIDEBAR (unchanged) */}
      <div
        className={`fixed top-0 left-0 h-full w-[85%] max-w-[320px] bg-[var(--user-bg-elevated)] z-50 shadow-[var(--user-shadow-lg)] transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 border-b border-[var(--user-border)] shrink-0">
          <div className="flex items-center justify-between mb-5">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2">
              <StoreLogo store={store} sizeClass="w-8 h-8" />
              <span className="font-black text-base tracking-wide text-[var(--user-text)]">
                {storeName}
              </span>
            </Link>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="w-8 h-8 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center hover:bg-[var(--user-bg-hover)] hover:rotate-90 transition duration-300"
            >
              <X size={16} className="text-[var(--user-text)]" />
            </button>
          </div>

          {user ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Avatar user={user} sizeClass="w-11 h-11" textClass="text-base" />
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--user-text)] text-sm font-semibold truncate">
                    {user.name || user.username}
                  </p>
                  <p className="text-[var(--user-text-muted)] text-xs truncate">{user.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] transition group"
                >
                  <User size={16} className="text-[var(--user-accent)] group-hover:text-[var(--user-accent-text)]" />
                  <span className="text-sm font-semibold text-[var(--user-text-secondary)] group-hover:text-[var(--user-accent-text)] flex-1">
                    My Account
                  </span>
                  <ChevronRight size={14} className="text-[var(--user-text-muted)] group-hover:text-[var(--user-accent-text)]" />
                </Link>

                <Link
                  href="/orders"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] transition group"
                >
                  <Package size={16} className="text-[var(--user-accent)] group-hover:text-[var(--user-accent-text)]" />
                  <span className="text-sm font-semibold text-[var(--user-text-secondary)] group-hover:text-[var(--user-accent-text)] flex-1">
                    My Orders
                  </span>
                  <ChevronRight size={14} className="text-[var(--user-text-muted)] group-hover:text-[var(--user-accent-text)]" />
                </Link>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:bg-[var(--user-danger)]/10 hover:border-[var(--user-danger)]/30 transition"
                >
                  <LogOut size={16} className="text-[var(--user-danger)]" />
                  <span className="text-sm font-semibold text-[var(--user-danger)] flex-1 text-left">Logout</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[var(--user-text-muted)] text-xs mb-3">Login to manage orders & account</p>
              <div className="grid grid-cols-2 my-3 gap-2">
                <button
                  onClick={() => { setOpen(false); setLoginOpen(true); }}
                  className="h-10 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-bold flex items-center justify-center hover:opacity-90 transition w-full"
                >
                  Login
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-7">
          <div className="md:hidden">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:bg-[var(--user-bg-hover)] transition"
            >
              {theme === "dark" ? (
                <Sun size={16} className="text-[var(--user-accent)]" />
              ) : (
                <Moon size={16} className="text-[var(--user-accent)]" />
              )}
              <span className="text-sm font-semibold text-[var(--user-text-secondary)] flex-1 text-left">
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
              <span
                className={`w-9 h-5 rounded-full relative transition-colors ${theme === "dark" ? "bg-[var(--user-accent)]" : "bg-[var(--user-border)]"}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${theme === "dark" ? "left-[18px]" : "left-0.5"}`}
                />
              </span>
            </button>
          </div>

          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--user-text-subtle)] mb-3">
              Top Categories
            </h3>
            <div className="space-y-1">
              {topCategories.map((category) => (
                <Link
                  key={category._id}
                  href={`/category/${category._id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--user-bg-hover)] transition group"
                >
                  <span className="w-9 h-9 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-accent)] group-hover:bg-[var(--user-accent)] group-hover:text-[var(--user-accent-text)] transition shrink-0">
                    {getIcon(category.name)}
                  </span>
                  <span className="text-sm text-[var(--user-text-secondary)] flex-1 capitalize truncate">
                    {category.name}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--user-text-subtle)] bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-full px-2 py-0.5 shrink-0">
                    {category.count}
                  </span>
                  <ChevronRight size={14} className="text-[var(--user-text-subtle)] group-hover:text-[var(--user-accent)] transition shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--user-text-subtle)] mb-3">
              Top Brands
            </h3>
            <div className="space-y-1">
              {topBrands.map((brand) => {
                const logoUrl = getLogoUrl(brand.logo);
                return (
                  <Link
                    key={brand._id}
                    href={`/brand/${brand._id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[var(--user-bg-hover)] transition group"
                  >
                    {logoUrl ? (
                      <span className="w-8 h-8 rounded-full bg-[var(--user-text)] flex items-center justify-center p-1.5 shrink-0">
                        <img src={logoUrl} alt={brand.name} className="max-h-full max-w-full object-contain" />
                      </span>
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-accent)] text-xs font-black shrink-0">
                        {brand.name?.charAt(0)}
                      </span>
                    )}
                    <span className="text-sm text-[var(--user-text-secondary)] flex-1 capitalize truncate">{brand.name}</span>
                    <span className="text-[10px] font-bold text-[var(--user-text-subtle)] bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-full px-2 py-0.5 shrink-0">
                      {brand.products?.length || 0}
                    </span>
                    <ChevronRight size={14} className="text-[var(--user-text-subtle)] group-hover:text-[var(--user-accent)] transition shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--user-border)] shrink-0">
          <p className="text-[10px] text-[var(--user-text-subtle)] text-center">© 2026 {storeName}</p>
        </div>
      </div>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}