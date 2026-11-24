"use client";

/* ==========================================================
   STORE EDITOR — "Add section" gallery
   Category tabs + search, har type ka icon / description.
   Limit poori (e.g. hero sirf 1) → card disabled "Already added".
   `insertAt` diya ho to section us position par (preview "+" se).
   ========================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { SECTION_CATEGORIES, catalogOf } from "./sectionCatalog";

export default function AddSectionDialog({ schema, draft, onAdd, onClose }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const counts = useMemo(
    () =>
      draft.order.reduce((acc, id) => {
        const t = draft.sections[id]?.type;
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {}),
    [draft],
  );

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(schema.sectionTypes)
      .map(([type, def]) => ({ type, def, meta: catalogOf(type), used: counts[type] || 0 }))
      .filter(({ meta }) => category === "all" || meta.category === category)
      .filter(({ def, meta }) => !q || def.label.toLowerCase().includes(q) || meta.description.toLowerCase().includes(q));
  }, [schema, counts, query, category]);

  const full = draft.order.length >= schema.limits.maxSections;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label="Add section" className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-bold text-fg">Add section</h2>
          <div className="relative ms-auto w-full max-w-xs">
            <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sections…"
              className="h-9 w-full rounded-lg border border-line bg-input ps-8 pe-3 text-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-fg-muted hover:bg-subtle hover:text-fg" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav className="hidden w-44 shrink-0 space-y-0.5 border-e border-line p-2 sm:block">
            {[{ id: "all", label: "All sections" }, ...SECTION_CATEGORIES].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`block w-full rounded-md px-2.5 py-1.5 text-start text-xs font-semibold transition ${
                  category === c.id ? "bg-accent-soft text-accent" : "text-fg-secondary hover:bg-subtle hover:text-fg"
                }`}
              >
                {c.label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {full ? (
              <p className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                You&apos;ve reached the limit of {schema.limits.maxSections} sections. Remove one to add another.
              </p>
            ) : null}
            {items.length ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map(({ type, def, meta, used }) => {
                  const Icon = meta.icon;
                  const limitReached = used >= def.limit;
                  const disabled = full || limitReached;
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={disabled}
                      onClick={() => onAdd(type, def)}
                      className="group flex items-start gap-3 rounded-xl border border-line bg-card-alt p-3 text-start transition hover:border-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-card-alt"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-accent shadow-sm">
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                          {def.label}
                          {limitReached ? <span className="rounded bg-subtle px-1.5 py-0.5 text-[10px] font-semibold text-fg-muted">Already added</span> : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-fg-muted">{meta.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-fg-muted">No sections match &ldquo;{query}&rdquo;.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
