"use client";

/* ==========================================================
   STORE EDITOR — sidebar panels
   SectionList (drag reorder + badges) · SectionSettings (Content /
   blocks / Style groups) · ThemeSettings (search + collapsible groups)
   · MenuEditor · VersionsPanel
   Drag: framer-motion Reorder (pehle se dependency).
   ========================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  History,
  Loader2,
  Monitor,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { useThemeEditorStore, defaultsOf, randomId } from "../useThemeEditorStore";
import { SettingField, LinkInput, inputCls, humanize } from "./fields";
import { catalogOf, sectionLabel, blockTitle } from "./sectionCatalog";

// Schema `showIf: { key, equals }` — dependent field sirf tab dikhe (value missing → field default)
function isVisible(field, values, fields) {
  if (!field?.showIf) return true;
  const dep = fields.find((f) => f.key === field.showIf.key);
  const current = values?.[field.showIf.key] ?? dep?.default;
  return current === field.showIf.equals;
}

const iconBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition hover:bg-subtle hover:text-fg disabled:opacity-30";

/** Collapsible group (Content / Style / theme groups) */
export function Collapsible({ title, subtitle, open, onToggle, children, badge }) {
  return (
    <section className="rounded-xl border border-line bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-start"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-fg-secondary">
            {title}
            {badge}
          </span>
          {subtitle ? <span className="mt-0.5 block truncate text-[11px] font-normal normal-case tracking-normal text-fg-muted">{subtitle}</span> : null}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-fg-muted transition-transform ${open ? "" : "-rotate-90 rtl:rotate-90"}`} />
      </button>
      {open ? <div className="space-y-4 border-t border-line px-3 pb-4 pt-3">{children}</div> : null}
    </section>
  );
}

// Local open/closed state — har group alag
function useOpenGroups(initial = {}) {
  const [open, setOpen] = useState(initial);
  const toggle = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  return [open, toggle, setOpen];
}

function VisibilityBadges({ section }) {
  const vis = section.style?.visibility;
  return (
    <>
      {section.disabled ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-subtle px-1 py-0.5 text-[10px] font-semibold text-fg-muted" title="Hidden">
          <EyeOff size={10} /> Hidden
        </span>
      ) : null}
      {!section.disabled && vis === "desktop" ? (
        <span className="inline-flex items-center rounded bg-info-soft px-1 py-0.5 text-info" title="Desktop only">
          <Monitor size={10} />
        </span>
      ) : null}
      {!section.disabled && vis === "mobile" ? (
        <span className="inline-flex items-center rounded bg-info-soft px-1 py-0.5 text-info" title="Mobile only">
          <Smartphone size={10} />
        </span>
      ) : null}
    </>
  );
}

// ───────────────────────── Section list ─────────────────────────
function SectionRow({ id, section, label, selected, isFirst, isLast }) {
  const controls = useDragControls();
  // Duplicate / remove section settings panel me hain (row compact rehti hai)
  const select = useThemeEditorStore((s) => s.select);
  const toggleSection = useThemeEditorStore((s) => s.toggleSection);
  const moveSection = useThemeEditorStore((s) => s.moveSection);
  const Icon = catalogOf(section.type).icon;
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className={`group flex items-center gap-1 rounded-lg border px-1 py-1 text-sm transition ${
        selected ? "border-accent bg-accent-soft" : "border-transparent bg-card hover:border-line hover:bg-card-alt"
      }`}
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab touch-none rounded p-1 text-fg-muted opacity-60 hover:opacity-100 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        onClick={() => select({ kind: "section", id })}
        className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-start"
      >
        <Icon size={14} className={`shrink-0 ${selected ? "text-accent" : "text-fg-muted"}`} />
        <span className={`min-w-0 flex-1 truncate font-medium ${section.disabled ? "text-fg-muted" : "text-fg"}`}>{label}</span>
        <VisibilityBadges section={section} />
      </button>
      <div className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button type="button" className={iconBtn} disabled={isFirst} onClick={() => moveSection(id, -1)} aria-label="Move up">
          <ArrowUp size={13} />
        </button>
        <button type="button" className={iconBtn} disabled={isLast} onClick={() => moveSection(id, 1)} aria-label="Move down">
          <ArrowDown size={13} />
        </button>
        <button type="button" className={iconBtn} onClick={() => toggleSection(id)} aria-label={section.disabled ? "Show" : "Hide"} title={section.disabled ? "Show" : "Hide"}>
          {section.disabled ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </Reorder.Item>
  );
}

// Header / footer / announcement — theme settings me hain; list me shortcut rows
const FIXED_ROWS_TOP = [
  { group: "announcement", label: "Announcement bar" },
  { group: "header", label: "Header" },
];
const FIXED_ROWS_BOTTOM = [{ group: "footer", label: "Footer" }];

function FixedRow({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-start text-sm text-fg-secondary transition hover:border-line hover:bg-card-alt hover:text-fg"
    >
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <ChevronRight size={14} className="text-fg-muted rtl:rotate-180" />
    </button>
  );
}

export function SectionList({ schema, onAddSection, onOpenGlobal }) {
  const draft = useThemeEditorStore((s) => s.draft);
  const selected = useThemeEditorStore((s) => s.selected);
  const setOrder = useThemeEditorStore((s) => s.setOrder);
  if (!draft) return null;

  const full = draft.order.length >= schema.limits.maxSections;
  const visibleOrder = draft.order.filter((id) => draft.sections[id]);
  const hasGlobal = (g) => Boolean(schema.globalSettings?.[g]);

  return (
    <div className="space-y-3">
      {onOpenGlobal ? (
        <div className="space-y-0.5">
          {FIXED_ROWS_TOP.filter((r) => hasGlobal(r.group)).map((r) => (
            <FixedRow key={r.group} label={r.label} onClick={() => onOpenGlobal(r.group)} />
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">Homepage sections</p>
        <span className="text-[11px] tabular-nums text-fg-muted">
          {draft.order.length}/{schema.limits.maxSections}
        </span>
      </div>

      {visibleOrder.length ? (
        <Reorder.Group axis="y" values={draft.order} onReorder={setOrder} className="space-y-0.5">
          {visibleOrder.map((id, index) => (
            <SectionRow
              key={id}
              id={id}
              section={draft.sections[id]}
              label={sectionLabel(schema, draft.sections[id])}
              selected={selected?.kind === "section" && selected.id === id}
              isFirst={index === 0}
              isLast={index === visibleOrder.length - 1}
            />
          ))}
        </Reorder.Group>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-fg-muted">No sections yet. Add your first one.</p>
      )}

      <button
        type="button"
        disabled={full}
        onClick={() => onAddSection?.()}
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent-soft disabled:opacity-50"
      >
        <Plus size={15} /> Add section
      </button>

      {onOpenGlobal ? (
        <div className="space-y-0.5 border-t border-line pt-3">
          {FIXED_ROWS_BOTTOM.filter((r) => hasGlobal(r.group)).map((r) => (
            <FixedRow key={r.group} label={r.label} onClick={() => onOpenGlobal(r.group)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ───────────────────────── Section settings ─────────────────────────
const swap = (list, i, j) => {
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
};

function BlocksEditor({ id, section, def, maxBlocks }) {
  const setBlocks = useThemeEditorStore((s) => s.setBlocks);
  const blocks = section.blocks || [];
  // Ek waqt me ek block khula (lambi list chhoti rehti hai); naya block khud khulta hai
  const [openId, setOpenId] = useState(blocks.length === 1 ? blocks[0].id : null);
  const update = (i, key, value) =>
    setBlocks(id, blocks.map((b, j) => (j === i ? { ...b, settings: { ...b.settings, [key]: value } } : b)));
  const add = () => {
    const block = { id: randomId("b"), settings: defaultsOf(def.settings) };
    setBlocks(id, [...blocks, block]);
    setOpenId(block.id);
  };
  const duplicate = (i) => {
    const copy = { ...JSON.parse(JSON.stringify(blocks[i])), id: randomId("b") };
    setBlocks(id, [...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)]);
    setOpenId(copy.id);
  };
  return (
    <div className="space-y-2">
      {blocks.length === 0 ? <p className="text-xs text-fg-muted">No {def.label.toLowerCase()}s yet.</p> : null}
      {blocks.map((block, i) => {
        const open = openId === block.id;
        return (
          <div key={block.id} className={`rounded-lg border ${open ? "border-accent/40 bg-card-alt" : "border-line bg-card-alt"}`}>
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : block.id)}
                aria-expanded={open}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
              >
                <ChevronDown size={13} className={`shrink-0 text-fg-muted transition-transform ${open ? "" : "-rotate-90 rtl:rotate-90"}`} />
                <span className="truncate text-xs font-semibold text-fg">{blockTitle(def, block, i)}</span>
              </button>
              <button type="button" className={iconBtn} disabled={i === 0} onClick={() => setBlocks(id, swap(blocks, i, i - 1))} aria-label="Move up">
                <ArrowUp size={13} />
              </button>
              <button type="button" className={iconBtn} disabled={i === blocks.length - 1} onClick={() => setBlocks(id, swap(blocks, i, i + 1))} aria-label="Move down">
                <ArrowDown size={13} />
              </button>
              <button type="button" className={iconBtn} disabled={blocks.length >= maxBlocks} onClick={() => duplicate(i)} aria-label="Duplicate" title="Duplicate">
                <Copy size={12} />
              </button>
              <button type="button" className={`${iconBtn} hover:text-danger`} onClick={() => setBlocks(id, blocks.filter((_, j) => j !== i))} aria-label="Remove" title="Remove">
                <Trash2 size={13} />
              </button>
            </div>
            {open ? (
              <div className="space-y-3 border-t border-line px-3 pb-3 pt-3">
                {def.settings
                  .filter((field) => isVisible(field, block.settings, def.settings))
                  .map((field) => (
                    <SettingField key={field.key} field={field} value={block.settings?.[field.key]} onChange={(v) => update(i, field.key, v)} />
                  ))}
              </div>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        disabled={blocks.length >= maxBlocks}
        onClick={add}
        className="inline-flex h-8 items-center gap-1.5 text-xs font-semibold text-accent disabled:opacity-50"
      >
        <Plus size={13} /> Add {def.label.toLowerCase()}
        <span className="font-normal text-fg-muted">
          ({blocks.length}/{maxBlocks})
        </span>
      </button>
    </div>
  );
}

const hasStyle = (style) => Boolean(style && Object.values(style).some((v) => v !== null && v !== undefined && v !== "" && v !== "none" && v !== "all"));

export function SectionSettings({ schema, id, onBack }) {
  const draft = useThemeEditorStore((s) => s.draft);
  const setSectionSetting = useThemeEditorStore((s) => s.setSectionSetting);
  const setSectionStyle = useThemeEditorStore((s) => s.setSectionStyle);
  const duplicateSection = useThemeEditorStore((s) => s.duplicateSection);
  const removeSection = useThemeEditorStore((s) => s.removeSection);
  const toggleSection = useThemeEditorStore((s) => s.toggleSection);
  const section = draft?.sections?.[id];
  const [open, toggle] = useOpenGroups({ content: true, blocks: true, style: hasStyle(section?.style) });
  if (!section) return null;
  const def = schema.sectionTypes[section.type];
  const counts = draft.order.filter((x) => draft.sections[x]?.type === section.type).length;
  const Icon = catalogOf(section.type).icon;
  const contentFields = def ? def.settings.filter((field) => isVisible(field, section.settings, def.settings)) : [];
  const showBlocks = def?.blocks && isVisible(def.blocks, section.settings, def.settings);

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg">
        <ChevronLeft size={14} className="rtl:rotate-180" /> Sections
      </button>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-fg">{def?.label || section.type}</h2>
          <div className="flex items-center gap-1">
            <VisibilityBadges section={section} />
          </div>
        </div>
        <div className="flex items-center">
          <button type="button" className={iconBtn} onClick={() => toggleSection(id)} title={section.disabled ? "Show" : "Hide"}>
            {section.disabled ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            type="button"
            className={iconBtn}
            disabled={!def || counts >= def.limit}
            onClick={() => duplicateSection(id, def?.limit)}
            title="Duplicate"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      {!def ? (
        <p className="text-sm text-warning">This section type is no longer supported and will be removed when you save.</p>
      ) : (
        <>
          <Collapsible title="Content" open={open.content} onToggle={() => toggle("content")}>
            {contentFields.length === 0 && !def.blocks ? (
              <p className="text-xs text-fg-muted">This section uses your store data automatically. Reorder or hide it from the list, or style it below.</p>
            ) : null}
            {contentFields.map((field) => (
              <SettingField
                key={field.key}
                field={field}
                value={section.settings?.[field.key]}
                onChange={(v) => setSectionSetting(id, field.key, v)}
                linkTypes={schema.linkTypes}
              />
            ))}
            {section.type === "hero_banners" && def.blocks && !showBlocks ? (
              <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
                Slides come from{" "}
                <a href="/admin/banners" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  Admin / Banners
                </a>
                . Switch &quot;Slides from&quot; to Custom to build slides here.
              </p>
            ) : null}
          </Collapsible>

          {showBlocks ? (
            <Collapsible
              title={`${def.blocks.label}s`}
              open={open.blocks}
              onToggle={() => toggle("blocks")}
              badge={<span className="rounded bg-subtle px-1.5 text-[10px] tabular-nums text-fg-muted">{(section.blocks || []).length}</span>}
            >
              <BlocksEditor id={id} section={section} def={def.blocks} maxBlocks={schema.limits.maxBlocks} />
            </Collapsible>
          ) : null}

          {schema.sectionStyle?.length ? (
            <Collapsible title="Style" subtitle="Background, spacing, show on mobile / desktop" open={open.style} onToggle={() => toggle("style")}>
              {schema.sectionStyle.map((field) => (
                <SettingField key={field.key} field={field} value={section.style?.[field.key]} onChange={(v) => setSectionStyle(id, field.key, v)} />
              ))}
            </Collapsible>
          ) : null}
        </>
      )}

      <button
        type="button"
        onClick={() => {
          if (window.confirm("Remove this section?")) {
            removeSection(id);
            onBack();
          }
        }}
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-danger transition hover:bg-danger-soft"
      >
        <Trash2 size={14} /> Remove section
      </button>
    </div>
  );
}

// ───────────────────────── Theme settings ─────────────────────────
const GROUP_LABELS = {
  colors: "Colors",
  typography: "Typography",
  layout: "Layout",
  branding: "Branding",
  announcement: "Announcement bar",
  header: "Header",
  footer: "Footer",
  conversion: "Conversion boosters",
  popup: "Popup",
};
const GROUP_HINTS = {
  colors: "Accent, background, text and borders",
  typography: "Heading and body fonts",
  layout: "Corner radius",
  branding: "Favicon",
  announcement: "Message bar above the header",
  header: "Sticky header, search, logo",
  footer: "Footer text, social links",
  conversion: "WhatsApp button, low stock",
  popup: "Newsletter / promo popup",
};
const COLOR_LABELS = {
  accent: "Accent (buttons, links)",
  accentHover: "Accent hover",
  accentText: "Text on accent",
  background: "Page background (light mode)",
  card: "Cards (light mode)",
  text: "Text (light mode)",
  border: "Borders (light mode)",
};

function PresetCard({ preset, active, onApply }) {
  const c = preset.settings?.colors || {};
  const swatches = [c.background || "#eff0f5", c.card || "#ffffff", c.accent || "#f97316", c.text || "#0a0a0a"];
  const font = preset.settings?.typography?.headingFont;
  return (
    <button
      type="button"
      onClick={onApply}
      className={`flex flex-col gap-2 rounded-lg border p-2.5 text-start transition hover:border-accent ${active ? "border-accent bg-accent-soft" : "border-line bg-card-alt"}`}
    >
      <span className="flex overflow-hidden rounded-md border border-line">
        {swatches.map((color, i) => (
          <span key={i} className="h-6 flex-1" style={{ backgroundColor: color }} />
        ))}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold text-fg" style={font ? { fontFamily: `"${font}", system-ui` } : undefined}>
          {preset.name}
        </span>
        <span className="block truncate text-[10px] text-fg-muted">{preset.description}</span>
      </span>
    </button>
  );
}

const sameValues = (a = {}, b = {}) => Object.keys(b).every((k) => (a[k] ?? null) === (b[k] ?? null));
const fieldLabel = (group, field) => (group === "colors" ? COLOR_LABELS[field.key] || field.label : field.label) || humanize(field.key);

export function ThemeSettings({ schema, focusGroup = null, onFocusHandled }) {
  const draft = useThemeEditorStore((s) => s.draft);
  const setGlobalSetting = useThemeEditorStore((s) => s.setGlobalSetting);
  const applyPreset = useThemeEditorStore((s) => s.applyPreset);
  const [query, setQuery] = useState("");
  const [open, toggle, setOpen] = useOpenGroups({ presets: true });
  const groupRefs = useRef({});

  // Section list ke "Header / Footer" row se aaye → wo group khol kar scroll
  useEffect(() => {
    if (!focusGroup) return;
    setOpen((o) => ({ ...o, [focusGroup]: true }));
    const t = setTimeout(() => {
      groupRefs.current[focusGroup]?.scrollIntoView({ block: "start", behavior: "smooth" });
      onFocusHandled?.();
    }, 30);
    return () => clearTimeout(t);
  }, [focusGroup, setOpen, onFocusHandled]);

  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      Object.entries(schema.globalSettings).map(([group, fields]) => {
        const title = GROUP_LABELS[group] || humanize(group);
        const groupMatch = q && title.toLowerCase().includes(q);
        const matches = !q || groupMatch ? fields : fields.filter((f) => fieldLabel(group, f).toLowerCase().includes(q));
        return { group, fields, title, matches };
      }),
    [schema, q],
  );
  if (!draft) return null;

  const presets = schema.presets || [];
  const activePreset = presets.find((p) =>
    Object.entries(p.settings || {}).every(([group, values]) => sameValues(draft.settings?.[group], values)),
  );
  const visibleGroups = groups.filter((g) => g.matches.length);
  const showPresets = presets.length && (!q || "theme styles presets".includes(q));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search settings (e.g. font, sticky, WhatsApp)"
          className={`${inputCls} ps-8 pe-8`}
        />
        {query ? (
          <button type="button" onClick={() => setQuery("")} className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-fg-muted hover:text-fg" aria-label="Clear search">
            <X size={13} />
          </button>
        ) : null}
      </div>

      {showPresets ? (
        <Collapsible title="Theme styles" subtitle="One click sets colors, fonts and corners" open={Boolean(q) || open.presets} onToggle={() => toggle("presets")}>
          <p className="text-[11px] text-fg-muted">Your sections and content stay the same, and you can undo anytime.</p>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} active={activePreset?.id === preset.id} onApply={() => applyPreset(preset)} />
            ))}
          </div>
        </Collapsible>
      ) : null}

      {visibleGroups.map(({ group, fields, title, matches }) => (
        <div key={group} ref={(el) => (groupRefs.current[group] = el)} className="scroll-mt-2">
          <Collapsible title={title} subtitle={GROUP_HINTS[group]} open={Boolean(q) || Boolean(open[group])} onToggle={() => toggle(group)}>
            {group === "colors" ? <p className="text-[11px] text-fg-muted">Empty = built-in color. Dark mode keeps its own surfaces automatically.</p> : null}
            {matches
              .filter((field) => isVisible(field, draft.settings?.[group], fields))
              .map((field) => (
                <SettingField
                  key={field.key}
                  field={{ ...field, label: fieldLabel(group, field) }}
                  value={draft.settings?.[group]?.[field.key]}
                  onChange={(v) => setGlobalSetting(group, field.key, v)}
                  linkTypes={schema.linkTypes}
                />
              ))}
          </Collapsible>
        </div>
      ))}

      {q && !visibleGroups.length && !showPresets ? (
        <p className="py-8 text-center text-sm text-fg-muted">No settings match &ldquo;{query}&rdquo;.</p>
      ) : null}
    </div>
  );
}

// ───────────────────────── Menus ─────────────────────────
function MenuList({ menuKey, title, hint, maxItems, allowChildren = false }) {
  const { draft, setMenu } = useThemeEditorStore();
  const items = draft?.menus?.[menuKey] || [];
  // Validator har menu item (children bhi) gin-ta hai — yahan bhi wahi
  const countItems = (list) => (list || []).reduce((n, it) => n + 1 + countItems(it.children), 0);
  const totalItems = Object.values(draft?.menus || {}).reduce((n, list) => n + countItems(list), 0);
  const patchChild = (i, j, next) =>
    patch(i, { children: (items[i].children || []).map((c, k) => (k === j ? { ...c, ...next } : c)) });
  const patch = (i, next) => setMenu(menuKey, items.map((it, j) => (j === i ? { ...it, ...next } : it)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setMenu(menuKey, copy);
  };
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-fg">{title}</h3>
        <p className="text-[11px] text-fg-muted">{hint}</p>
      </div>
      {items.map((item, i) => (
        <div key={item.id} className="space-y-2 rounded-lg border border-line bg-card-alt p-3">
          <div className="flex items-center gap-1">
            <input className={inputCls} placeholder="Label" maxLength={60} value={item.label} onChange={(e) => patch(i, { label: e.target.value })} />
            <button type="button" className={iconBtn} onClick={() => move(i, -1)} aria-label="Move up">
              <ArrowUp size={13} />
            </button>
            <button type="button" className={iconBtn} onClick={() => move(i, 1)} aria-label="Move down">
              <ArrowDown size={13} />
            </button>
            <button type="button" className={`${iconBtn} hover:text-danger`} onClick={() => setMenu(menuKey, items.filter((_, j) => j !== i))} aria-label="Remove">
              <Trash2 size={13} />
            </button>
          </div>
          <LinkInput value={item.link} onChange={(link) => patch(i, { link })} />
          {allowChildren ? (
            <div className="space-y-2 border-s-2 border-line ps-3">
              {(item.children || []).map((child, j) => (
                <div key={child.id} className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <input
                      className={inputCls}
                      placeholder="Sub-link label"
                      maxLength={60}
                      value={child.label}
                      onChange={(e) => patchChild(i, j, { label: e.target.value })}
                    />
                    <button
                      type="button"
                      className={`${iconBtn} hover:text-danger`}
                      onClick={() => patch(i, { children: item.children.filter((_, k) => k !== j) })}
                      aria-label="Remove sub-link"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <LinkInput value={child.link} onChange={(link) => patchChild(i, j, { link })} />
                </div>
              ))}
              <button
                type="button"
                disabled={totalItems >= maxItems}
                onClick={() =>
                  patch(i, { children: [...(item.children || []), { id: randomId("m"), label: "", link: { type: "home" }, children: [] }] })
                }
                className="inline-flex h-7 items-center gap-1 text-[11px] font-semibold text-accent disabled:opacity-50"
              >
                <Plus size={12} /> Add sub-link (dropdown)
              </button>
            </div>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        disabled={totalItems >= maxItems}
        onClick={() => setMenu(menuKey, [...items, { id: randomId("m"), label: "", link: { type: "home" }, children: [] }])}
        className="inline-flex h-8 items-center gap-1.5 text-xs font-semibold text-accent disabled:opacity-50"
      >
        <Plus size={13} /> Add link
      </button>
    </section>
  );
}

export function MenuEditor({ schema }) {
  return (
    <div className="space-y-6">
      <MenuList
        menuKey="main"
        allowChildren
        title="Main menu"
        hint="Shown in the navigation bar under the header. Empty = default links (Home, Best offers, New)."
        maxItems={schema.limits.maxMenuItems}
      />
      <MenuList
        menuKey="footer"
        title="Footer menu"
        hint="Shown in the footer Help column. Empty = default links."
        maxItems={schema.limits.maxMenuItems}
      />
    </div>
  );
}

// ───────────────────────── Versions ─────────────────────────
export function VersionsPanel({ versions, loading, onRestore, restoring }) {
  if (loading) {
    return (
      <div className="flex justify-center py-8 text-fg-muted">
        <Loader2 className="animate-spin" size={18} />
      </div>
    );
  }
  if (!versions?.length) {
    return (
      <div className="py-8 text-center text-sm text-fg-muted">
        <History className="mx-auto mb-2" size={20} />
        No published versions yet.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {versions.map((v) => (
        <li key={v.version} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card-alt px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">Version {v.version}</p>
            <p className="truncate text-[11px] text-fg-muted">
              {new Date(v.createdAt).toLocaleString()}
              {v.publishedBy?.name ? ` · ${v.publishedBy.name}` : ""}
              {v.note ? ` · ${v.note}` : ""}
            </p>
          </div>
          <button
            type="button"
            disabled={restoring}
            onClick={() => onRestore(v.version)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft disabled:opacity-50"
          >
            <RotateCcw size={12} /> Restore
          </button>
        </li>
      ))}
    </ul>
  );
}
