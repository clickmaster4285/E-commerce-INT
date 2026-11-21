"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Moon, Sun, ArrowRight } from "lucide-react";
import { NAV_LINKS } from "./content";

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
        scrolled ? "shadow-[0_1px_0_0_var(--user-border),0_8px_30px_rgba(10,10,10,0.08)]" : ""
      }`}
    >
      <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-[44px] shrink-0 items-center" aria-label="Click Master Store — home">
          <span className="flex h-11 items-center rounded-xl bg-white px-3 ring-1 ring-black/5">
            <Image
              src="/landing/logo.webp"
              alt="Click Master"
              width={480}
              height={330}
              priority
              className="h-8 w-auto"
            />
          </span>
        </Link>

        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex"
          aria-label="Primary"
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="landing-nav-link whitespace-nowrap text-sm font-semibold text-[var(--user-text-secondary)] transition-colors hover:text-[var(--user-accent)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--user-text-secondary)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-accent)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]"
          >
            {theme === "dark" ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>

          <Link
            href="/landing/signup"
            className="hidden min-h-[44px] items-center gap-2 rounded-full bg-[var(--user-accent)] px-6 text-sm font-bold text-[var(--user-accent-text)] transition-colors hover:bg-[var(--user-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)] md:inline-flex"
          >
            Sign Up
            <ArrowRight size={16} aria-hidden="true" />
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--user-text)] transition-colors hover:bg-[var(--user-bg-hover)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)] lg:hidden"
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
              <Link
                href="/landing/signup"
                onClick={() => setOpen(false)}
                className="mt-3 flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--user-accent)] px-6 font-bold text-[var(--user-accent-text)] transition-colors hover:bg-[var(--user-accent-hover)]"
              >
                Sign Up
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
