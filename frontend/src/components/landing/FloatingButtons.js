"use client";

import { useEffect, useState } from "react";
import { ChevronUp, MessageCircle } from "lucide-react";
import { WHATSAPP_NUMBER } from "./content";

export default function FloatingButtons() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed bottom-5 right-4 z-[65] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {/* Back to top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        aria-hidden={!showTop}
        tabIndex={showTop ? 0 : -1}
        className={`flex h-12 w-12 items-center justify-center rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)] text-[var(--user-text)] shadow-lg transition-all duration-300 hover:border-[var(--user-accent)] hover:text-[var(--user-accent)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)] ${
          showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <ChevronUp size={22} aria-hidden="true" />
      </button>

      {/* WhatsApp FAB */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Click Master Store! I need help.")}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Click Master Store on WhatsApp"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_10px_28px_rgba(16,185,129,0.45)] transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
      >
        <span aria-hidden="true" className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30 group-hover:opacity-0" />
        <MessageCircle size={26} aria-hidden="true" className="relative" />
      </a>
    </div>
  );
}
