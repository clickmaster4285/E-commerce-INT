"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
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

/**
 * Searchable select — lambi lists (currency wagaira) ke liye native <select> ki jagah.
 * options: [{ value, label, hint? }]. onChange(value) deta hai.
 */
export function SearchSelect({ label, hint, error, required, className, id, value, onChange, options, placeholder = "Select…", searchPlaceholder = "Search…", emptyText = "No matches" }) {
  const auto = useId();
  const inputId = id || auto;
  const listId = `${inputId}-list`;
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [dropUp, setDropUp] = useState(false);

  const selected = options.find((o) => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.value} ${o.label} ${o.hint || ""}`.toLowerCase().includes(q));
  }, [options, query]);

  const openMenu = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    // neeche jagah kam ho to upar khulta hai
    setDropUp(rect ? window.innerHeight - rect.bottom < 320 && rect.top > 320 : false);
    setQuery("");
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx < 0 ? 0 : idx);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const choose = (opt) => {
    if (!opt) return;
    onChange?.(opt.value);
    close();
  };

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) close(); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // active row hamesha nazar me rahe
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(filtered[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); rootRef.current?.querySelector("button")?.focus(); }
    else if (e.key === "Tab") close();
  };

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={className}>
      <div ref={rootRef} className="relative">
        <button
          id={inputId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? close() : openMenu())}
          onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); openMenu(); } }}
          className={cx("sa-input flex items-center justify-between gap-2 text-start", error && "!border-danger-solid")}
        >
          <span className={cx("truncate", !selected && "text-fg-muted")}>{selected ? selected.label : placeholder}</span>
          <ChevronDown size={16} aria-hidden="true" className={cx("shrink-0 text-fg-muted transition-transform", open && "rotate-180")} />
        </button>

        {open ? (
          <div
            className={cx(
              "absolute inset-x-0 z-50 overflow-hidden rounded-lg border border-line bg-card shadow-lg",
              dropUp ? "bottom-full mb-1" : "top-full mt-1",
            )}
          >
            <div className="relative border-b border-line">
              <Search size={15} aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-muted" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                role="combobox"
                aria-controls={listId}
                aria-expanded="true"
                aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                className="h-10 w-full bg-transparent ps-9 pe-3 text-[13px] text-fg outline-none placeholder:text-fg-muted"
              />
            </div>
            <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto overscroll-contain py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-[12.5px] text-fg-muted">{emptyText}</li>
              ) : (
                filtered.map((o, i) => {
                  const isSel = o.value === value;
                  return (
                    <li
                      key={o.value}
                      id={`${listId}-${i}`}
                      data-idx={i}
                      role="option"
                      aria-selected={isSel}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => { e.preventDefault(); choose(o); }}
                      className={cx(
                        "mx-1 flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]",
                        i === active ? "bg-subtle" : "",
                        isSel ? "font-semibold text-accent" : "text-fg",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {isSel ? <Check size={14} aria-hidden="true" className="shrink-0" /> : null}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </Field>
  );
}
