"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { MousePointerClick, Menu, X, Moon, Sun, ArrowRight } from "lucide-react";
import { NAV_LINKS, HERO } from "./content";

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  return window.document.documentElement.classList.contains("user-dark") ? "dark" : "light";
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setTheme(getInitialTheme()));
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

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
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/landing" className="flex min-h-[44px] shrink-0 items-center gap-2" aria-label="Click Master Store — home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)]">
            <MousePointerClick size={20} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="font-heading leading-none">
            <span className="block text-[15px] font-extrabold tracking-tight text-[var(--user-text)] sm:text-lg">Click Master</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--user-accent)]">Store</span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-6 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="landing-nav-link">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--user-text-secondary)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-accent)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]"
          >
            {theme === "dark" ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>

          <a href={HERO.secondaryCta.href} target="_blank" rel="noopener noreferrer" className="landing-btn landing-btn-primary hidden md:inline-flex">
            Talk to Us
            <ArrowRight size={17} aria-hidden="true" />
          </a>

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
              {NAV_LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[48px] items-center rounded-xl px-4 text-base font-semibold text-[var(--user-text)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-accent)]"
                >
                  {l.label}
                </a>
              ))}
              <a href={HERO.secondaryCta.href} target="_blank" rel="noopener noreferrer" className="landing-btn landing-btn-primary mt-3 justify-center">
                Talk to Us
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
