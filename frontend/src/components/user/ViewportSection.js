"use client";

import { useEffect, useRef, useState } from "react";

/* Below-fold sections viewport ke paas aane par mount (queries tab chalti
   hain). rootMargin 600px → user ko loading kabhi nahi dikhti. Placeholder
   off-screen hota hai is liye layout shift visible nahi. Markup/look same. */
export default function ViewportSection({
  children,
  rootMargin = "600px",
  minHeight = 300,
  className = "",
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  if (!visible) {
    return (
      <div
        ref={ref}
        className={className}
        style={{
          minHeight,
          contentVisibility: "auto",
          containIntrinsicSize: `auto ${minHeight}px`,
        }}
      />
    );
  }
  return (
    <div ref={ref} className={className} style={{ contentVisibility: "auto" }}>
      {children}
    </div>
  );
}
