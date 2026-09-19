"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCart } from "./CartContext";
import { useWishlist } from "./WishlistContext";
import axiosInstance from "@/apis/axiosInstance";
import { categoryApi } from "@/apis/user/categoryApi";
import { brandApi } from "@/apis/user/brandApi";
import { productApi } from "@/apis/user/productApi";
import { storeApi } from "@/apis/admin/storeApi";
import Cookies from "js-cookie"; // ✅ Cookies library import

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
} from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

// ✅ Smart category icon
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

// ✅ Search box (outside component = focus safe)
function SearchBox({ value, onChange, onSubmit }) {
  return (
    <div className="flex w-full">
      <input
        value={value}
        onChange={onChange}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="Search products..."
        className="flex-1 h-10 rounded-l-lg bg-[var(--user-bg-input)] border border-r-0 border-[var(--user-border)] pl-4 pr-3 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] transition"
      />
      <button
        onClick={onSubmit}
        className="h-10 w-12 rounded-r-lg bg-[var(--user-accent)] text-[var(--user-accent-text)] hover:bg-[var(--user-accent-hover)] active:scale-95 transition flex items-center justify-center shrink-0"
      >
        <Search size={17} />
      </button>
    </div>
  );
}

// ✅ Avatar — Google image safe + fallback letter
function Avatar({ user, sizeClass = "w-9 h-9", textClass = "text-sm" }) {
  const [failed, setFailed] = useState(false);
  const url = user?.avatar || user?.picture || null;
  const letter = (user?.name || user?.email || "U").charAt(0).toUpperCase();

  if (!url || failed) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)] font-black ${textClass} flex items-center justify-center shrink-0`}
      >
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

// ✅ Store Logo — dynamic + fallback letter
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
  const [searchTerm, setSearchTerm] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState("dark");
  const { count, setIsCartOpen } = useCart();
  const { count: wishlistCount } = useWishlist();
  const queryClient = useQueryClient();

  // ✅ BODY SCROLL LOCK
  useEffect(() => {
    if (open || profileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, profileOpen]);

  // ✅ SCROLL SHADOW
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ✅ THEME: Cookies se load karein
  useEffect(() => {
    const saved = Cookies.get("user-theme") || "dark";
    setTheme(saved);
    const el = document.getElementById("user-theme");
    if (el) el.classList.toggle("light", saved === "light");
  }, []);

  // ✅ THEME TOGGLE - Cookies mein save karein
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    Cookies.set("user-theme", next, { 
      expires: 365, // 1 saal tak valid
      path: "/",    // Pure site par accessible
      secure: process.env.NODE_ENV === "production", // Production mein HTTPS
      sameSite: "lax"
    });
    const el = document.getElementById("user-theme");
    if (el) el.classList.toggle("light", next === "light");
  };

  // ✅ Current user
  const { data: user = null } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Store info (public endpoint)
  const { data: store = null } = useQuery({
    queryKey: ["storeInfo"],
    queryFn: storeApi.getPublic,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Categories
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Brands
  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: brandApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Products (count ke liye)
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ TOP 5 CATEGORIES
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

  // ✅ TOP 5 BRANDS
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

  return (
    <>
      {/* OVERLAY */}
      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" />
      )}

      {/* ==========================================
          ✅ HEADER — Monochrome + Dark/Light Toggle
      ========================================== */}
      <header
        className={`sticky top-0 z-50 bg-[var(--user-bg-elevated)]/95 backdrop-blur-md border-b border-[var(--user-border)] transition-shadow duration-300 ${
          scrolled ? "shadow-[var(--user-shadow-md)]" : ""
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6">
          <div className="h-14 lg:h-16 flex items-center gap-2 lg:gap-5">
            {/* LEFT — Menu + Logo */}
            <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
              <button
                onClick={() => setOpen(true)}
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-[var(--user-bg-hover)] active:scale-95 transition"
              >
                <Menu size={20} className="text-[var(--user-text)]" />
              </button>

              <Link href="/" className="flex items-center gap-2">
                <StoreLogo store={store} />
                <span className="font-black text-sm lg:text-lg tracking-wide text-[var(--user-text)] hidden sm:block">
                  {storeName}
                </span>
              </Link>
            </div>

            {/* CENTER — Search (desktop) */}
            <div className="hidden md:block flex-1 max-w-2xl mx-auto">
              <SearchBox
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onSubmit={handleSearch}
              />
            </div>

            {/* RIGHT — Theme | Wishlist | Account/Login | Orders | Cart */}
            <div className="flex items-center gap-1.5 lg:gap-4 ml-auto shrink-0">
              {/* ✅ THEME TOGGLE */}
              <button
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg flex items-center justify-center hover:bg-[var(--user-bg-hover)] active:scale-90 transition"
              >
                {theme === "dark" ? (
                  <Sun size={17} className="text-[var(--user-text)]" />
                ) : (
                  <Moon size={17} className="text-[var(--user-text)]" />
                )}
              </button>

              {/* ✅ WISHLIST — heart icon + count badge */}
                           {/* ✅ WISHLIST — heart icon + count badge */}
              <Link
                href="/wishlist"
                title="My Wishlist"
                className="flex items-center gap-1.5 lg:gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[var(--user-bg-hover)] active:scale-95 transition relative"
              >
                <span className="relative">
                  <Heart size={20} className="text-[var(--user-text)]" />
                  {wishlistCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[var(--user-danger)] text-white text-[9px] lg:text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                      {wishlistCount}
                    </span>
                  )}
                </span>
              </Link>

              {/* ✅ ACCOUNT / LOGIN — Smart conditional */}
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-1.5 lg:gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[var(--user-bg-hover)] transition"
                  >
                    <Avatar user={user} sizeClass="w-8 h-8 lg:w-9 lg:h-9" textClass="text-xs lg:text-sm" />
                    <span className="hidden lg:block text-left leading-tight">
                      <span className="block text-[10px] text-[var(--user-text-muted)]">
                        Hello, {user.name?.split(" ")[0]}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold text-[var(--user-text)]">
                        Account
                        <ChevronDown size={11} className="text-[var(--user-accent)]" />
                      </span>
                    </span>
                  </button>

                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 top-12 w-56 bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-xl shadow-[var(--user-shadow-lg)] z-50 p-2">
                        <div className="px-3 py-2 border-b border-[var(--user-border)] mb-1">
                          <p className="text-[var(--user-text)] text-sm font-semibold truncate">
                            {user.name || user.username}
                          </p>
                          <p className="text-[var(--user-text-muted)] text-xs truncate">{user.email}</p>
                        </div>
                        <Link
                          href="/account"
                          onClick={() => setProfileOpen(false)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)] text-sm transition"
                        >
                          <User size={16} className="text-[var(--user-accent)]" />
                          My Account
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--user-danger)] hover:bg-red-500/10 text-sm transition"
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
                  onClick={() => router.push("/login")}
                  className="flex items-center gap-1.5 h-9 px-3 lg:px-4 rounded-lg bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-bold hover:bg-[var(--user-accent-hover)] active:scale-95 transition"
                >
                  <User size={14} />
                  Login
                </button>
              )}

              {/* ORDERS (desktop only, logged-in only) */}
              {user && (
                <Link
                  href="/orders"
                  className="hidden lg:block px-2 py-1.5 rounded-lg hover:bg-[var(--user-bg-hover)] transition leading-tight"
                >
                  <span className="block text-[10px] text-[var(--user-text-muted)]">My</span>
                  <span className="block text-xs font-bold text-[var(--user-text)]">Orders</span>
                </Link>
              )}

              {/* CART */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="flex items-center gap-1.5 lg:gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[var(--user-bg-hover)] active:scale-95 transition relative"
              >
                <span className="relative">
                  <ShoppingCart size={20} className="text-[var(--user-text)]" />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[9px] lg:text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </span>
                <span className="hidden lg:block text-xs font-bold text-[var(--user-text)]">Cart</span>
              </button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="md:hidden pb-3">
            <SearchBox
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onSubmit={handleSearch}
            />
          </div>
        </div>
      </header>

      {/* ==========================================
          ✅ SIDEBAR — Monochrome
      ========================================== */}
      <div
        className={`fixed top-0 left-0 h-full w-[85%] max-w-[320px] bg-[var(--user-bg-elevated)] z-50 shadow-[var(--user-shadow-lg)] transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* TOP */}
        <div className="p-5 border-b border-[var(--user-border)] shrink-0">
          <div className="flex items-center justify-between mb-6">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2">
              <StoreLogo store={store} sizeClass="w-8 h-8" />
              <span className="font-black text-base tracking-wide text-[var(--user-text)]">
                {storeName}
              </span>
            </Link>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center hover:bg-[var(--user-bg-hover)] hover:rotate-90 transition duration-300"
            >
              <X size={16} className="text-[var(--user-text)]" />
            </button>
          </div>

          {user ? (
            <div>
              {/* USER INFO */}
              <div className="flex items-center gap-3 mb-4">
                <Avatar user={user} sizeClass="w-11 h-11" textClass="text-base" />
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--user-text)] text-sm font-semibold truncate">
                    {user.name || user.username}
                  </p>
                  <p className="text-[var(--user-text-muted)] text-xs truncate">{user.email}</p>
                </div>
              </div>

              {/* MY ACCOUNT + LOGOUT */}
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
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="h-10 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-bold flex items-center justify-center hover:bg-[var(--user-accent-hover)] transition"
                >
                  Login
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* SCROLLABLE */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-8">
          {/* TOP 5 CATEGORIES */}
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

          {/* TOP 5 BRANDS */}
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

        {/* FOOTER */}
        <div className="p-4 border-t border-[var(--user-border)] shrink-0">
          <p className="text-[10px] text-[var(--user-text-subtle)] text-center">© 2026 {storeName}</p>
        </div>
      </div>
    </>
  );
}