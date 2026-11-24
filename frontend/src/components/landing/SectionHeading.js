export default function SectionHeading({ eyebrow, title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-user-accent">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-extrabold leading-tight text-user-fg sm:text-3xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1.5 max-w-xl text-sm text-user-fg-muted">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
