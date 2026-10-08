"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { smartImageLoader } from "@/utils/smartImageLoader";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCart } from "./CartContext";
import { useWishlist } from "./WishlistContext";
import { userHttp } from "@/apis/axiosInstance";
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

const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
};

const getIcon = (name) => {
  if (!name) return <FolderOpen size={17} />;
  const n = name.toLowerCase();
  if (n.includes("mobile") || n.includes("phone"))
    return <Smartphone size={17} />;
  if (n.includes("laptop") || n.includes("computer"))
    return <Laptop size={17} />;
  if (n.includes("watch")) return <Watch size={17} />;
  if (n.includes("headphone") || n.includes("earbud") || n.includes("audio"))
    return <Headphones size={17} />;
  if (n.includes("camera") || n.includes("photo")) return <Camera size={17} />;
  if (n.includes("deal") || n.includes("discount") || n.includes("offer"))
    return <Percent size={17} />;
  if (n.includes("tv") || n.includes("monitor")) return <Tv size={17} />;
  if (n.includes("game")) return <Gamepad2 size={17} />;
  if (n.includes("cloth") || n.includes("fashion")) return <Shirt size={17} />;
  if (n.includes("accessor")) return <ShoppingBag size={17} />;
  return <FolderOpen size={17} />;
};

function SearchBox({ value, onChange, onSubmit, results = [], onPick }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const show = open && value.trim().length > 0 && results.length > 0;

  const submit = () => {
    setOpen(false);
    onSubmit();
  };

  const pick = (p) => {
    setOpen(false);
    onPick(p);
  };

  return (
    <div ref={ref} className="relative flex w-full items-center">
      <input
        value={value}
        aria-label="Search products"
        onChange={(e) => {
          onChange(e);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Search products..."
        className="h-10 w-full rounded-md border border-[var(--user-border)] bg-[var(--user-bg-input)] pl-4 pr-14 text-[0.8125rem] font-normal text-[var(--user-text)] outline-none transition-colors placeholder:text-[var(--user-text-subtle)] focus:border-[var(--user-accent)] focus:ring-0"
      />
      <button
        onClick={submit}
        aria-label="Search"
        className="absolute right-0 flex h-10 w-11 items-center justify-center rounded-r-md border-l border-[var(--user-border)] bg-[var(--user-accent)]/10 text-[var(--user-accent)] transition-colors hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)]"
      >
        <Search size={14} strokeWidth={1.7} />
      </button>

      {show && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-2xl overflow-hidden">
          <div className="max-h-80 overflow-y-auto">
            {results.map((p) => {
              const img =
                p.variants?.[0]?.images?.[0]?.img_url ||
                p.image ||
                p.images?.[0]?.img_url ||
                "";
              const price = Number(
                p.variants?.[0]?.selling_price ||
                  p.price ||
                  p.selling_price ||
                  0,
              );
              return (
                <button
                  key={p._id || p.id}
                  onClick={() => pick(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--user-bg-hover)] transition text-left"
                >
                  {img ? (
                    <Image
                      src={getImageUrl(img)}
                      alt={p.name}
                      width={40}
                      height={40}
                      loader={smartImageLoader}
                      className="rounded-lg object-cover border border-[var(--user-border)] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[var(--user-bg-hover)] border border-[var(--user-border)] flex items-center justify-center shrink-0">
                      <Package
                        size={16}
                        className="text-[var(--user-text-subtle)]"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--user-text)]">
                      {p.name}
                    </p>
                    <p className="text-[0.6875rem] text-[var(--user-text-muted)] capitalize truncate">
                      {p.brand_id?.name || p.brand || ""}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-medium text-[var(--user-accent)]">
                    Rs. {price.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ user, sizeClass = "w-9 h-9", textClass = "text-sm" }) {
  const [failed, setFailed] = useState(false);
  const url = user?.avatar || user?.picture || null;
  const letter = (user?.name || user?.email || "U").charAt(0).toUpperCase();

  if (!url || failed) {
    return (
      <div
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border border-[var(--user-border)] bg-[var(--user-bg-hover)] font-medium text-[var(--user-text)] ${textClass}`}
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
      className={`${sizeClass} shrink-0 rounded-full border border-[var(--user-border)] object-cover`}
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
      <span
        className={`${sizeClass} flex items-center justify-center rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-hover)] text-sm font-medium text-[var(--user-text)]`}
      >
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
      const res = await userHttp.get("/users/profile");
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

  // ✅ Counts server facets se (direct counts) — full catalog nahi.
  // Key ["shopFacets","global"] home page ke saath shared (ek hi request).
  const { data: countFacets = null } = useQuery({
    queryKey: ["shopFacets", "global"],
    queryFn: () => productApi.getFacets({}),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const topCategories = useMemo(() => {
    const counts = {};
    (countFacets?.categoryDirect || []).forEach((c) => {
      counts[String(c._id)] = c.count || 0;
    });
    return categories
      .map((c) => ({ ...c, count: counts[c._id] || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [categories, countFacets]);

  const brandCounts = useMemo(() => {
    const counts = {};
    (countFacets?.brands || []).forEach((b) => {
      counts[String(b._id)] = b.count || 0;
    });
    return counts;
  }, [countFacets]);

  const topBrands = useMemo(() => {
    return [...brands]
      .sort((a, b) => (brandCounts[b._id] || 0) - (brandCounts[a._id] || 0))
      .slice(0, 5);
  }, [brands, brandCounts]);

  // ✅ Search suggestions — server (?search=, 8 tak, 400ms debounce)
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data: searchData } = useQuery({
    queryKey: ["headerSearch", debouncedSearch],
    queryFn: () =>
      productApi.getAllPaginated({ page: 1, limit: 8, search: debouncedSearch }),
    enabled: debouncedSearch.length >= 1,
    staleTime: 60 * 1000,
    retry: 1,
    placeholderData: (previousData) => previousData,
  });
  const searchResults = useMemo(
    () => (debouncedSearch.length >= 1 ? searchData?.products || [] : []),
    [debouncedSearch, searchData],
  );

  const handlePick = (p) => {
    setSearchTerm("");
    setMobileSearchOpen(false);
    router.push(`/product/${p._id || p.id}`);
  };

  const handleLogout = async () => {
    try {
      await userHttp.post("/users/logout");
    } catch {}
    queryClient.removeQueries({ queryKey: ["userProfile"] });
    setProfileOpen(false);
    setOpen(false);
    window.location.href = "/";
  };

  // ✅ Enter/Search button → search results page
  const handleSearch = () => {
    const q = searchTerm.trim();
    if (!q) return;
    setSearchTerm("");
    setMobileSearchOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const getLogoUrl = (logo) => {
    const raw = typeof logo === "string" ? logo : logo?.img_url;
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${API_ORIGIN}${path}`;
  };

  const storeName = store?.store_name || "";

  const iconBtn =
    "relative flex h-9 w-9 items-center justify-center rounded-xl text-[var(--user-text-secondary)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] active:scale-[0.96] lg:h-10 lg:w-10";

  return (
    <>
      <style>{`@keyframes badgePop { 0% { transform: scale(0.4); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }`}</style>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
        />
      )}

      <header
        className={`sticky top-0 z-50 border-b border-[var(--user-border)] transition-shadow duration-300 ${
          scrolled ? "shadow-[var(--user-shadow-md)]" : ""
        }`}
      >
        <div         className="pointer-events-none absolute inset-0 bg-[var(--user-bg-elevated)]/95 backdrop-blur-md" />

        <div className="relative w-full max-w-none px-3.5 sm:px-5 lg:px-7 xl:px-9 2xl:px-12">
          <div className="flex h-14 items-center gap-2 sm:gap-3 lg:h-16 lg:gap-4">
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <button
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--user-text-secondary)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] active:scale-[0.96] lg:h-10 lg:w-10"
              >
                <Menu size={19} strokeWidth={1.7} />
              </button>

              <Link href="/" className="flex min-w-0 items-center gap-2">
                <StoreLogo store={store} />
                <span className="hidden max-w-[10rem] truncate text-base font-semibold tracking-tight text-[var(--user-text)] sm:block lg:max-w-[14rem] lg:text-lg">
                  {storeName}
                </span>
              </Link>
            </div>

            <div className="mx-auto hidden max-w-2xl flex-1 md:block">
              <SearchBox
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onSubmit={handleSearch}
                results={searchResults}
                onPick={handlePick}
              />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 lg:gap-1.5">
              <button
                onClick={() => setMobileSearchOpen((v) => !v)}
                aria-label={mobileSearchOpen ? "Close search" : "Open search"}
                className={`${iconBtn} md:hidden`}
              >
                {mobileSearchOpen ? <X size={18} strokeWidth={1.7} /> : <Search size={18} strokeWidth={1.7} />}
              </button>

              <button
                onClick={toggleTheme}
                title={
                  theme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
                aria-label="Toggle theme"
                className={iconBtn}
              >
                {theme === "dark" ? <Sun size={17} strokeWidth={1.7} /> : <Moon size={17} strokeWidth={1.7} />}
              </button>

              <Link
                href="/wishlist"
                title="My Wishlist"
                aria-label="My Wishlist"
                className={iconBtn}
              >
                <Heart size={18} strokeWidth={1.7} />
                {wishlistCount > 0 && (
                  <span
                    key={wishlistCount}
                    className="absolute right-0.5 top-0.5 flex h-[0.9375rem] min-w-[0.9375rem] items-center justify-center rounded-full border-2 border-[var(--user-bg-elevated)] bg-[var(--user-danger)] px-1 text-[0.5625rem] font-medium text-white"
                    style={{ animation: "badgePop .25s ease-out" }}
                  >
                    {wishlistCount}
                  </span>
                )}
              </Link>

              <button
                onClick={() =>
                  isMobile ? router.push("/cart") : setIsCartOpen(true)
                }
                title="Cart"
                aria-label={`Open cart, ${count} items`}
                className={iconBtn}
              >
                <ShoppingCart size={18} strokeWidth={1.7} />
                {count > 0 && (
                  <span
                    key={count}
                    className="absolute right-0.5 top-0.5 flex h-[0.9375rem] min-w-[0.9375rem] items-center justify-center rounded-full border-2 border-[var(--user-bg-elevated)] bg-[var(--user-accent)] px-1 text-[0.5625rem] font-medium text-[var(--user-accent-text)]"
                    style={{ animation: "badgePop .25s ease-out" }}
                  >
                    {count}
                  </span>
                )}
              </button>

              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    aria-label="Account menu"
                    className="flex items-center gap-1 rounded-xl p-1 transition-colors hover:bg-[var(--user-bg-hover)] active:scale-[0.96]"
                  >
                    <Avatar
                      user={user}
                      sizeClass="w-8 h-8 lg:w-9 lg:h-9"
                      textClass="text-xs lg:text-sm"
                    />
                    <ChevronDown
                      size={12}
                      className={`hidden lg:block text-[var(--user-text-muted)] transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {profileOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setProfileOpen(false)}
                      />
                      <div className="absolute right-0 top-11 z-50 w-60 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-2 shadow-[var(--user-shadow-lg)]">
                        <div className="px-3 py-2.5 border-b border-[var(--user-border)] mb-1">
                          <p className="truncate text-sm font-medium text-[var(--user-text)]">
                            {user.name || user.username}
                          </p>
                          <p className="text-[var(--user-text-muted)] text-xs truncate">
                            {user.email}
                          </p>
                        </div>
                        <Link
                          href="/account"
                          onClick={() => setProfileOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] text-sm transition"
                        >
                          <User
                            size={16}
                            className="text-[var(--user-accent)]"
                          />
                          My Account
                        </Link>
                        <Link
                          href="/orders"
                          onClick={() => setProfileOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[var(--user-text-secondary)] hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] text-sm transition"
                        >
                          <Package
                            size={16}
                            className="text-[var(--user-accent)]"
                          />
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
                  className="ml-1 flex h-8 items-center gap-1.5 rounded-xl border border-[var(--user-accent)]/25 bg-[var(--user-accent-soft)] px-2.5 text-xs font-medium text-[var(--user-accent)] transition-colors hover:bg-[var(--user-accent)]/15 active:scale-[0.96] lg:px-3"
                >
                  <User size={13} />
                  Login
                </button>
              )}
            </div>
          </div>

          {mobileSearchOpen && (
            <div className="md:hidden pb-3">
              <SearchBox
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onSubmit={handleSearch}
                results={searchResults}
                onPick={handlePick}
              />
            </div>
          )}
        </div>
      </header>

      <div
        className={`fixed top-0 left-0 h-full w-[85%] max-w-[21.25rem] bg-[var(--user-bg-elevated)] z-50 shadow-2xl transition-transform duration-500 ease-out flex flex-col ${
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

        <div className="px-4 py-2.5 border-b border-[var(--user-border)] shrink-0 bg-gradient-to-br from-[var(--user-bg-card)] to-[var(--user-bg-hover)]">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 group min-w-0"
            >
              <div className="relative shrink-0">
                <StoreLogo store={store} sizeClass="w-8 h-8" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[var(--user-success)] rounded-full border-2 border-[var(--user-bg-elevated)]" />
              </div>
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium leading-tight tracking-tight text-[var(--user-text)]">
                  {storeName}
                </span>
                <span className="text-[0.5625rem] font-medium uppercase tracking-wider text-[var(--user-text-muted)]">
                  Shop Premium
                </span>
              </div>
            </Link>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="w-8 h-8 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center hover:bg-[var(--user-danger)] hover:border-[var(--user-danger)] hover:text-white transition-all duration-300 hover:rotate-90 active:scale-90 shrink-0"
            >
              <X
                size={14}
                className="text-[var(--user-text)] hover:text-white"
              />
            </button>
          </div>

          {!user && (
            <button
              onClick={() => {
                setOpen(false);
                setLoginOpen(true);
              }}
              className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[var(--user-accent)] text-xs font-medium text-[var(--user-accent-text)] transition hover:opacity-90 active:scale-[0.98]"
            >
              <User size={14} />
              Login / Sign Up
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
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
                  <span className="text-xs font-medium text-[var(--user-text)]">
                    Account
                  </span>
                </Link>

                <Link
                  href="/orders"
                  onClick={() => setOpen(false)}
                  className="sidebar-item flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:border-[var(--user-accent)] hover:shadow-lg hover:shadow-[var(--user-accent)]/10 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--user-accent)]/10 flex items-center justify-center">
                    <Package size={18} className="text-[var(--user-accent)]" />
                  </div>
                  <span className="text-xs font-medium text-[var(--user-text)]">
                    Orders
                  </span>
                </Link>

                <Link
                  href="/wishlist"
                  onClick={() => setOpen(false)}
                  className="sidebar-item flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:border-[var(--user-accent)] hover:shadow-lg hover:shadow-[var(--user-accent)]/10 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--user-accent)]/10 flex items-center justify-center relative">
                    <Heart size={18} className="text-[var(--user-accent)]" />
                    {wishlistCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--user-danger)] px-1 text-[0.5625rem] font-medium text-white">
                        {wishlistCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-[var(--user-text)]">
                    Wishlist
                  </span>
                </Link>

                <Link
                  href="/account?tab=settings"
                  onClick={() => {
                    setOpen(false);
                    window.dispatchEvent(
                      new CustomEvent("account:tab", { detail: "settings" }),
                    );
                  }}
                  className="sidebar-item flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] hover:border-[var(--user-accent)] hover:shadow-lg hover:shadow-[var(--user-accent)]/10 transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--user-accent)]/10 flex items-center justify-center">
                    <Settings size={18} className="text-[var(--user-accent)]" />
                  </div>
                  <span className="text-xs font-medium text-[var(--user-text)]">
                    Settings
                  </span>
                </Link>
              </div>
            </div>
          )}

          <div className="p-5 border-b border-[var(--user-border)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-[var(--user-text)]">
                Top Categories
              </h3>
            </div>
            <div className="space-y-1">
              {topCategories.map((category, idx) => (
                <Link
                  key={category._id}
                  href={`/filtering-product?category=${category._id}`}
                  onClick={() => setOpen(false)}
                  className="sidebar-item flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gradient-to-r hover:from-[var(--user-accent)]/10 hover:to-[var(--user-accent)]/5 transition-all duration-300 group active:scale-[0.98]"
                  style={{ animationDelay: `${0.05 * (idx + 1)}s` }}
                >
                  <span className="w-10 h-10 rounded-lg bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-accent)] group-hover:bg-[var(--user-accent)] group-hover:text-[var(--user-accent-text)] group-hover:shadow-md transition-all duration-300 shrink-0">
                    {getIcon(category.name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium capitalize text-[var(--user-text)] transition-colors group-hover:text-[var(--user-accent)]">
                      {category.name}
                    </span>
                    <span className="text-[0.625rem] text-[var(--user-text-muted)]">
                      {category.count} products
                    </span>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-[var(--user-text-subtle)] group-hover:text-[var(--user-accent)] group-hover:translate-x-1 transition-all shrink-0"
                  />
                </Link>
              ))}
            </div>
          </div>

          <div className="p-5 border-b border-[var(--user-border)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-[var(--user-text)]">
                Top Brands
              </h3>
            </div>
            <div className="space-y-1">
              {topBrands.map((brand, idx) => {
                const logoUrl = getLogoUrl(brand.logo);
                const productCount =
                  brandCounts?.[brand._id] || brand.products?.length || 0;
                return (
                  <Link
                    key={brand._id}
                    href={`/filtering-product?brand=${brand._id}`}
                    onClick={() => setOpen(false)}
                    className="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gradient-to-r hover:from-[var(--user-accent)]/10 hover:to-[var(--user-accent)]/5 transition-all duration-300 group active:scale-[0.98]"
                    style={{ animationDelay: `${0.05 * (idx + 1)}s` }}
                  >
                    {logoUrl ? (
                      <span className="relative w-10 h-10 rounded-full bg-white p-2 shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                        <Image
                          src={logoUrl}
                          alt={brand.name}
                          fill
                          loader={smartImageLoader}
                          sizes="40px"
                          className="object-contain"
                        />
                      </span>
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--user-accent)] text-sm font-medium text-[var(--user-accent-text)] transition-shadow group-hover:shadow-md">
                        {brand.name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium capitalize text-[var(--user-text)] transition-colors group-hover:text-[var(--user-accent)]">
                        {brand.name}
                      </span>
                      <span className="text-[0.625rem] text-[var(--user-text-muted)]">
                        {productCount} products
                      </span>
                    </div>
                    <ChevronRight
                      size={14}
                      className="text-[var(--user-text-subtle)] group-hover:text-[var(--user-accent)] group-hover:translate-x-1 transition-all shrink-0"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[var(--user-border)] shrink-0 bg-[var(--user-bg-card)]">
          <p className="text-[0.625rem] text-[var(--user-text-subtle)] text-center">
            © 2026 {storeName}. All rights reserved.
          </p>
        </div>
      </div>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
