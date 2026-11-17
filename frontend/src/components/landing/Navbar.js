"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShoppingCart,
  Search,
  Menu,
  X,
  Moon,
  Sun,
  MousePointerClick,
} from "lucide-react";
import { useLanding } from "./LandingContext";

const LINKS = [
  { label: "Home", href: "#home" },
  { label: "Categories", href: "#categories" },
  { label: "Deals", href: "#deals" },
  { label: "About", href: "#why-us" },
  { label: "Contact", href: "#footer-contact" },
];

function getStoredTheme() {
  if (typeof window === "undefined") return "light";
  return window.document.documentElement.classList.contains("user-dark") ? "dark" : "light";
}

export default function Navbar() {
  const { cartCount } = useLanding();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("light");
  const [cartBump, setCartBump] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setTheme(getStoredTheme()));
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Cart badge bump — derived-state-during-render pattern (no setState-in-effect)
  const [prevCartCount, setPrevCartCount] = useState(cartCount);
  if (prevCartCount !== cartCount) {
    setPrevCartCount(cartCount);
    if (cartCount > 0) setCartBump(true);
  }

  useEffect(() => {
    if (!cartBump) return;
    const t = window.setTimeout(() => setCartBump(false), 450);
    return () => window.clearTimeout(t);
  }, [cartBump]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("user-dark", next === "dark");
    try {
      window.document.cookie = `user-theme=${next}; path=/; max-age=31536000; samesite=lax`;
      window.localStorage.setItem("user-theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  };

  return (
    <header
      className={`landing-nav sticky top-0 z-[60] transition-shadow duration-300 ${
        scrolled ? "shadow-[0_8px_30px_rgba(10,10,10,0.12)]" : ""
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-3 sm:gap-6 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/landing" className="flex min-h-[44px] shrink-0 items-center gap-2" aria-label="Click Master Store — Home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)]">
            <MousePointerClick size={20} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="font-heading leading-none">
            <span className="block text-[15px] font-extrabold tracking-tight text-[var(--user-text)] sm:text-lg">
              Click Master
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--user-accent)]">
              Store
            </span>
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="ml-2 hidden items-center gap-6 lg:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} className="landing-nav-link">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* Search toggle */}
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--user-text-secondary)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-accent)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]"
          >
            {searchOpen ? <X size={20} aria-hidden="true" /> : <Search size={20} aria-hidden="true" />}
          </button>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--user-text-secondary)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-accent)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]"
          >
            {theme === "dark" ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>

          {/* Cart */}
          <a
            href="/cart"
            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl text-[var(--user-text-secondary)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-accent)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]"
          >
            <ShoppingCart size={20} aria-hidden="true" />
            {cartCount > 0 && (
              <span
                className={`absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--user-accent)] px-1 text-[10px] font-extrabold text-[var(--user-accent-text)] ${cartBump ? "cart-pop" : ""}`}
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </a>

          {/* CTA */}
          <a href="#deals" className="landing-btn landing-btn-primary hidden min-h-[44px] !px-5 text-sm md:inline-flex">
            Shop Now
          </a>

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--user-text)] transition-colors hover:bg-[var(--user-bg-hover)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)] lg:hidden"
          >
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Expanding search bar */}
      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden border-t border-[var(--user-border)]"
          >
            <form
              className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 sm:px-6 lg:px-8"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
              }}
            >
              <Search size={18} className="shrink-0 text-[var(--user-text-muted)]" aria-hidden="true" />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, brands and categories…"
                aria-label="Search products"
                className="h-11 w-full bg-transparent text-[var(--user-text)] outline-none placeholder:text-[var(--user-text-muted)]"
              />
              <button type="submit" className="landing-btn landing-btn-primary min-h-[44px] text-sm">
                Search
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence initial={false}>
        {open && (
          <>
            <motion.button
              key="backdrop"
              aria-label="Close menu"
              className="fixed inset-0 z-[58] bg-black/45 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.nav
              key="drawer"
              aria-label="Mobile menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-[59] flex h-full w-[82vw] max-w-xs flex-col gap-1 overflow-y-auto bg-[var(--user-bg-card)] p-5 pt-20 lg:hidden"
            >
              {LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[48px] items-center rounded-xl px-4 text-base font-semibold text-[var(--user-text)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-accent)]"
                >
                  {l.label}
                </a>
              ))}
              <a
                href="#deals"
                onClick={() => setOpen(false)}
                className="landing-btn landing-btn-primary mt-3 justify-center"
              >
                Shop Now
              </a>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
