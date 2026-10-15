"use client";

// ==========================================
// ADMIN PANEL — SHARED PAGE HEADER
// ==========================================
// Single source of truth for every admin page header.
//
// Behaviour copied 1:1 from Category Management (the reference page):
//   • stacked on mobile, single row from `md` up
//   • title + subtitle on the inline-start edge, actions on the inline-end edge
//   • subtitle keeps the same colour/typography across pages
//
// Why this fixes Arabic alignment: `LanguageProvider` puts `dir="rtl"` on
// the app wrapper, so `justify-between`, flex ordering and text alignment all
// mirror automatically. Arabic headings land on the right and read RTL without
// any per-page `rtl:` variants; English stays exactly as before (LTR).

import React from "react";

/**
 * @param {React.ReactNode} title      Page heading (already translated).
 * @param {React.ReactNode} [subtitle] Optional sub-heading (already translated).
 * @param {React.ReactNode} [actions]  Buttons / filters pushed to the inline-end edge.
 * @param {string} [titleClassName]    Optional extra classes on the <h1>.
 * @param {string} [subtitleClassName] Optional extra classes on the <p>.
 * @param {string} [className]         Optional extra classes on the wrapper.
 */
export default function AdminPageHeader({
  title,
  subtitle,
  actions,
  titleClassName = "",
  subtitleClassName = "",
  className = "",
}) {
  return (
    <div className={`flex flex-col gap-4 md:flex-row md:items-center md:justify-between ${className}`.trim()}>
      <div className="min-w-0">
        <h1
          className={`text-[24px] font-bold leading-7 tracking-tight ${titleClassName}`.trim()}
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className={`mt-1 text-[13px] ${subtitleClassName}`.trim()} style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 sm:w-auto">{actions}</div>
      ) : null}
    </div>
  );
}