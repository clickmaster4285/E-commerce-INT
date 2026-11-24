"use client";

import { useId } from "react";
import { Search, X } from "lucide-react";
import { cx } from "./cx";

/** Underline tabs — status filters wagaira. items: [{ value, label, count? }] */
export function Tabs({ items, value, onChange, label = "Filter", className }) {
  return (
    <div role="tablist" aria-label={label} className={cx("flex gap-6 overflow-x-auto overflow-y-hidden border-b border-line px-5 [scrollbar-width:none]", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button key={item.value || "all"} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1} onClick={() => onChange(item.value)} className="sa-tab">
            {item.label}
            {item.count !== undefined && item.count !== null ? <span className="sa-tab__count">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Search box with clear button. onChange string value deta hai. */
export function SearchInput({ value, onChange, placeholder = "Search…", label = "Search", className }) {
  return (
    <div className={cx("relative min-w-[200px] flex-1", className)}>
      <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className="sa-input ps-9 pe-9 [&::-webkit-search-cancel-button]:hidden" />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute end-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:bg-subtle hover:text-fg">
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/** Label + control + hint/error. children ko id milta hai via render prop ya htmlFor. */
export function Field({ label, hint, error, required, htmlFor, className, children }) {
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-semibold text-fg-secondary">
          {label}
          {required ? <span className="ms-0.5 text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ label, hint, error, required, className, id, ...props }) {
  const auto = useId();
  const inputId = id || auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={className}>
      <input id={inputId} required={required} aria-invalid={error ? "true" : undefined} className="sa-input" {...props} />
    </Field>
  );
}

export function TextArea({ label, hint, error, required, className, id, rows = 3, ...props }) {
  const auto = useId();
  const inputId = id || auto;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={className}>
      <textarea id={inputId} rows={rows} required={required} aria-invalid={error ? "true" : undefined} className="sa-input" {...props} />
    </Field>
  );
}

export function SelectInput({ label, hint, error, className, id, children, ...props }) {
  const auto = useId();
  const inputId = id || auto;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <select id={inputId} aria-invalid={error ? "true" : undefined} className="sa-input" {...props}>
        {children}
      </select>
    </Field>
  );
}

/** Form ke andar group heading (Seller / Store / Location). */
export function FormSection({ title, children }) {
  return (
    <fieldset className="space-y-3.5">
      <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{title}</legend>
      {children}
    </fieldset>
  );
}
