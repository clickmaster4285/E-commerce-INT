"use client";

import { useMemo, useState } from "react";
import {
  Check, X, Infinity as InfinityIcon, ToggleLeft, ToggleRight, LayoutGrid,
} from "lucide-react";
import { Card, CardBody, CardHeader, Button, Badge } from "@/components/superadmin/ui";
import { PLAN_MODULES, MODULE_SECTIONS, limitLabel } from "@/lib/planModules";

/**
 * Shared module grid for plan create/edit (interactive) and detail (read-only).
 * Maps PLAN_MODULES from adminModules — ek hi list, dono pages.
 *
 * mode: "edit" | "view"
 * modulesState: edit form state { [key]: { enabled, unlimited, limit } }
 * planModules: view mode API shape { [key]: { enabled, limit } }
 */
export default function PlanModulesPanel({
  mode = "view",
  modulesState,
  planModules,
  onPatch,
  onSetSectionEnabled,
  errors = {},
  className,
}) {
  const [activeSection, setActiveSection] = useState(MODULE_SECTIONS[0]);

  const enabledCount = useMemo(() => {
    if (mode === "edit") {
      return PLAN_MODULES.filter((m) => modulesState?.[m.key]?.enabled !== false).length;
    }
    return PLAN_MODULES.filter((m) => planModules?.[m.key]?.enabled !== false).length;
  }, [mode, modulesState, planModules]);

  const sectionModules = useMemo(
    () => PLAN_MODULES.filter((m) => m.section === activeSection),
    [activeSection],
  );

  const sectionStats = (section) => {
    const list = PLAN_MODULES.filter((m) => m.section === section);
    const on = list.filter((m) => {
      if (mode === "edit") return modulesState?.[m.key]?.enabled !== false;
      return planModules?.[m.key]?.enabled !== false;
    }).length;
    return { on, total: list.length };
  };

  return (
    <Card className={className}>
      <CardHeader
        title="Module access & limits"
        description={`${enabledCount} of ${PLAN_MODULES.length} modules enabled`}
        icon={LayoutGrid}
      />
      <div className="flex gap-0 overflow-x-auto border-b border-[var(--border-color)]">
        {MODULE_SECTIONS.map((section) => {
          const active = section === activeSection;
          const { on, total } = sectionStats(section);
          return (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={`shrink-0 border-b-2 px-4 py-3 text-[12.5px] font-semibold transition-colors ${active ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              {section}
              <span className={`ms-2 rounded-full px-1.5 py-0.5 text-[10.5px] tabular-nums ${active ? "bg-[var(--accent-soft,rgba(99,102,241,0.12))] text-[var(--accent)]" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}`}>
                {on}/{total}
              </span>
            </button>
          );
        })}
      </div>
      <CardBody className="space-y-4">
        {mode === "edit" && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-[var(--text-secondary)]">Toggle modules on for this plan. Set a max count, or leave unlimited.</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => onSetSectionEnabled?.(activeSection, true)}>Enable all</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => onSetSectionEnabled?.(activeSection, false)}>Disable all</Button>
            </div>
          </div>
        )}

        <div className={mode === "view" ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "grid grid-cols-1 gap-3"}>
          {sectionModules.map((m) => {
            if (mode === "edit") {
              const row = modulesState?.[m.key] || { enabled: true, unlimited: true, limit: "" };
              const err = errors[`modules.${m.key}`];
              const Icon = m.icon;
              return (
                <div
                  key={m.key}
                  className={`rounded-xl border px-4 py-3.5 transition-colors ${row.enabled ? "border-[var(--border-color)] bg-[var(--bg-card)]" : "border-transparent bg-[var(--bg-tertiary)]/70 opacity-80"}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onPatch?.(m.key, { enabled: !row.enabled })}
                      className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition-colors ${row.enabled ? "bg-[var(--success-soft,rgba(16,185,129,0.12))] text-[var(--success-text)]" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}`}
                      aria-pressed={row.enabled}
                    >
                      {row.enabled ? <ToggleRight size={18} aria-hidden="true" /> : <ToggleLeft size={18} aria-hidden="true" />}
                      {Icon ? <Icon size={15} aria-hidden="true" /> : null}
                      {m.label}
                    </button>
                    <span className="text-[12px] text-[var(--text-muted)]">{row.enabled ? "Included" : "Not included"}</span>
                    {m.countable && row.enabled && (
                      <div className="ms-auto flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={row.unlimited}
                          value={row.unlimited ? "" : row.limit}
                          onChange={(e) => onPatch?.(m.key, { limit: e.target.value, unlimited: false })}
                          placeholder={row.unlimited ? "Unlimited" : "Max"}
                          aria-invalid={err ? "true" : undefined}
                          className="sa-input h-9 w-[120px] disabled:opacity-60"
                        />
                        <label className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-secondary)]">
                          <input
                            type="checkbox"
                            checked={row.unlimited}
                            onChange={(e) => onPatch?.(m.key, { unlimited: e.target.checked, limit: e.target.checked ? "" : row.limit })}
                            className="size-4 rounded border-[var(--border-color)]"
                          />
                          <InfinityIcon size={13} aria-hidden="true" /> Unlimited
                        </label>
                      </div>
                    )}
                  </div>
                  {err && <p className="mt-2 text-[12px] font-medium text-[var(--danger-text)]">{err}</p>}
                </div>
              );
            }

            const enabled = planModules?.[m.key]?.enabled !== false;
            const limit = planModules?.[m.key]?.limit ?? null;
            const Icon = m.icon;
            return (
              <div
                key={m.key}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${enabled ? "border-[var(--border-color)] bg-[var(--bg-card)]" : "border-transparent bg-[var(--bg-tertiary)]/60"}`}
              >
                <span className={`inline-flex items-center gap-2 text-[13px] font-medium ${enabled ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                  {enabled
                    ? <Check size={14} className="text-[var(--success-text)]" aria-hidden="true" />
                    : <X size={14} className="text-[var(--text-muted)]" aria-hidden="true" />}
                  {Icon ? <Icon size={14} className="text-[var(--text-muted)]" aria-hidden="true" /> : null}
                  {m.label}
                </span>
                {enabled && m.countable ? (
                  <span className="inline-flex items-center gap-1 text-[12.5px] tabular-nums text-[var(--text-secondary)]">
                    {limit == null ? <><InfinityIcon size={13} aria-hidden="true" /> Unlimited</> : limitLabel(limit)}
                  </span>
                ) : enabled ? (
                  <Badge tone="success" dot={false}>On</Badge>
                ) : (
                  <Badge tone="neutral" dot={false}>Off</Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

export { PLAN_MODULES, MODULE_SECTIONS };
