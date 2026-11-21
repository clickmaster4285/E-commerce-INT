import { cx } from "./cx";

/** Base surface — har section isi se banta hai. */
export function Card({ as: Tag = "section", className, children, ...rest }) {
  return (
    <Tag className={cx("sa-card", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Title + optional description, leading icon aur right-side action. */
export function CardHeader({ title, description, icon: Icon, action, divider = true, className }) {
  return (
    <div className={cx("flex items-start justify-between gap-3 px-5 py-4", divider && "border-b border-[var(--border-color)]", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
            <Icon size={16} aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold leading-6 text-[var(--text-primary)]">{title}</h2>
          {description ? <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--text-muted)]">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cx("p-5", className)}>{children}</div>;
}

export function CardFooter({ className, children }) {
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)] px-5 py-3", className)}>
      {children}
    </div>
  );
}

/** Filters/search row — card ke andar table ke upar. */
export function CardToolbar({ className, children }) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] px-4 py-3", className)}>
      {children}
    </div>
  );
}
