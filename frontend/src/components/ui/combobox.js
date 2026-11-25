"use client";

/* ==========================================================
   COMBOBOX — reusable select (shadcn Popover pattern)
   • options: [{ value, label, hint? }] (value null bhi chalega → "Default")
   • 10+ options (searchThreshold) → upar search box, warna simple list
   • Remote search (products / deals): onSearchChange do → local filter band,
     parent query chalata hai (debounced yahan), `searchable` parent decide kare
   • Keyboard: ↑ ↓ Enter, Esc band; selected par ✓
   ========================================================== */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const keyOf = (v) => (v === null || v === undefined ? "__null__" : String(v));

export function Combobox({
  options = [],
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results",
  searchThreshold = 10,
  searchable, // undefined → options.length > searchThreshold
  onSearchChange, // remote search
  loading = false,
  selectedLabel, // value options me na ho (remote list) to trigger par ye dikhe
  footer, // list ke neeche chhota note (e.g. "Showing 20 of 120")
  disabled = false,
  invalid = false,
  className,
  contentClassName,
  id,
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const listId = useId();
  const remote = typeof onSearchChange === "function";
  const showSearch = searchable ?? options.length > searchThreshold;

  // Remote search debounce (har keystroke par request nahi)
  const onSearchRef = useRef(onSearchChange);
  useEffect(() => {
    onSearchRef.current = onSearchChange;
  });
  useEffect(() => {
    if (!remote) return undefined;
    const t = setTimeout(() => onSearchRef.current?.(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query, remote]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (remote || !q) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(q) || String(o.hint || "").toLowerCase().includes(q));
  }, [options, query, remote]);

  const selected = options.find((o) => keyOf(o.value) === keyOf(value));
  const triggerLabel = selected?.label ?? (value !== null && value !== undefined && value !== "" ? selectedLabel : null);

  const changeOpen = (next) => {
    setOpen(next);
    if (next) {
      const i = filtered.findIndex((o) => keyOf(o.value) === keyOf(value));
      setActive(i < 0 ? 0 : i);
    } else if (!remote) {
      setQuery("");
    }
  };

  const pick = (option) => {
    onChange?.(option.value);
    setOpen(false);
    if (!remote) setQuery("");
  };

  // Active option nazar me rahe
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (event.key === "Home") {
      setActive(0);
    } else if (event.key === "End") {
      setActive(Math.max(filtered.length - 1, 0));
    }
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-input px-3 text-start text-sm text-fg outline-none transition",
            "hover:border-line-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50",
            open && "border-accent ring-2 ring-accent/20",
            invalid && "border-warning",
            className,
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !triggerLabel && "text-fg-muted")}>{triggerLabel || placeholder}</span>
          <ChevronsUpDown size={14} className="shrink-0 text-fg-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-(--radix-popover-trigger-width) min-w-52 overflow-hidden p-0", contentClassName)}
        onKeyDown={onKeyDown}
        onOpenAutoFocus={(event) => {
          // Search na ho to list (content) par focus → keyboard tab bhi chale
          if (!showSearch) {
            event.preventDefault();
            listRef.current?.focus();
          }
        }}
      >
        {showSearch ? (
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search size={14} className="shrink-0 text-fg-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder={searchPlaceholder}
              aria-controls={listId}
              aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
              className="h-10 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
            />
            {loading ? <Loader2 size={14} className="shrink-0 animate-spin text-fg-muted" /> : null}
          </div>
        ) : null}

        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={!showSearch && filtered[active] ? `${listId}-${active}` : undefined}
          className="max-h-64 overflow-y-auto p-1 outline-none"
        >
          {filtered.length ? (
            filtered.map((option, i) => {
              const isSelected = keyOf(option.value) === keyOf(value);
              return (
                <div
                  key={keyOf(option.value)}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseMove={() => active !== i && setActive(i)}
                  onClick={() => pick(option)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg",
                    i === active && "bg-subtle",
                    isSelected && "font-semibold",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint ? <span className="block truncate text-[11px] font-normal text-fg-muted">{option.hint}</span> : null}
                  </span>
                  {isSelected ? <Check size={14} className="shrink-0 text-accent" /> : null}
                </div>
              );
            })
          ) : (
            <p className="px-2 py-6 text-center text-xs text-fg-muted">{loading ? "Loading…" : emptyText}</p>
          )}
        </div>

        {footer ? <p className="border-t border-line px-3 py-1.5 text-[11px] text-fg-muted">{footer}</p> : null}
      </PopoverContent>
    </Popover>
  );
}
