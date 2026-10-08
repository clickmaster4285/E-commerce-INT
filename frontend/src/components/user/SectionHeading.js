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
  href,
  linkLabel = "View All",
  children,
  className = "",
  titleClassName = "",
  subtitleClassName = "",
  titleId,
}) {
  return (
    <div className={`mb-5 flex min-w-0 flex-row items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2
          id={titleId}
          className={`truncate text-xl font-medium leading-tight tracking-[-0.01em] text-[var(--user-text)] sm:text-[22px] ${titleClassName}`}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className={`mt-1 truncate text-sm font-normal text-[var(--user-text-muted)] ${subtitleClassName}`}>{subtitle}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-end gap-2">
        {children}
        {href ? (
          <Link
            href={href}
            className="group inline-flex items-center gap-1 text-[13px] font-medium text-[var(--user-text-muted)] transition-colors duration-150 hover:text-[var(--user-accent)] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
          >
            {linkLabel}
            <ArrowRight size={16} className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
