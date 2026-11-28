"use client";

/** Storefront account tabs ka shared page header — compact aur consistent. */
export default function AccountPageHeader({ title, subtitle, action }) {
  return (
    <header className="flex flex-col gap-1 border-b border-user-line pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-xl font-semibold tracking-tight text-user-fg sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 break-words text-[0.8125rem] text-user-fg-muted">{subtitle}</p>}
      </div>
      {action ? <div className="mt-2 shrink-0 sm:mt-0">{action}</div> : null}
    </header>
  );
}
