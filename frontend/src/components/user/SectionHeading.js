"use client";

/* ==========================================================
   SECTION HEADING — Home page ke har section ka common header
   (title + optional icon + subtitle + right side action/tabs)
   Isse sab sections ki left/right alignment bilkul same rehti hai.
   ========================================================== */

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function SectionHeading({
  title,
  subtitle,
  icon: Icon,
  href,
  linkLabel = "View All",
  children,
  className = "",
}) {
  return (
    <div className={`mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ${className}`}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-black leading-tight text-[var(--user-text)] lg:text-[1.0625rem]">
          {Icon ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--user-accent-soft)] text-[var(--user-accent)]">
              <Icon size={14} />
            </span>
          ) : (
            <span className="h-4 w-[0.1875rem] shrink-0 rounded-full bg-[var(--user-accent)]" />
          )}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle ? (
          <p className="mt-1 truncate text-[0.6875rem] font-medium text-[var(--user-text-subtle)]">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {children}
        {href ? (
          <Link
            href={href}
            className="group inline-flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-accent)] transition-opacity hover:opacity-80"
          >
            {linkLabel}
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
