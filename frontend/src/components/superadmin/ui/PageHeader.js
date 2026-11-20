import { ArrowLeft } from "lucide-react";
import { IconButton } from "./Button";

/**
 * Page title row. Breadcrumbs Topbar me hain; detail pages `backHref` dete hain.
 */
export default function PageHeader({ title, description, badge, actions, backHref, backLabel = "Back", className = "" }) {
  return (
    <header className={`super-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}>
      <div className="flex min-w-0 items-start gap-3">
        {backHref ? <IconButton icon={ArrowLeft} label={backLabel} href={backHref} variant="outline" className="mt-0.5 rtl:[&>svg]:rotate-180" /> : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="min-w-0 truncate text-[22px] font-semibold leading-8 tracking-[-0.01em] text-[var(--text-primary)] sm:text-[24px]">{title}</h1>
            {badge ? <span className="shrink-0">{badge}</span> : null}
          </div>
          {description ? <p className="mt-0.5 text-[13.5px] leading-5 text-[var(--text-muted)]">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
