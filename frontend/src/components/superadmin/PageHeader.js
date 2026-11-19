"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  badge,
  className = "",
}) {
  return (
    <header className={`super-page-header mb-6 ${className}`.trim()}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-2 flex min-w-0 items-center gap-1 text-[12px] text-[var(--text-muted)]">
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
                {i > 0 && <ChevronRight size={12} aria-hidden="true" className="shrink-0 rtl:rotate-180" />}
                {crumb.href && !isLast ? (
                  <Link href={crumb.href} className="truncate transition-colors hover:text-[var(--text-primary)]">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? "truncate font-medium text-[var(--text-secondary)]" : "truncate"} aria-current={isLast ? "page" : undefined}>
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-semibold leading-8 tracking-tight text-[var(--text-primary)]">
              {title}
            </h1>
            {badge ? <span className="shrink-0">{badge}</span> : null}
          </div>
          {description ? (
            <p className="mt-1 text-[15px] leading-5 text-[var(--text-muted)]">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
