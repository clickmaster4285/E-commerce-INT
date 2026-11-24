"use client";

/* ==========================================================
   STORE EDITOR — sidebar panels
   SectionList (drag reorder) · SectionSettings (+ blocks) ·
   ThemeSettings · MenuEditor · VersionsPanel
   Drag: framer-motion Reorder (pehle se dependency).
   ========================================================== */

import { useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useThemeEditorStore, defaultsOf, randomId } from "../useThemeEditorStore";
import { SettingField, LinkInput, inputCls, humanize } from "./fields";

// Schema `showIf: { key, equals }` — dependent field sirf tab dikhe (value missing → field default)
function isVisible(field, values, fields) {
  if (!field?.showIf) return true;
  const dep = fields.find((f) => f.key === field.showIf.key);
  const current = values?.[field.showIf.key] ?? dep?.default;
  return current === field.showIf.equals;
}

const iconBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition hover:bg-subtle hover:text-fg disabled:opacity-30";

// ───────────────────────── Section list ─────────────────────────
function SectionRow({ id, section, label, selected }) {
  const controls = useDragControls();
  // Duplicate / remove section settings panel me hain (row compact rehti hai)
  const { select, toggleSection, moveSection } = useThemeEditorStore();
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className={`group flex items-center gap-1 rounded-lg border px-1.5 py-1.5 text-sm transition ${
        selected ? "border-accent bg-accent-soft" : "border-transparent bg-card hover:border-line"
      }`}
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab touch-none rounded p-1 text-fg-muted active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        onClick={() => select({ kind: "section", id })}
        className={`min-w-0 flex-1 truncate text-start font-medium ${section.disabled ? "text-fg-muted line-through" : "text-fg"}`}
      >
        {label}
      </button>
      <div className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <button type="button" className={iconBtn} onClick={() => moveSection(id, -1)} aria-label="Move up">
          <ArrowUp size={13} />
        </button>
        <button type="button" className={iconBtn} onClick={() => moveSection(id, 1)} aria-label="Move down">
          <ArrowDown size={13} />
        </button>
        <button type="button" className={iconBtn} onClick={() => toggleSection(id)} aria-label={section.disabled ? "Show" : "Hide"}>
          {section.disabled ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </Reorder.Item>
  );
}

export function SectionList({ schema }) {
  const { draft, selected, setOrder, addSection } = useThemeEditorStore();
  const [adding, setAdding] = useState(false);
  if (!draft) return null;

  const counts = draft.order.reduce((acc, id) => {
    const t = draft.sections[id]?.type;
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const addable = Object.entries(schema.sectionTypes).filter(([type, def]) => (counts[type] || 0) < def.limit);
  const full = draft.order.length >= schema.limits.maxSections;

  return (
    <div className="space-y-3">
      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-fg-muted">Homepage</p>
      <Reorder.Group axis="y" values={draft.order} onReorder={setOrder} className="space-y-1">
        {draft.order.map((id) => {
          const section = draft.sections[id];
          if (!section) return null;
          const def = schema.sectionTypes[section.type];
          const custom = section.settings?.heading;
          return (
            <SectionRow
              key={id}
              id={id}
              section={section}
              label={custom ? `${def?.label || section.type} · ${custom}` : def?.label || section.type}
              selected={selected?.kind === "section" && selected.id === id}
            />
          );
        })}
      </Reorder.Group>

      {adding ? (
        <div className="space-y-1 rounded-lg border border-line bg-card-alt p-2">
          {addable.length ? (
            addable.map(([type, def]) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  addSection(type, def);
                  setAdding(false);
                }}
                className="block w-full rounded-md px-2 py-1.5 text-start text-sm text-fg hover:bg-subtle"
              >
                {def.label}
              </button>
            ))
          ) : (
            <p className="px-2 py-1.5 text-xs text-fg-muted">All section types are already used.</p>
          )}
          <button type="button" onClick={() => setAdding(false)} className="w-full pt-1 text-xs text-fg-muted hover:text-fg">
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={full}
          onClick={() => setAdding(true)}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line text-sm font-semibold text-accent transition hover:border-accent disabled:opacity-50"
        >
          <Plus size={15} /> Add section
        </button>
      )}
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
  const update = (i, key, value) =>
    setBlocks(id, blocks.map((b, j) => (j === i ? { ...b, settings: { ...b.settings, [key]: value } } : b)));
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <p className="text-xs font-bold uppercase tracking-wider text-fg-muted">{def.label}s</p>
      {blocks.map((block, i) => (
        <div key={block.id} className="space-y-3 rounded-lg border border-line bg-card-alt p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-secondary">
              {def.label} {i + 1}
            </span>
            <div className="flex items-center">
              <button type="button" className={iconBtn} disabled={i === 0} onClick={() => setBlocks(id, swap(blocks, i, i - 1))} aria-label="Move up">
                <ArrowUp size={13} />
              </button>
              <button type="button" className={iconBtn} disabled={i === blocks.length - 1} onClick={() => setBlocks(id, swap(blocks, i, i + 1))} aria-label="Move down">
                <ArrowDown size={13} />
              </button>
              <button type="button" className={iconBtn} onClick={() => setBlocks(id, blocks.filter((_, j) => j !== i))} aria-label="Remove">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          {def.settings
            .filter((field) => isVisible(field, block.settings, def.settings))
            .map((field) => (
              <SettingField key={field.key} field={field} value={block.settings?.[field.key]} onChange={(v) => update(i, field.key, v)} />
            ))}
        </div>
      ))}
      <button
        type="button"
        disabled={blocks.length >= maxBlocks}
        onClick={() => setBlocks(id, [...blocks, { id: randomId("b"), settings: defaultsOf(def.settings) }])}
        className="inline-flex h-8 items-center gap-1.5 text-xs font-semibold text-accent disabled:opacity-50"
      >
        <Plus size={13} /> Add {def.label.toLowerCase()}
      </button>
    </div>
  );
}

export function SectionSettings({ schema, id, onBack }) {
  const { draft, setSectionSetting, setSectionStyle, duplicateSection, removeSection, toggleSection } = useThemeEditorStore();
  const section = draft?.sections?.[id];
  if (!section) return null;
  const def = schema.sectionTypes[section.type];
  const counts = draft.order.filter((x) => draft.sections[x]?.type === section.type).length;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg">
        <ChevronLeft size={14} /> Sections
      </button>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-fg">{def?.label || section.type}</h2>
        <div className="flex items-center">
          <button type="button" className={iconBtn} onClick={() => toggleSection(id)} title={section.disabled ? "Show" : "Hide"}>
            {section.disabled ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            type="button"
            className={iconBtn}
            disabled={!def || counts >= def.limit}
            onClick={() => duplicateSection(id)}
            title="Duplicate"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className={`${iconBtn} hover:text-danger`}
            onClick={() => {
              if (window.confirm("Remove this section?")) {
                removeSection(id);
                onBack();
              }
            }}
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {!def ? (
        <p className="text-sm text-warning">This section type is no longer supported and will be removed when you save.</p>
      ) : (
        <div className="space-y-4">
          {def.settings.length === 0 && !def.blocks ? (
            <p className="text-sm text-fg-muted">This section uses your store data automatically. Reorder or hide it from the list, or style it below.</p>
          ) : null}
          {def.settings
            .filter((field) => isVisible(field, section.settings, def.settings))
            .map((field) => (
              <SettingField
                key={field.key}
                field={field}
                value={section.settings?.[field.key]}
                onChange={(v) => setSectionSetting(id, field.key, v)}
                linkTypes={schema.linkTypes}
              />
            ))}
          {def.blocks && isVisible(def.blocks, section.settings, def.settings) ? (
            <BlocksEditor id={id} section={section} def={def.blocks} maxBlocks={schema.limits.maxBlocks} />
          ) : null}
          {section.type === "hero_banners" && def.blocks && !isVisible(def.blocks, section.settings, def.settings) ? (
            <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
              Slides come from{" "}
              <a href="/admin/banners" target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                Admin / Banners
              </a>
              . Switch &quot;Slides from&quot; to Custom to build slides here.
            </p>
          ) : null}

          {schema.sectionStyle?.length ? (
            <div className="space-y-4 border-t border-line pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-fg-muted">Section style</p>
              {schema.sectionStyle.map((field) => (
                <SettingField
                  key={field.key}
                  field={field}
                  value={section.style?.[field.key]}
                  onChange={(v) => setSectionStyle(id, field.key, v)}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
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

export function ThemeSettings({ schema }) {
  const { draft, setGlobalSetting, applyPreset } = useThemeEditorStore();
  if (!draft) return null;
  const presets = schema.presets || [];
  const activePreset = presets.find((p) =>
    Object.entries(p.settings || {}).every(([group, values]) => sameValues(draft.settings?.[group], values)),
  );
  return (
    <div className="space-y-6">
      {presets.length ? (
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted">Theme styles</h3>
          <p className="text-[11px] text-fg-muted">One click sets colors, fonts and corners. Your sections and content stay the same, and you can undo anytime.</p>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} active={activePreset?.id === preset.id} onApply={() => applyPreset(preset)} />
            ))}
          </div>
        </section>
      ) : null}
      {Object.entries(schema.globalSettings).map(([group, fields]) => (
        <section key={group} className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted">{GROUP_LABELS[group] || humanize(group)}</h3>
          {group === "colors" ? (
            <p className="text-[11px] text-fg-muted">Empty = built-in color. Dark mode keeps its own surfaces automatically.</p>
          ) : null}
          {fields.filter((field) => isVisible(field, draft.settings?.[group], fields)).map((field) => (
            <SettingField
              key={field.key}
              field={group === "colors" ? { ...field, label: COLOR_LABELS[field.key] || field.label } : field}
              value={draft.settings?.[group]?.[field.key]}
              onChange={(v) => setGlobalSetting(group, field.key, v)}
              linkTypes={schema.linkTypes}
            />
          ))}
        </section>
      ))}
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
