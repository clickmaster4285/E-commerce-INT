"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

/* Searchable dropdown (combobox) — country aur city dono ke liye (signup + super admin store form).
   Type karo → filter; ↑ ↓ Enter Esc keyboard; render limit taake 20k cities par bhi smooth rahe.
   allowCustom=true  (city)    → typed naam bhi chalega, value har keystroke par badalti hai
   allowCustom=false (country) → sirf list se select; typed text blur par wapas selected value par
   Parent ko `relative` hona chahiye (list absolute khulti hai). `theme` se colours badlo. */
const COMBO_RENDER_LIMIT = 80;

// Default = signup (slate + orange). Super admin apne CSS variables wala theme deta hai.
export const COMBO_THEME_SIGNUP = {
  toggle: "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
  list: "rounded-xl border border-slate-200 bg-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)]",
  option: "text-slate-700",
  optionActive: "bg-[#f57224]/[0.08] text-slate-900",
  check: "text-[#f57224]",
  note: "text-slate-400",
  empty: "text-slate-500",
  strong: "text-slate-700",
};
export const COMBO_THEME_ADMIN = {
  toggle: "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
  list: "rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_16px_40px_-12px_rgba(15,23,42,0.3)]",
  option: "text-[var(--text-secondary)]",
  optionActive: "bg-[var(--accent-soft,rgba(99,102,241,0.1))] text-[var(--text-primary)]",
  check: "text-[var(--accent)]",
  note: "text-[var(--text-muted)]",
  empty: "text-[var(--text-muted)]",
  strong: "text-[var(--text-primary)]",
};

export default function SearchCombobox({ id, value, onChange, options, loading, inputClassName, describedBy, invalid, itemLabel = "city", allowCustom = true, pinned = [], placeholder: placeholderProp, theme = COMBO_THEME_SIGNUP }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [draft, setDraft] = useState(null); // allowCustom=false: null = selected value dikhao, string = user type kar raha hai
  const listRef = useRef(null);
  const shown = allowCustom ? value : (draft ?? value);
  const query = shown.trim().toLowerCase();

  // "starts with" pehle, phir "contains"; khali query par pinned (e.g. Pakistan) sab se upar
  const { matches, total } = useMemo(() => {
    if (!options.length) return { matches: [], total: 0 };
    if (!query) {
      const pin = pinned.filter((p) => options.includes(p));
      const rest = pin.length ? options.filter((o) => !pin.includes(o)) : options;
      return { matches: [...pin, ...rest].slice(0, COMBO_RENDER_LIMIT), total: options.length };
    }
    const starts = [];
    const contains = [];
    for (const o of options) {
      const l = o.toLowerCase();
      if (l.startsWith(query)) starts.push(o);
      else if (l.includes(query)) contains.push(o);
    }
    const all = starts.concat(contains);
    return { matches: all.slice(0, COMBO_RENDER_LIMIT), total: all.length };
  }, [options, query, pinned]);

  const exactMatch = options.some((o) => o.toLowerCase() === query);
  const listId = `${id}-listbox`;

  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    listRef.current.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (name) => {
    onChange(name);
    setDraft(null);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && active >= 0 && matches[active]) {
      e.preventDefault(); // form submit na ho — sirf option select ho
      choose(matches[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation(); // modal band na ho — sirf list band
      setOpen(false);
    }
  };

  const placeholder = placeholderProp || (loading ? `Loading ${itemLabel === "country" ? "countries" : `${itemLabel}s`}…` : options.length ? `Search or select a ${itemLabel}` : `Enter your ${itemLabel}`);

  return (
    <>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        value={shown}
        placeholder={placeholder}
        onChange={(e) => { if (allowCustom) onChange(e.target.value); else setDraft(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => { setOpen(false); setDraft(null); }}
        onKeyDown={onKeyDown}
        className={inputClassName}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? `Close ${itemLabel} list` : `Open ${itemLabel} list`}
        onMouseDown={(e) => { e.preventDefault(); document.getElementById(id)?.focus(); setOpen((o) => !o); }}
        className={`absolute end-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition ${theme.toggle}`}
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        ) : (
          <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && !loading && (matches.length > 0 || query) && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={itemLabel === "country" ? "Countries" : "Cities"}
          className={`absolute left-0 right-0 top-full z-30 mt-1.5 max-h-60 overflow-y-auto overscroll-contain py-1.5 ${theme.list}`}
        >
          {matches.map((name, i) => (
            <li
              key={name}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={name === value}
              // mousedown + preventDefault: input blur se pehle select ho jaye
              onMouseDown={(e) => { e.preventDefault(); choose(name); }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-[13.5px] ${i === active ? theme.optionActive : theme.option}`}
            >
              <span className="truncate">{name}</span>
              {name === value && <Check size={14} className={`shrink-0 ${theme.check}`} aria-hidden="true" />}
            </li>
          ))}
          {total > matches.length && (
            <li role="presentation" className={`px-3.5 pb-1 pt-2 text-[11.5px] ${theme.note}`}>
              Showing {matches.length} of {total.toLocaleString()} — type to narrow down
            </li>
          )}
          {query && !exactMatch && matches.length === 0 && (
            <li role="presentation" className={`px-3.5 py-1.5 text-[12px] ${theme.empty}`}>
              {allowCustom
                ? <>No match found — <span className={`font-semibold ${theme.strong}`}>“{shown.trim()}”</span> will be used as the {itemLabel}.</>
                : <>No {itemLabel} matches <span className={`font-semibold ${theme.strong}`}>“{shown.trim()}”</span>.</>}
            </li>
          )}
        </ul>
      )}
    </>
  );
}
