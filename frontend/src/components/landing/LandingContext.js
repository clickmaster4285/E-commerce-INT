"use client";

/* Lightweight client-side cart/wishlist state for the landing demo.
   NOTE: demo only — not wired to the real cart API yet. */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const Ctx = createContext(null);

export function useLanding() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLanding must be used inside <LandingProvider>");
  return ctx;
}

export default function LandingProvider({ children }) {
  const [cartCount, setCartCount] = useState(0);
  const [wishlist, setWishlist] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // rAF se hydrate ho — mount ke baad ek frame mein, cascading render se bachne ke liye
    const id = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem("cms-landing-cart");
        if (saved) setCartCount(Number(saved) || 0);
        const savedWish = window.localStorage.getItem("cms-landing-wishlist");
        if (savedWish) setWishlist(JSON.parse(savedWish));
      } catch {
        /* ignore */
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  const addToCart = useCallback((productName) => {
    setCartCount((n) => {
      const next = n + 1;
      try {
        window.localStorage.setItem("cms-landing-cart", String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setToast({ id: Date.now(), message: `${productName} cart mein add ho gaya ✓` });
  }, []);

  const toggleWishlist = useCallback((id) => {
    setWishlist((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        window.localStorage.setItem("cms-landing-wishlist", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <Ctx.Provider value={{ cartCount, wishlist, toast, addToCart, toggleWishlist }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="landing-toast fixed bottom-24 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-3 text-sm font-semibold text-[var(--user-text)] shadow-lg"
        >
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          {toast.message}
        </div>
      )}
    </Ctx.Provider>
  );
}
