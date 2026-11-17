"use client";

export default function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "",
}) {
  return (
    <section className={`card overflow-hidden ${className}`.trim()}>
      <div className="border-b border-[var(--border-color)] px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-[15px] font-semibold text-[var(--text-primary)]">{title}</h2>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
        {description ? (
          <p className="mt-0.5 text-[12px] leading-4 text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
