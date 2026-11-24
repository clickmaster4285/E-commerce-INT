"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

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
        className={`flex h-12 w-12 items-center justify-center rounded-full border border-user-line bg-user-card text-user-fg shadow-lg transition-all duration-300 hover:border-user-accent hover:text-user-accent focus-visible:outline-2 focus-visible:outline-user-accent ${
          showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <ChevronUp size={22} aria-hidden="true" />
      </button>

    </div>
  );
}
